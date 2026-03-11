const express = require("express");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const createOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

// Step 1: Redirect to Google
router.get("/google", (req, res) => {
  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.announcements.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
  res.json({ url });
});

// Step 2: Handle Google callback
router.get("/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${process.env.FRONTEND_URL}?error=access_denied`);

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    const { data: user, error: dbError } = await supabase
      .from("users")
      .upsert({
        google_id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "google_id" })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return res.redirect(`${process.env.FRONTEND_URL}?error=db_error`);
    }

    const jwtToken = jwt.sign(
      { userId: user.id, googleTokens: { access_token: tokens.access_token, refresh_token: tokens.refresh_token } },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

// Get current user
router.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Logout
router.post("/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logged out" });
});

module.exports = router;
