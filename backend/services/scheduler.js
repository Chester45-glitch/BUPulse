const cron = require("node-cron");
const supabase = require("../db/supabase");
const { getAllDeadlines } = require("./googleClassroom");
const { sendEmail, deadlineTemplate, noCourseworkTemplate, overdueTemplate, logNotification, wasRecentlySent } = require("./gmail");

const checkDeadlinesForUser = async (user) => {
  if (!user.access_token) return;

  const now = new Date();
  const deadlines = await getAllDeadlines(user.access_token, user.refresh_token);
  const upcoming = [];
  const overdue = [];

  for (const d of deadlines) {
    const dueDate = new Date(d.dueDate);
    const diffDays = Math.ceil((dueDate - now) / 86400000);
    if (diffDays < 0) overdue.push({ ...d, daysOverdue: Math.abs(diffDays) });
    else if (diffDays <= 3) upcoming.push({ ...d, daysUntilDue: diffDays });
  }

  const firstName = user.name?.split(" ")[0] || "Student";

  if (upcoming.length > 0) {
    const key = `deadline-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "deadline_reminder", key, 20)) {
      await sendEmail(user.access_token, user.refresh_token, user.email,
        `📚 BUPulse: ${upcoming.length} upcoming deadline${upcoming.length>1?"s":""}`,
        deadlineTemplate(firstName, upcoming));
      await logNotification(user.id, "deadline_reminder", { reference_key: key, count: upcoming.length });
      console.log(`  ✉️  Deadline reminder → ${user.email}`);
    }
  }

  if (overdue.length > 0) {
    const key = `overdue-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "overdue_alert", key, 20)) {
      await sendEmail(user.access_token, user.refresh_token, user.email,
        `⚠️ BUPulse: ${overdue.length} overdue assignment${overdue.length>1?"s":""}`,
        overdueTemplate(firstName, overdue));
      await logNotification(user.id, "overdue_alert", { reference_key: key, count: overdue.length });
      console.log(`  ⚠️  Overdue alert → ${user.email}`);
    }
  }

  const futureWork = deadlines.filter(d => {
    const days = Math.ceil((new Date(d.dueDate) - now) / 86400000);
    return days >= 0 && days <= 7;
  });

  if (futureWork.length === 0) {
    const key = `no-work-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "no_coursework", key, 48)) {
      await sendEmail(user.access_token, user.refresh_token, user.email,
        `🎉 BUPulse: No upcoming coursework — you're all caught up!`,
        noCourseworkTemplate(firstName));
      await logNotification(user.id, "no_coursework", { reference_key: key });
      console.log(`  🎉  No-coursework notice → ${user.email}`);
    }
  }
};

const checkAll = async () => {
  console.log(`[${new Date().toISOString()}] 🔔 Running deadline check...`);
  const { data: users } = await supabase.from("users")
    .select("id, email, name, access_token, refresh_token, notifications_enabled")
    .eq("notifications_enabled", true).not("access_token", "is", null);

  if (!users?.length) return;
  for (const user of users) {
    try { await checkDeadlinesForUser(user); }
    catch (e) { console.error(`Error for ${user.email}:`, e.message); }
  }
  console.log(`[${new Date().toISOString()}] ✅ Done.`);
};

const startScheduler = () => {
  cron.schedule("0 7 * * *", checkAll, { timezone: "Asia/Manila" });
  cron.schedule("0 17 * * *", checkAll, { timezone: "Asia/Manila" });
  console.log("📅 Scheduler started: checks at 7:00 AM and 5:00 PM (Asia/Manila)");
};

module.exports = { startScheduler, checkDeadlinesForUser, checkAll };
