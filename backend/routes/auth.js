const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const supabase = require("../db/supabase");
const { getTaughtCourses } = require("../services/googleClassroom");
const { authenticateToken } = require("../middleware/auth");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// In-memory token store for mobile polling (auto-clears after 5 min)
const pendingTokens = new Map();
const storePendingToken = (code, token) => {
  pendingTokens.set(code, token);
  setTimeout(() => pendingTokens.delete(code), 5 * 60 * 1000);
};

const detectRole = async (accessToken, refreshToken, requestedRole) => {
  if (requestedRole === "parent") return "parent";
  try {
    const taughtCourses = await getTaughtCourses(accessToken, refreshToken);
    if (taughtCourses.length > 0) {
      if (requestedRole === "student") return "student";
      return "professor";
    }
    return "student";
  } catch {
    return requestedRole || "student";
  }
};

router.get("/google", (req, res) => {
  const role = req.query.role || "student";
  const platform = req.query.platform || "web";
  const loginCode = req.query.code || "";
  req.session.oauthPlatform = platform;
  req.session.loginCode = loginCode;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", prompt: "consent",
    scope: [
      "openid", "profile", "email",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
      "https://www.googleapis.com/auth/classroom.announcements.readonly",
      "https://www.googleapis.com/auth/classroom.announcements",
      "https://www.googleapis.com/auth/classroom.rosters.readonly",
      "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.students",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/forms.body",
    ],
    state: `${role}|${platform}|${loginCode}`,
  });
  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const parts = (state || "student|web|").split("|");
  const requestedRole = parts[0] || "student";
  const oauthPlatform = parts[1] || "web";
  const loginCode = parts[2] || req.session?.loginCode || "";

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    const role = await detectRole(tokens.access_token, tokens.refresh_token, requestedRole);

    const { data: user, error } = await supabase
      .from("users")
      .upsert({
        google_id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        role,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "google_id" })
      .select()
      .single();

    if (error) throw error;
    if (user.deleted_at) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=account_deleted`);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ── Android polling flow ─────────────────────────────────────
    if (oauthPlatform === "android" && loginCode) {
      // Store token so the app can pick it up by polling
      storePendingToken(loginCode, token);

      // Show a success page — the app is polling and will close this automatically
      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login Successful</title>
  <style>
    body { margin:0; display:flex; flex-direction:column; align-items:center;
           justify-content:center; min-height:100vh; background:#0f2010;
           font-family:system-ui,sans-serif; color:#a8c5a0; gap:16px; text-align:center; }
    .check { font-size:56px; }
    p { font-size:16px; margin:0; }
    small { font-size:13px; color:rgba(255,255,255,0.4); margin-top:4px; }
  </style>
</head>
<body>
  <div class="check">✅</div>
  <p>Login successful!</p>
  <small>Returning to BUPulse2026</small>
  <script>
    setTimeout(() => { window.close(); }, 1500);
  </script>
</body>
</html>`);
    }

    // ── Web flow ─────────────────────────────────────────────────
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("Auth error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=auth_failed`);
  }
});

// ── Polling endpoint — app calls this every 2s after opening browser ──
router.get("/poll", (req, res) => {
  const { code } = req.query;
  if (!code) return res.json({ ready: false });
  const token = pendingTokens.get(code);
  if (!token) return res.json({ ready: false });
  pendingTokens.delete(code); // consume it
  res.json({ ready: true, token });
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, picture, role, notifications_enabled, notify_instant")
      .eq("id", req.user.id)
      .is("deleted_at", null)
      .single();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { error: userErr } = await supabase
      .from("users")
      .update({
        deleted_at: new Date().toISOString(),
        access_token: null,
        refresh_token: null,
        notifications_enabled: false,
      })
      .eq("id", userId);
    if (userErr) throw userErr;
    await supabase.from("parent_links").delete().or(`parent_id.eq.${userId},student_id.eq.${userId}`);
    await supabase.from("chatbot_conversations").delete().eq("user_id", userId);
    await supabase.from("notification_logs").delete().eq("user_id", userId);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

router.post("/logout", (req, res) => { res.json({ success: true }); });

module.exports = router;
