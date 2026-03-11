const { google } = require("googleapis");
const supabase = require("../db/supabase");

const createGmailClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
};

const encodeEmail = (to, subject, htmlBody) => {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join("\r\n");
  return Buffer.from(email).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};

const sendEmail = async (accessToken, refreshToken, to, subject, htmlBody) => {
  const gmail = createGmailClient(accessToken, refreshToken);
  return gmail.users.messages.send({ userId: "me", requestBody: { raw: encodeEmail(to, subject, htmlBody) } });
};

const deadlineTemplate = (name, assignments) => `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f0f4f0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#2d5a1b;padding:24px 32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">📚 BUPulse</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#1a2e1a;font-size:16px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#4a6a4a;">You have <strong>${assignments.length} upcoming deadline${assignments.length>1?"s":""}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f0f7f0;"><th style="padding:10px;text-align:left;color:#2d5a1b;">Course</th><th style="padding:10px;text-align:left;color:#2d5a1b;">Assignment</th><th style="padding:10px;text-align:left;color:#2d5a1b;">Due</th></tr>
      ${assignments.map(a=>`<tr><td style="padding:10px;border-bottom:1px solid #e8f0e8;">${a.courseName}</td><td style="padding:10px;border-bottom:1px solid #e8f0e8;font-weight:600;">${a.title}</td><td style="padding:10px;border-bottom:1px solid #e8f0e8;color:${a.daysUntilDue<=1?"#dc2626":a.daysUntilDue<=3?"#d97706":"#16a34a"};">${a.daysUntilDue===0?"Due TODAY":a.daysUntilDue===1?"Due TOMORROW":`${a.daysUntilDue} days`}</td></tr>`).join("")}
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#2d5a1b;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">View Dashboard →</a>
    </div>
  </div>
</div></body></html>`;

const noCourseworkTemplate = (name) => `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f0f4f0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#2d5a1b;padding:24px 32px;"><h1 style="color:#fff;margin:0;">📚 BUPulse</h1></div>
  <div style="padding:28px 32px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">🎉</div>
    <h2 style="color:#1a2e1a;">You're all caught up, ${name}!</h2>
    <p style="color:#4a6a4a;">No upcoming coursework in the next 7 days. Great time to get ahead!</p>
    <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#2d5a1b;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-top:16px;">View Dashboard →</a>
  </div>
</div></body></html>`;

const overdueTemplate = (name, assignments) => `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f0f4f0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#dc2626;padding:24px 32px;"><h1 style="color:#fff;margin:0;">⚠️ BUPulse Alert</h1></div>
  <div style="padding:28px 32px;">
    <p style="color:#1a2e1a;">Hi <strong>${name}</strong>, you have <strong style="color:#dc2626;">${assignments.length} overdue assignment${assignments.length>1?"s":""}</strong>:</p>
    <ul>${assignments.map(a=>`<li style="padding:6px 0;color:#4a6a4a;"><strong>${a.title}</strong> — ${a.courseName}</li>`).join("")}</ul>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Take Action Now →</a>
    </div>
  </div>
</div></body></html>`;

const logNotification = async (userId, type, metadata) => {
  await supabase.from("notification_logs").insert({ user_id: userId, notification_type: type, metadata, sent_at: new Date().toISOString() });
};

const wasRecentlySent = async (userId, type, refKey, hours = 24) => {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const { data } = await supabase.from("notification_logs")
    .select("id").eq("user_id", userId).eq("notification_type", type)
    .contains("metadata", { reference_key: refKey }).gte("sent_at", since).limit(1);
  return data && data.length > 0;
};

module.exports = { sendEmail, deadlineTemplate, noCourseworkTemplate, overdueTemplate, logNotification, wasRecentlySent };
