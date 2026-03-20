const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { google } = require("googleapis");
const {
  getTaughtCourses,
  getAllAnnouncementsForCourses,
  createAnnouncement,
  getCourseStudents,
} = require("../services/googleClassroom");

// ── Middleware ───────────────────────────────────────────────────
const professorOnly = (req, res, next) => {
  if (req.user.role !== "professor")
    return res.status(403).json({ error: "Professor access required" });
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

// ── Drive client ──────────────────────────────────────────────────
const createDriveClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
};

// ── Classroom client with Drive file attachment ───────────────────
const createClassroomClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.classroom({ version: "v1", auth });
};

// ── POST announcement with optional Drive file attachments ────────
const postAnnouncementWithAttachments = async (courseId, text, driveFiles, accessToken, refreshToken) => {
  const classroom = createClassroomClient(accessToken, refreshToken);

  const materials = (driveFiles || []).map((f) => ({
    driveFile: {
      driveFile: { id: f.driveFileId, title: f.fileName },
      shareMode: "VIEW",
    },
  }));

  const res = await classroom.courses.announcements.create({
    courseId,
    requestBody: {
      text,
      state: "PUBLISHED",
      materials: materials.length > 0 ? materials : undefined,
    },
  });
  return res.data;
};

// ── GET /api/professor/courses ────────────────────────────────────
router.get("/courses", authenticateToken, professorOnly, async (req, res) => {
  try {
    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token)
      return res.status(401).json({ error: "No access token. Please log in again." });
    const courses = await getTaughtCourses(tokens.access_token, tokens.refresh_token);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch courses" });
  }
});

// ── GET /api/professor/announcements ─────────────────────────────
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
    res.status(500).json({ error: err.message || "Failed to fetch announcements" });
  }
});

// ── POST /api/professor/announcements ────────────────────────────
// Body: {
//   courseIds: string[],      — required
//   text: string,             — required
//   driveFiles?: [{ driveFileId, fileName, fileType, driveFileUrl }]
// }
router.post("/announcements", authenticateToken, professorOnly, async (req, res) => {
  try {
    const { courseId, courseIds, text, driveFiles = [] } = req.body;
    const targets = courseIds?.length > 0 ? courseIds : courseId ? [courseId] : [];

    if (targets.length === 0)
      return res.status(400).json({ error: "Select at least one class." });
    if (!text?.trim())
      return res.status(400).json({ error: "Announcement text is required." });

    const tokens = await getUserTokens(req.user.id);
    if (!tokens?.access_token)
      return res.status(401).json({ error: "No access token." });

    // Post to all selected courses in parallel
    const results = await Promise.allSettled(
      targets.map((id) =>
        postAnnouncementWithAttachments(
          id,
          text.trim(),
          driveFiles,
          tokens.access_token,
          tokens.refresh_token
        )
      )
    );

    // Save attachment metadata to Supabase
    const succeeded = results
      .map((r, i) => ({ r, courseId: targets[i] }))
      .filter(({ r }) => r.status === "fulfilled");

    if (driveFiles.length > 0 && succeeded.length > 0) {
      const rows = succeeded.flatMap(({ r, courseId }) =>
        driveFiles.map((f) => ({
          announcement_id: r.value?.id || "unknown",
          course_id: courseId,
          user_id: req.user.id,
          file_name: f.fileName,
          file_type: f.fileType,
          drive_file_id: f.driveFileId,
          drive_file_url: f.driveFileUrl,
        }))
      );
      const { error: attachErr } = await supabase.from("announcement_attachments").insert(rows);
      if (attachErr) console.error("Attachment save error:", attachErr.message);
    }

    const posted = succeeded.length;
    const failed = targets.length - posted;

    res.json({
      success: posted > 0,
      posted,
      failed,
      message:
        failed === 0
          ? `✅ Posted to ${posted} class${posted !== 1 ? "es" : ""}.`
          : `⚠️ Posted to ${posted}, failed on ${failed}.`,
    });
  } catch (err) {
    console.error("Post announcement error:", err.message);
    res.status(500).json({ error: err.message || "Failed to post announcement" });
  }
});

// ── GET /api/professor/courses/:courseId/students ─────────────────
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
      res.status(500).json({ error: err.message || "Failed to fetch students" });
    }
  }
);

module.exports = router;
