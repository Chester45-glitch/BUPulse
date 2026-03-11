const express = require("express");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { getCourses, getAllDeadlines, getAllAnnouncements } = require("../services/googleClassroom");

const router = express.Router();

const getUserTokens = async (userId) => {
  const { data } = await supabase.from("users").select("access_token, refresh_token").eq("id", userId).single();
  return data;
};

router.get("/courses", authenticateToken, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    const courses = await getCourses(tokens.access_token, tokens.refresh_token);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

router.get("/deadlines", authenticateToken, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    const deadlines = await getAllDeadlines(tokens.access_token, tokens.refresh_token);
    res.json({ deadlines, total: deadlines.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deadlines" });
  }
});

router.get("/announcements", authenticateToken, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    const announcements = await getAllAnnouncements(tokens.access_token, tokens.refresh_token);
    res.json({ announcements, total: announcements.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    const [deadlines, announcements, courses] = await Promise.all([
      getAllDeadlines(tokens.access_token, tokens.refresh_token),
      getAllAnnouncements(tokens.access_token, tokens.refresh_token),
      getCourses(tokens.access_token, tokens.refresh_token),
    ]);

    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    res.json({
      stats: {
        newAnnouncements: announcements.filter(a => new Date(a.updateTime) >= twoDaysAgo).length,
        upcomingDeadlines: deadlines.filter(d => new Date(d.dueDate) >= now && new Date(d.dueDate) <= in7Days).length,
        urgentAlerts: deadlines.filter(d => new Date(d.dueDate) < now).length,
        totalCourses: courses.length,
      },
      recentAnnouncements: announcements.slice(0, 5),
      upcomingDeadlines: deadlines.slice(0, 5),
      courses,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
