const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { Readable } = require("stream");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");

// ── Google Drive client factory ──────────────────────────────────
const createDriveClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
};

// ── Buffer → Readable stream ─────────────────────────────────────
// Readable.from() is the safe cross-version way to stream a buffer
const bufferToStream = (buffer) => Readable.from(buffer);

// ── POST /api/upload/drive ────────────────────────────────────────
// Body: { fileName, fileType, fileData (base64), announcementContext? }
// Returns: { driveFileId, driveFileUrl, fileName, fileType, fileSize }
router.post("/drive", authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, fileData } = req.body;

    if (!fileName || !fileType || !fileData) {
      return res.status(400).json({ error: "fileName, fileType, and fileData are required." });
    }

    // Decode base64
    const buffer = Buffer.from(fileData, "base64");
    const fileSize = buffer.length;

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (fileSize > MAX_SIZE) {
      return res.status(400).json({ error: "File exceeds 10 MB limit." });
    }

    // Get user tokens
    const { data: user } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("id", req.user.id)
      .single();

    if (!user?.access_token) {
      return res.status(401).json({ error: "No Google access token. Please log in again." });
    }

    const drive = createDriveClient(user.access_token, user.refresh_token);

    // Upload to Drive
    const driveRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: fileType,
      },
      media: {
        mimeType: fileType,
        body: bufferToStream(buffer),
      },
      fields: "id, webViewLink, webContentLink",
    });

    const driveFileId  = driveRes.data.id;
    const driveFileUrl = driveRes.data.webViewLink;

    // Make file readable by anyone with the link
    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    res.json({
      driveFileId,
      driveFileUrl,
      fileName,
      fileType,
      fileSize,
    });
  } catch (err) {
    console.error("Drive upload error:", err.message);
    // Surface the actual Google API error so the frontend can show it
    const message = err.response?.data?.error?.message
      || err.message
      || "Upload failed.";
    // Scope error — user needs to re-login
    if (message.includes("insufficient") || err.status === 403) {
      return res.status(403).json({ error: "Missing Drive permission. Please log out and log back in, then try again." });
    }
    res.status(500).json({ error: message });
  }
});

// ── POST /api/upload/chat ─────────────────────────────────────────
// Store a file URL reference alongside a chat message (after uploading to Drive)
// Body: { driveFileId, driveFileUrl, fileName, fileType }
router.post("/chat", authenticateToken, async (req, res) => {
  const { driveFileUrl, fileName, fileType } = req.body;
  if (!driveFileUrl || !fileName) {
    return res.status(400).json({ error: "driveFileUrl and fileName are required." });
  }
  res.json({ driveFileUrl, fileName, fileType });
});

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
    res.json({ success: true });
  } catch (err) {
    console.error("Drive delete error:", err.message);
    res.status(500).json({ error: "Failed to delete file." });
  }
});

module.exports = router;
