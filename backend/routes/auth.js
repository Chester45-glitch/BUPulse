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
  req.session.oauthPlatform = platform;

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
    // Pass role + platform through OAuth state param
    state: `${role}|${platform}`,
  });
  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const [requestedRole, platform] = (state || "student|web").split("|");
  const oauthPlatform = platform || req.session?.oauthPlatform || "web";

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

    // ── Android: serve an HTML bridge page that bounces token into app ──
    // Google only allows https:// redirect URIs, so we can't redirect directly
    // to edu.bicol.bupulse://. Instead we serve a tiny HTML page that
    // immediately opens the deep-link — the Android OS intercepts it and
    // hands control back to the BUPulse app.
    if (oauthPlatform === "android") {
      const deepLink = `edu.bicol.bupulse://auth/callback?token=${token}`;
      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signing you in to BUPulse…</title>
  <style>
    body { margin: 0; display: flex; flex-direction: column; align-items: center;
           justify-content: center; min-height: 100vh; background: #0f2010;
           font-family: system-ui, sans-serif; color: #a8c5a0; gap: 16px; }
    .spinner { width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.15);
               border-top-color: #f59e0b; border-radius: 50%;
               animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 15px; margin: 0; }
    a { color: #4ade80; font-size: 13px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Signing you in to BUPulse…</p>
  <a href="${deepLink}">Tap here if the app doesn't open</a>
  <script>
    // Immediately redirect to the app via deep-link
    window.location.href = "${deepLink}";
    // Fallback: close the browser tab after 3s (Capacitor Browser plugin handles this)
    setTimeout(() => { window.close(); }, 3000);
  </script>
</body>
</html>`);
    }

    // Web: normal redirect to Vercel frontend
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("Auth error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=auth_failed`);
  }
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

router.post("/logout", (req, res) => {
  res.json({ success: true });
});

module.exports = router;
