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
    ],
    state: role,
  });
  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code, state: requestedRole } = req.query;
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
        deleted_at: null, // re-activate if soft deleted
        updated_at: new Date().toISOString(),
      }, { onConflict: "google_id" })
      .select()
      .single();

    if (error) throw error;

    // Block soft-deleted accounts
    if (user.deleted_at) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=account_deleted`);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("Auth error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=auth_failed`);
  }
});

// Get current user (includes notifications_enabled)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, picture, role, notifications_enabled")
      .eq("id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ── DELETE /api/auth/account ─────────────────────────────────
// Soft-delete: sets deleted_at timestamp, clears tokens
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Soft-delete the user (keeps row for data integrity)
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

    // 2. Delete linked parent relationships
    await supabase.from("parent_links")
      .delete()
      .or(`parent_id.eq.${userId},student_id.eq.${userId}`);

    // 3. Delete chatbot history
    await supabase.from("chatbot_conversations").delete().eq("user_id", userId);

    // 4. Delete notification logs
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
