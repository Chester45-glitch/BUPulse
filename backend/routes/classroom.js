const express = require("express");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { syncUserCourses } = require("../services/userCourseSync");
const {
  getCourses,
  getAllDeadlines,
  getAllAnnouncements,
  getUnifiedStream,
} = require("../services/googleClassroom");

const router = express.Router();

// ── In-memory cache (per user, 3-minute TTL) ────────────────────
const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
};

const setCache = (key, data) => cache.set(key, { data, ts: Date.now() });

const clearUserCache = (userId) => {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
};

// ── Token helper ────────────────────────────────────────────────
const getUserTokens = async (userId) => {
  const { data } = await supabase
    .from("users")
    .select("access_token, refresh_token")
    .eq("id", userId)
    .single();
  return data;
};

// GET /api/classroom/courses
router.get("/courses", authenticateToken, async (req, res) => {
  try {
    const cacheKey = `${req.user.id}:courses`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ courses: cached, cached: true });

    const tokens = await getUserTokens(req.user.id);
    const courses = await getCourses(tokens.access_token, tokens.refresh_token);
    setCache(cacheKey, courses);

    // Sync into user_courses table (fire-and-forget)
    syncUserCourses(req.user.id, tokens.access_token, tokens.refresh_token, "student")
      .catch(e => console.error("[classroom] course sync:", e.message));

    // Update cached_course_ids in users table for resilient attendance visibility
    const courseIds = courses.map(c => c.id);
    supabase.from("users").update({
      cached_course_ids: courseIds,
      courses_cached_at: new Date().toISOString(),
    }).eq("id", req.user.id).then(() => {}).catch(() => {});

    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// GET /api/classroom/deadlines
router.get("/deadlines", authenticateToken, async (req, res) => {
  try {
    const cacheKey = `${req.user.id}:deadlines`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ deadlines: cached, total: cached.length, cached: true });

    const tokens = await getUserTokens(req.user.id);
    const deadlines = await getAllDeadlines(tokens.access_token, tokens.refresh_token);
    setCache(cacheKey, deadlines);
    res.json({ deadlines, total: deadlines.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deadlines" });
  }
});

// GET /api/classroom/announcements (legacy – still used by dashboard)
router.get("/announcements", authenticateToken, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    const cacheKey = `${req.user.id}:announcements`;

    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return res.json({ announcements: cached, total: cached.length, cached: true });
    }

    const tokens = await getUserTokens(req.user.id);
    const announcements = await getAllAnnouncements(tokens.access_token, tokens.refresh_token);
    setCache(cacheKey, announcements);
    res.json({ announcements, total: announcements.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// GET /api/classroom/stream — unified feed (announcements + materials + quizzes)
router.get("/stream", authenticateToken, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    const cacheKey = `${req.user.id}:stream`;

    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return res.json({ items: cached, total: cached.length, cached: true });
    }

    const tokens = await getUserTokens(req.user.id);
    const items = await getUnifiedStream(tokens.access_token, tokens.refresh_token);
    setCache(cacheKey, items);
    res.json({ items, total: items.length });
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).json({ error: "Failed to fetch stream" });
  }
});

// GET /api/classroom/dashboard
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    const cacheKey = `${req.user.id}:dashboard`;

    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return res.json({ ...cached, cached: true });
    }

    const tokens = await getUserTokens(req.user.id);
    const [deadlines, announcements, courses] = await Promise.all([
      getAllDeadlines(tokens.access_token, tokens.refresh_token),
      getAllAnnouncements(tokens.access_token, tokens.refresh_token),
      getCourses(tokens.access_token, tokens.refresh_token),
    ]);

    // Prime individual caches so other pages are instant
    setCache(`${req.user.id}:deadlines`, deadlines);
    setCache(`${req.user.id}:announcements`, announcements);
    setCache(`${req.user.id}:courses`, courses);

    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const result = {
      stats: {
        newAnnouncements: announcements.filter((a) => new Date(a.updateTime) >= twoDaysAgo).length,
        upcomingDeadlines: deadlines.filter(
          (d) => new Date(d.dueDate) >= now && new Date(d.dueDate) <= in7Days
        ).length,
        urgentAlerts: deadlines.filter((d) => new Date(d.dueDate) < now).length,
        totalCourses: courses.length,
      },
      // Merge local priority announcements (stored in Supabase) with Google Classroom ones
      // so the dashboard always matches what the Announcements page shows.
      recentAnnouncements: await (async () => {
        try {
          const courseIds = courses.map(c => c.id);
          if (!courseIds.length) return announcements.slice(0, 5);
          const { data: localAnn } = await supabase
            .from("local_announcements")
            .select("*, poster:posted_by(id, name, email, picture)")
            .in("class_id", courseIds)
            .order("created_at", { ascending: false })
            .limit(10);

          const localMapped = (localAnn || []).map(a => ({
            id:          `local-${a.id}`,
            type:        "ANNOUNCEMENT",
            text:        a.text,
            priority:    a.priority,
            courseId:    a.class_id,
            courseName:  a.class_name,
            updateTime:  a.created_at,
            isLocal:     true,
          }));

          // Merge: local urgent first, then by date
          const merged = [...localMapped, ...announcements].sort((a, b) => {
            if (a.priority === "urgent" && b.priority !== "urgent") return -1;
            if (b.priority === "urgent" && a.priority !== "urgent") return  1;
            return new Date(b.updateTime || 0) - new Date(a.updateTime || 0);
          });
          return merged.slice(0, 5);
        } catch {
          return announcements.slice(0, 5);
        }
      })(),
      upcomingDeadlines: deadlines.slice(0, 5),
      courses,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// POST /api/classroom/refresh — manually bust user cache
router.post("/refresh", authenticateToken, (req, res) => {
  clearUserCache(req.user.id);
  res.json({ message: "Cache cleared. Next request will fetch fresh data." });
});

module.exports = router;