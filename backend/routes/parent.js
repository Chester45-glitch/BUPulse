const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const supabase = require("../db/supabase");

// Parent links to a student email
router.post("/link-student", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "parent") return res.status(403).json({ error: "Parent access required" });
    const { studentEmail } = req.body;
    if (!studentEmail) return res.status(400).json({ error: "studentEmail required" });

    // Find student in DB
    const { data: student } = await supabase.from("users").select("id, name, email, picture").eq("email", studentEmail).eq("role", "student").single();
    if (!student) return res.status(404).json({ error: "Student not found. They must log in to BUPulse first." });

    // Save parent-student link
    await supabase.from("parent_links").upsert({ parent_id: req.user.userId, student_id: student.id }, { onConflict: "parent_id,student_id" });

    res.json({ student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get linked students
router.get("/students", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "parent") return res.status(403).json({ error: "Parent access required" });
    const { data: links } = await supabase
      .from("parent_links")
      .select("student:student_id(id, name, email, picture)")
      .eq("parent_id", req.user.userId);
    res.json({ students: (links || []).map(l => l.student) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student's data (parent view)
router.get("/student/:studentId/data", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    // Verify parent is linked to this student
    const { data: link } = await supabase.from("parent_links")
      .select("id").eq("parent_id", req.user.userId).eq("student_id", req.params.studentId).single();
    if (!link) return res.status(403).json({ error: "Not linked to this student" });

    // Get student tokens
    const { data: student } = await supabase.from("users")
      .select("access_token, refresh_token, name, email, picture").eq("id", req.params.studentId).single();

    const { getAllDeadlines, getAllAnnouncements, getCourses } = require("../services/googleClassroom");
    const [deadlines, announcements, courses] = await Promise.all([
      getAllDeadlines(student.access_token, student.refresh_token),
      getAllAnnouncements(student.access_token, student.refresh_token),
      getCourses(student.access_token, student.refresh_token),
    ]);

    const now = new Date();
    res.json({
      student: { name: student.name, email: student.email, picture: student.picture },
      stats: {
        totalCourses: courses.length,
        overdueCount: deadlines.filter(d => new Date(d.dueDate) < now).length,
        upcomingCount: deadlines.filter(d => new Date(d.dueDate) >= now).length,
        newAnnouncements: announcements.filter(a => {
          const h = (Date.now() - new Date(a.updateTime)) / 3600000;
          return h < 48;
        }).length,
      },
      deadlines,
      announcements: announcements.slice(0, 10),
      courses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
