const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { getTaughtCourses, getAllAnnouncements, createAnnouncement, getCourseStudents } = require("../services/googleClassroom");

// Middleware: professor only
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

// Get professor's taught courses
router.get("/courses", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token) {
      return res.status(401).json({ error: "No access token found. Please log in again." });
    }
    const courses = await getTaughtCourses(tokens.access_token, tokens.refresh_token);
    res.json({ courses });
  } catch (err) {
    console.error("Professor courses error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch courses" });
  }
});

// Get professor's announcements from all taught courses
router.get("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token) {
      return res.status(401).json({ error: "No access token found." });
    }
    // Get announcements from courses they TEACH (not enrolled in)
    const { getAllAnnouncementsForCourses } = require("../services/googleClassroom");
    const courses = await getTaughtCourses(tokens.access_token, tokens.refresh_token);
    const announcements = await getAllAnnouncementsForCourses(courses, tokens.access_token, tokens.refresh_token);
    res.json({ announcements });
  } catch (err) {
    console.error("Professor announcements error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch announcements" });
  }
});

// Post announcement to a course
router.post("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { courseId, text } = req.body;
    if (!courseId || !text?.trim()) {
      return res.status(400).json({ error: "courseId and text are required" });
    }
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token) {
      return res.status(401).json({ error: "No access token found." });
    }
    const announcement = await createAnnouncement(courseId, text.trim(), tokens.access_token, tokens.refresh_token);
    res.json({ announcement });
  } catch (err) {
    console.error("Post announcement error:", err.message);
    res.status(500).json({ error: err.message || "Failed to post announcement" });
  }
});

// Get students in a course
router.get("/courses/:courseId/students", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    const students = await getCourseStudents(req.params.courseId, tokens.access_token, tokens.refresh_token);
    res.json({ students });
  } catch (err) {
    console.error("Get students error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch students" });
  }
});

module.exports = router;
