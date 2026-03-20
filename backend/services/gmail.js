const { google } = require("googleapis");
const supabase = require("../db/supabase");

// ── Gmail client ─────────────────────────────────────────────────
const createGmailClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
};

// ── RFC 2047 subject encoding (fixes emoji garbling in Gmail) ────
const encodeSubject = (subject) =>
  `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;

const encodeEmail = (to, subject, htmlBody) => {
  const email = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join("\r\n");
  return Buffer.from(email).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const sendEmail = async (accessToken, refreshToken, to, subject, htmlBody) => {
  const gmail = createGmailClient(accessToken, refreshToken);
  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeEmail(to, subject, htmlBody) },
  });
};

// ══════════════════════════════════════════════════════════════════
// SHARED LAYOUT — wraps every email in a consistent frame
// ══════════════════════════════════════════════════════════════════
const layout = (accentColor, headerContent, bodyContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>BUPulse</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:${accentColor};padding:28px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Bicol University Polangui</p>
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.3px;">BUPulse</h1>
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 16px;display:inline-block;">
                  ${headerContent}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 36px;">
          ${bodyContent}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8faf8;padding:20px 36px;border-top:1px solid #e8f0e8;">
          <p style="margin:0;font-size:12px;color:#9aab9a;text-align:center;">
            You're receiving this because you enabled email notifications in BUPulse.
            <br/>
            <a href="${process.env.FRONTEND_URL}/profile" style="color:#4a7a4a;text-decoration:none;">Manage notification settings</a>
            &nbsp;·&nbsp;
            <a href="${process.env.FRONTEND_URL}/dashboard" style="color:#4a7a4a;text-decoration:none;">Open BUPulse</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

// ── Status badge helper ───────────────────────────────────────────
const badge = (text, color, bg) =>
  `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.3px;">${text}</span>`;

// ── CTA button helper ─────────────────────────────────────────────
const ctaBtn = (text, url, color) =>
  `<div style="text-align:center;margin-top:28px;">
    <a href="${url}" style="background:${color};color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;letter-spacing:-0.2px;">${text}</a>
  </div>`;

// ══════════════════════════════════════════════════════════════════
// 1. DEADLINE REMINDER
// ══════════════════════════════════════════════════════════════════
const deadlineTemplate = (name, assignments) => {
  const rows = assignments.map((a) => {
    const color = a.daysUntilDue === 0 ? "#dc2626" : a.daysUntilDue <= 1 ? "#d97706" : "#16a34a";
    const due   = a.daysUntilDue === 0 ? "Due TODAY" : a.daysUntilDue === 1 ? "Due TOMORROW" : `${a.daysUntilDue} days left`;
    return `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #f0f4f0;font-size:14px;color:#374151;">${a.courseName}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #f0f4f0;font-size:14px;font-weight:600;color:#111827;">${a.title}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #f0f4f0;">
        ${badge(due, color, color + "18")}
      </td>
    </tr>`;
  }).join("");

  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111827;">Hey ${name}, heads up! 📋</p>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">You have <strong style="color:#111827;">${assignments.length} upcoming deadline${assignments.length > 1 ? "s" : ""}</strong> coming up. Don't let them sneak up on you!</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8f0e8;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
      <thead>
        <tr style="background:#f0f7f0;">
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#4a7a4a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8f0e8;">Course</th>
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#4a7a4a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8f0e8;">Assignment</th>
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#4a7a4a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8f0e8;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">Stay on top of your work — kaya mo yan! 💪</p>
    ${ctaBtn("Open Pending Activities →", `${process.env.FRONTEND_URL}/pending-activities`, "#1a3320")}`;

  return layout(
    "linear-gradient(135deg,#1a3320 0%,#2d5a1b 100%)",
    `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;">📋 Deadlines</p>`,
    body
  );
};

// ══════════════════════════════════════════════════════════════════
// 2. OVERDUE ALERT
// ══════════════════════════════════════════════════════════════════
const overdueTemplate = (name, assignments) => {
  const items = assignments.map((a) => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #fee2e2;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${a.title}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${a.courseName}</p>
      </td>
      <td style="padding:11px 14px;border-bottom:1px solid #fee2e2;text-align:right;white-space:nowrap;">
        ${badge(`${a.daysOverdue}d overdue`, "#dc2626", "#fee2e2")}
      </td>
    </tr>`).join("");

  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111827;">Action needed, ${name}! ⚠️</p>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">You have <strong style="color:#dc2626;">${assignments.length} overdue assignment${assignments.length > 1 ? "s" : ""}</strong>. Submit them as soon as possible to avoid further penalties.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fee2e2;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;background:#fff5f5;">
      <tbody>${items}</tbody>
    </table>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-top:20px;">
      <p style="margin:0;font-size:13.5px;color:#9a3412;">💡 <strong>Tip:</strong> Talk to your professor if you need an extension — it's better to communicate early than to let work pile up.</p>
    </div>
    ${ctaBtn("View Overdue Work →", `${process.env.FRONTEND_URL}/pending-activities`, "#dc2626")}`;

  return layout(
    "linear-gradient(135deg,#b91c1c 0%,#dc2626 100%)",
    `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;">🚨 Overdue Alert</p>`,
    body
  );
};

// ══════════════════════════════════════════════════════════════════
// 3. ALL CAUGHT UP
// ══════════════════════════════════════════════════════════════════
const noCourseworkTemplate = (name) => {
  const body = `
    <div style="text-align:center;padding:16px 0;">
      <div style="font-size:52px;margin-bottom:16px;">🎉</div>
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">You're all caught up, ${name}!</p>
      <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">No upcoming coursework in the next 7 days. This is a great time to review past lessons, get ahead, or simply take a well-deserved break.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 24px;text-align:left;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Suggestions while you're ahead</p>
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.8;">
          <li>Review your most recent class materials</li>
          <li>Prepare questions for your next class</li>
          <li>Check your professor's announcements for upcoming topics</li>
        </ul>
      </div>
    </div>
    ${ctaBtn("Open Dashboard →", `${process.env.FRONTEND_URL}/dashboard`, "#1a3320")}`;

  return layout(
    "linear-gradient(135deg,#1a3320 0%,#16a34a 100%)",
    `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;">✅ All Clear</p>`,
    body
  );
};

// ══════════════════════════════════════════════════════════════════
// 4. NEW ANNOUNCEMENT  ← NEW TEMPLATE
// ══════════════════════════════════════════════════════════════════
const announcementTemplate = (name, announcements) => {
  const TYPE_COLORS = {
    ANNOUNCEMENT: { color: "#166534", bg: "#f0fdf4", label: "Announcement" },
    MATERIAL:     { color: "#0369a1", bg: "#eff6ff", label: "Material"     },
    QUIZ:         { color: "#6b21a8", bg: "#faf5ff", label: "Quiz"         },
  };

  const cards = announcements.map((a) => {
    const cfg = TYPE_COLORS[a.type] || TYPE_COLORS.ANNOUNCEMENT;
    const preview = a.text?.length > 180 ? a.text.slice(0, 180) + "…" : (a.text || "");
    return `
    <tr>
      <td style="padding:0 0 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:separate;">
          <tr>
            <td style="background:#f9fafb;padding:10px 16px;border-bottom:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td><p style="margin:0;font-size:13px;font-weight:700;color:#374151;">${a.courseName || "Unknown class"}</p></td>
                  <td align="right">${badge(cfg.label, cfg.color, cfg.bg)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;background:#fff;">
              ${a.title ? `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">${a.title}</p>` : ""}
              ${preview ? `<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${preview}</p>` : ""}
              ${a.link ? `<p style="margin:10px 0 0;"><a href="${a.link}" style="font-size:13px;color:#1a3320;font-weight:600;text-decoration:none;">Open in Classroom →</a></p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const count = announcements.length;
  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111827;">New post${count > 1 ? "s" : ""} in your classes, ${name}! 📢</p>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      ${count === 1
        ? "Your professor just posted something new."
        : `${count} new posts were made across your classes.`}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${cards}
    </table>
    ${ctaBtn("View All Announcements →", `${process.env.FRONTEND_URL}/announcements`, "#1a3320")}`;

  return layout(
    "linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%)",
    `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;">📢 New Post${count > 1 ? "s" : ""}</p>`,
    body
  );
};

// ── Notification log helpers ──────────────────────────────────────
const logNotification = async (userId, type, metadata) => {
  await supabase.from("notification_logs").insert({
    user_id: userId,
    notification_type: type,
    metadata,
    sent_at: new Date().toISOString(),
  });
};

const wasRecentlySent = async (userId, type, refKey, hours = 24) => {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const { data } = await supabase.from("notification_logs")
    .select("id").eq("user_id", userId).eq("notification_type", type)
    .contains("metadata", { reference_key: refKey })
    .gte("sent_at", since).limit(1);
  return data && data.length > 0;
};

module.exports = {
  sendEmail,
  deadlineTemplate,
  noCourseworkTemplate,
  overdueTemplate,
  announcementTemplate,
  logNotification,
  wasRecentlySent,
};
