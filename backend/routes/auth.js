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
  // MOBILE PATCH: encode mobile_redirect into state param
  const mobileRedirect = req.query.mobile_redirect || null;
  const state = mobileRedirect
    ? JSON.stringify({ role, mobile_redirect: mobileRedirect })
    : role;

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
    state,
  });
  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code, state: rawState } = req.query;

  // MOBILE PATCH: decode state to get role and mobile_redirect
  let requestedRole = "student";
  let mobileRedirect = null;
  try {
    const parsed = JSON.parse(rawState);
    requestedRole = parsed.role || "student";
    mobileRedirect = parsed.mobile_redirect || null;
  } catch {
    requestedRole = rawState || "student";
  }

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
      const errUrl = mobileRedirect
        ? `${mobileRedirect}?error=account_deleted`
        : `${process.env.FRONTEND_URL}/?error=account_deleted`;
      return res.redirect(errUrl);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // MOBILE PATCH: if mobile app login, redirect to deep link with token
    if (mobileRedirect) {
      return res.redirect(`${mobileRedirect}?token=${token}`);
    }

    // Web login stays the same
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("Auth error:", err);
    const errUrl = mobileRedirect
      ? `${mobileRedirect}?error=auth_failed`
      : `${process.env.FRONTEND_URL}/?error=auth_failed`;
    res.redirect(errUrl);
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
      .update({ deleted_at: new Date().toISOString(), access_token: null, refresh_token: null, notifications_enabled: false })
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
