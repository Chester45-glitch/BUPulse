const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { getAllDeadlines, getAllAnnouncements, getCourses } = require("../services/googleClassroom");

const parentOnly = (req, res, next) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ error: "Parent access required" });
  }
  next();
};

// Link a student by email
// Works even if student hasn't logged into BUPulse yet
router.post("/link-student", authenticateToken, parentOnly, async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!studentEmail?.trim()) {
      return res.status(400).json({ error: "Student email is required" });
    }

    const email = studentEmail.trim().toLowerCase();

    // Check if student exists in our DB
    const { data: student } = await supabase
      .from("users")
      .select("id, name, email, picture, role")
      .eq("email", email)
      .single();

    if (student) {
      // Student exists - link them
      const { error: linkError } = await supabase
        .from("parent_links")
        .upsert(
          { parent_id: req.user.id, student_id: student.id, student_email: email },
          { onConflict: "parent_id,student_email" }
        );

      if (linkError) throw linkError;
      return res.json({ student, message: "Student linked successfully" });
    } else {
      // Student hasn't logged in yet - store email link for when they do
      const { error: linkError } = await supabase
        .from("parent_links")
        .upsert(
          { parent_id: req.user.id, student_email: email, student_id: null },
          { onConflict: "parent_id,student_email" }
        );

      if (linkError) throw linkError;
      return res.json({
        student: null,
        pending: true,
        email,
        message: "Student email saved. Data will be available once they log into BUPulse.",
      });
    }
  } catch (err) {
    console.error("Link student error:", err.message);
    res.status(500).json({ error: err.message || "Failed to link student" });
  }
});

// Get all linked students
router.get("/students", authenticateToken, parentOnly, async (req, res) => {
  try {
    const { data: links, error } = await supabase
      .from("parent_links")
      .select("id, student_email, student_id, student:student_id(id, name, email, picture, role)")
      .eq("parent_id", req.user.id);

    if (error) throw error;

    const students = (links || []).map(l => ({
      linkId: l.id,
      email: l.student_email,
      pending: !l.student_id,
      ...(l.student || { name: l.student_email, picture: null }),
    }));

    res.json({ students });
  } catch (err) {
    console.error("Get students error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch students" });
  }
});

// Get student data for parent view
router.get("/student/:studentId/data", authenticateToken, parentOnly, async (req, res) => {
  try {
    // Verify parent is linked to this student
    const { data: link } = await supabase
      .from("parent_links")
      .select("id")
      .eq("parent_id", req.user.id)
      .eq("student_id", req.params.studentId)
      .single();

    if (!link) {
      return res.status(403).json({ error: "Not linked to this student" });
    }

    // Get student's tokens
    const { data: student, error: studentError } = await supabase
      .from("users")
      .select("id, name, email, picture, access_token, refresh_token")
      .eq("id", req.params.studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (!student.access_token) {
      return res.status(400).json({ error: "Student has not granted access yet. Ask them to log into BUPulse." });
    }

    // Fetch all data in parallel using student's tokens
    const [deadlines, announcements, courses] = await Promise.all([
      getAllDeadlines(student.access_token, student.refresh_token).catch(() => []),
      getAllAnnouncements(student.access_token, student.refresh_token).catch(() => []),
      getCourses(student.access_token, student.refresh_token).catch(() => []),
    ]);

    const now = new Date();
    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        picture: student.picture,
      },
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
      announcements: announcements.slice(0, 20),
      courses,
    });
  } catch (err) {
    console.error("Get student data error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch student data" });
  }
});

// Remove linked student
router.delete("/students/:linkId", authenticateToken, parentOnly, async (req, res) => {
  try {
    await supabase.from("parent_links").delete().eq("id", req.params.linkId).eq("parent_id", req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove student" });
  }
});

module.exports = router;
