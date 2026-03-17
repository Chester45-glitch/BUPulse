const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { getTaughtCourses, getAllAnnouncements, createAnnouncement, getCourseStudents } = require("../services/googleClassroom");

// Middleware: professor only
const professorOnly = (req, res, next) => {
  if (req.user.role !== "professor") return res.status(403).json({ error: "Professor access required" });
  next();
};

// Get professor's taught courses
router.get("/courses", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { data: user } = await supabase.from("users").select("access_token, refresh_token").eq("id", req.user.userId).single();
    const courses = await getTaughtCourses(user.access_token, user.refresh_token);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get professor's announcements
router.get("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { data: user } = await supabase.from("users").select("access_token, refresh_token").eq("id", req.user.userId).single();
    const courses = await getTaughtCourses(user.access_token, user.refresh_token);
    const { getAllAnnouncements: getAnns } = require("../services/googleClassroom");
    const announcements = await getAnns(user.access_token, user.refresh_token);
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create announcement
router.post("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { courseId, text } = req.body;
    if (!courseId || !text) return res.status(400).json({ error: "courseId and text required" });
    const { data: user } = await supabase.from("users").select("access_token, refresh_token").eq("id", req.user.userId).single();
    const announcement = await createAnnouncement(courseId, text, user.access_token, user.refresh_token);
    res.json({ announcement });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get students in a course
router.get("/courses/:courseId/students", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { data: user } = await supabase.from("users").select("access_token, refresh_token").eq("id", req.user.userId).single();
    const students = await getCourseStudents(req.params.courseId, user.access_token, user.refresh_token);
    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
