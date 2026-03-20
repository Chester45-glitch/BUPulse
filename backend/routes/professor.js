const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");
const {
  getTaughtCourses,
  getAllAnnouncements,
  getAllAnnouncementsForCourses,
  createAnnouncement,
  getCourseStudents,
} = require("../services/googleClassroom");

// ── Middleware: professor only ──────────────────────────────────
const professorOnly = (req, res, next) => {
  if (req.user.role !== "professor") {
    return res.status(403).json({ error: "Professor access required" });
  }
  next();
};

const getUserTokens = async (userId) => {
  const { data } = await supabase
    .from("users")
    .select("access_token, refresh_token")
    .eq("id", userId)
    .single();
  return data;
};

// GET /api/professor/courses
router.get("/courses", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token)
      return res.status(401).json({ error: "No access token. Please log in again." });

    const courses = await getTaughtCourses(tokens.access_token, tokens.refresh_token);
    res.json({ courses });
  } catch (err) {
    console.error("Professor courses error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch courses" });
  }
});

// GET /api/professor/announcements
router.get("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token)
      return res.status(401).json({ error: "No access token." });

    const courses = await getTaughtCourses(tokens.access_token, tokens.refresh_token);
    const announcements = await getAllAnnouncementsForCourses(
      courses,
      tokens.access_token,
      tokens.refresh_token
    );
    res.json({ announcements });
  } catch (err) {
    console.error("Professor announcements error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch announcements" });
  }
});

// POST /api/professor/announcements
// Supports single class or multiple classes via courseIds array.
// Body: { courseId?: string, courseIds?: string[], text: string }
router.post("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { courseId, courseIds, text } = req.body;

    // Normalise to array — support both single and multi-select
    const targets = courseIds && courseIds.length > 0
      ? courseIds
      : courseId
        ? [courseId]
        : [];

    if (targets.length === 0)
      return res.status(400).json({ error: "Select at least one class." });

    if (!text?.trim())
      return res.status(400).json({ error: "Announcement text is required." });

    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token)
      return res.status(401).json({ error: "No access token." });

    // Post to every selected course (in parallel)
    const results = await Promise.allSettled(
      targets.map((id) =>
        createAnnouncement(id, text.trim(), tokens.access_token, tokens.refresh_token)
      )
    );

    const succeeded = results
      .map((r, i) => ({ courseId: targets[i], ok: r.status === "fulfilled" }))
      .filter((r) => r.ok)
      .map((r) => r.courseId);

    const failed = results
      .map((r, i) => ({ courseId: targets[i], ok: r.status === "fulfilled" }))
      .filter((r) => !r.ok)
      .map((r) => r.courseId);

    res.json({
      success: succeeded.length > 0,
      posted: succeeded.length,
      failed: failed.length,
      failedIds: failed,
      message:
        failed.length === 0
          ? `✅ Posted to ${succeeded.length} class${succeeded.length !== 1 ? "es" : ""}.`
          : `⚠️ Posted to ${succeeded.length}, failed on ${failed.length}.`,
    });
  } catch (err) {
    console.error("Post announcement error:", err.message);
    res.status(500).json({ error: err.message || "Failed to post announcement" });
  }
});

// GET /api/professor/courses/:courseId/students
router.get(
  "/courses/:courseId/students",
  authenticateToken,
  professorOnly,
  async (req, res) => {
    try {
      const tokens = await getUserTokens(req.user.id);
      const students = await getCourseStudents(
        req.params.courseId,
        tokens.access_token,
        tokens.refresh_token
      );
      res.json({ students });
    } catch (err) {
      console.error("Get students error:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch students" });
    }
  }
);

module.exports = router;
