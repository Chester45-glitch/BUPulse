const express = require("express");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { getCourses, getAllDeadlines, getAllAnnouncements } = require("../services/googleClassroom");
const router = express.Router();

// ── In-memory cache ─────────────────────────────────────────────
// Caches Google Classroom responses per user for 3 minutes so
// page loads are instant and we don't hammer the Classroom API.
const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

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
// ────────────────────────────────────────────────────────────────

const getUserTokens = async (userId) => {
  const { data } = await supabase.from("users").select("access_token, refresh_token").eq("id", userId).single();
  return data;
};

router.get("/courses", authenticateToken, async (req, res) => {
  try {
    const cacheKey = `${req.user.id}:courses`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ courses: cached, cached: true });

    const tokens = await getUserTokens(req.user.id);
    const courses = await getCourses(tokens.access_token, tokens.refresh_token);
    setCache(cacheKey, courses);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

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

    // Also prime individual caches so other pages are fast too
    setCache(`${req.user.id}:deadlines`, deadlines);
    setCache(`${req.user.id}:announcements`, announcements);
    setCache(`${req.user.id}:courses`, courses);

    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const result = {
      stats: {
        newAnnouncements: announcements.filter(a => new Date(a.updateTime) >= twoDaysAgo).length,
        upcomingDeadlines: deadlines.filter(d => new Date(d.dueDate) >= now && new Date(d.dueDate) <= in7Days).length,
        urgentAlerts: deadlines.filter(d => new Date(d.dueDate) < now).length,
        totalCourses: courses.length,
      },
      recentAnnouncements: announcements.slice(0, 5),
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

// Manual cache bust — call this after posting a new announcement
router.post("/refresh", authenticateToken, (req, res) => {
  clearUserCache(req.user.id);
  res.json({ message: "Cache cleared. Next request will fetch fresh data." });
});

module.exports = router;
