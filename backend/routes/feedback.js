/**
 * routes/feedback.js
 * ══════════════════════════════════════════════════════════════════
 * Receives feedback from any logged-in user (student, professor,
 * parent) and emails it to the developer.
 *
 * POST /api/feedback
 */

const express = require("express");
const router  = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { sendEmail } = require("../services/gmail");

// Developer email — set this in your .env
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "bupulse.dev@gmail.com";

const CATEGORY_LABELS = {
  bug:        "🐛 Bug Report",
  suggestion: "💡 Suggestion",
  praise:     "🌟 Praise",
  general:    "💬 General Feedback",
};

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { category = "general", message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Feedback message is required." });
    }

    // Get full user record for email sending
    const { data: userRow } = await supabase
      .from("users")
      .select("id, name, email, role, access_token, refresh_token")
      .eq("id", req.user.id)
      .single();

    if (!userRow) return res.status(404).json({ error: "User not found." });

    // Save to DB
    await supabase.from("feedback").insert({
      user_id:    userRow.id,
      user_name:  userRow.name,
      user_email: userRow.email,
      user_role:  userRow.role,
      category,
      message:    message.trim(),
    });

    // Send email to developer
    if (userRow.access_token) {
      const catLabel = CATEGORY_LABELS[category] || "💬 Feedback";
      const roleLabel = { student:"Student", professor:"Professor", parent:"Parent" }[userRow.role] || userRow.role;
      const subject  = `[BUPulse Feedback] ${catLabel} from ${userRow.name}`;

      const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1e40af;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
    <h2 style="margin:0">📬 BUPulse Feedback Received</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:6px 0;color:#6b7280;width:110px">From</td><td style="padding:6px 0;font-weight:600">${userRow.name}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0">${userRow.email}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Role</td><td style="padding:6px 0">${roleLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Category</td><td style="padding:6px 0">${catLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Submitted</td><td style="padding:6px 0">${new Date().toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</td></tr>
    </table>
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Message</div>
      <div style="font-size:15px;color:#1e293b;line-height:1.6;white-space:pre-wrap">${message.trim()}</div>
    </div>
    <p style="color:#94a3b8;font-size:11px;margin-top:20px">You can reply directly to this email to respond to the user.</p>
  </div>
</div>`;

      await sendEmail(
        userRow.access_token,
        userRow.refresh_token,
        DEVELOPER_EMAIL,
        subject,
        html
      ).catch(e => console.error("[feedback] email error:", e.message));
    }

    res.json({ success: true, message: "Thank you for your feedback!" });
  } catch (err) {
    console.error("[feedback] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
