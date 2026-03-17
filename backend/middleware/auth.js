const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const supabase = require("../db/supabase");
const { getTaughtCourses } = require("../services/googleClassroom");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Detect user role based on Google Classroom data
const detectRole = async (accessToken, refreshToken, requestedRole) => {
  // If user explicitly chose parent, use that
  if (requestedRole === "parent") return "parent";

  try {
    // Check if they teach any courses → professor
    const taughtCourses = await getTaughtCourses(accessToken, refreshToken);
    if (taughtCourses.length > 0) {
      // If they have taught courses but requested student, allow student view
      if (requestedRole === "student") return "student";
      return "professor";
    }
    return "student";
  } catch {
    return requestedRole || "student";
  }
};

// Step 1: Redirect to Google with role in state
router.get("/google", (req, res) => {
  const role = req.query.role || "student"; // student | professor | parent
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
      "https://www.googleapis.com/auth/classroom.announcements.readonly",
      "https://www.googleapis.com/auth/classroom.rosters.readonly",
      // Professor scopes
      "https://www.googleapis.com/auth/classroom.announcements",
    ],
    state: role, // pass role through OAuth flow
  });
  res.redirect(authUrl);
});

// Step 2: Handle callback
router.get("/google/callback", async (req, res) => {
  const { code, state: requestedRole } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Detect role
    const role = await detectRole(tokens.access_token, tokens.refresh_token, requestedRole);

    // Upsert user in Supabase
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
        updated_at: new Date().toISOString(),
      }, { onConflict: "google_id" })
      .select()
      .single();

    if (error) throw error;

    // Sign JWT
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

// Get current user
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });

  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, picture, role")
      .eq("id", decoded.userId)
      .single();

    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ success: true });
});

module.exports = router;
