const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { Readable } = require("stream");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");

// ── Shared file cache ─────────────────────────────────────────────
// Store file data so the chatbot can extract text for quiz generation.
// Uses a simple module-level Map with 30-min TTL.
const fileCache = new Map();
const cacheFile = (id, data) => {
  fileCache.set(id, { ...data, ts: Date.now() });
  setTimeout(() => fileCache.delete(id), 30 * 60 * 1000);
};
const getCachedFile = (id) => {
  const e = fileCache.get(id);
  if (!e || Date.now() - e.ts > 30 * 60 * 1000) return null;
  return e;
};
// Make cache accessible to chatbot.js via a shared module
const getFileCache = () => fileCache;

// ── Google Drive client ───────────────────────────────────────────
const createDriveClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
};

const bufferToStream = (buffer) => Readable.from(buffer);

// ── POST /api/upload/drive ────────────────────────────────────────
// Body: { fileName, fileType, fileData (base64) }
// Returns: { driveFileId, driveFileUrl, fileName, fileType, fileSize, quizReady }
router.post("/drive", authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, fileData } = req.body;

    if (!fileName || !fileType || !fileData)
      return res.status(400).json({ error: "fileName, fileType, and fileData are required." });

    const buffer = Buffer.from(fileData, "base64");
    const fileSize = buffer.length;

    if (fileSize > 10 * 1024 * 1024)
      return res.status(400).json({ error: "File exceeds 10 MB limit." });

    const { data: user } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("id", req.user.id)
      .single();

    if (!user?.access_token)
      return res.status(401).json({ error: "No Google access token. Please log in again." });

    const drive = createDriveClient(user.access_token, user.refresh_token);

    const driveRes = await drive.files.create({
      requestBody: { name: fileName, mimeType: fileType },
      media: { mimeType: fileType, body: bufferToStream(buffer) },
      fields: "id, webViewLink",
    });

    const driveFileId  = driveRes.data.id;
    const driveFileUrl = driveRes.data.webViewLink;

    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Cache the raw file data for quiz generation (30 min window)
    const quizSupportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const isQuizReady = quizSupportedTypes.includes(fileType) || fileType.startsWith("image/");

    if (isQuizReady) {
      cacheFile(driveFileId, { fileData, fileType, fileName });
    }

    res.json({ driveFileId, driveFileUrl, fileName, fileType, fileSize, quizReady: isQuizReady });
  } catch (err) {
    console.error("Drive upload error:", err.message);
    const message = err.response?.data?.error?.message || err.message || "Upload failed.";
    if (message.includes("insufficient") || err.status === 403)
      return res.status(403).json({ error: "Missing Drive permission. Please log out and log back in." });
    res.status(500).json({ error: message });
  }
});

// ── GET /api/upload/file-data/:fileId ────────────────────────────
// Internal endpoint: retrieve cached file data for quiz generation
router.get("/file-data/:fileId", authenticateToken, (req, res) => {
  const cached = getCachedFile(req.params.fileId);
  if (!cached) return res.status(404).json({ error: "File data not found or expired. Please re-upload the file." });
  res.json({ fileData: cached.fileData, fileType: cached.fileType, fileName: cached.fileName });
});

// Export cache accessor for chatbot.js
module.exports.getFileCache = getFileCache;

// ── DELETE /api/upload/drive/:fileId ─────────────────────────────
router.delete("/drive/:fileId", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("id", req.user.id)
      .single();
    const drive = createDriveClient(user.access_token, user.refresh_token);
    await drive.files.delete({ fileId: req.params.fileId });
    fileCache.delete(req.params.fileId);
    res.json({ success: true });
  } catch (err) {
    console.error("Drive delete error:", err.message);
    res.status(500).json({ error: "Failed to delete file." });
  }
});

// Export cache accessor for quiz generation
router.getFileCache = () => fileCache;

module.exports = router;
