const cron = require("node-cron");
const supabase = require("../db/supabase");
const { getAllDeadlines, getAllAnnouncements } = require("./googleClassroom");
const {
  sendEmail,
  deadlineTemplate,
  noCourseworkTemplate,
  overdueTemplate,
  announcementTemplate,
  logNotification,
  wasRecentlySent,
} = require("./gmail");

// ══════════════════════════════════════════════════════════════════
// DEADLINE CHECK (existing — runs at 7AM + 5PM)
// ══════════════════════════════════════════════════════════════════
const checkDeadlinesForUser = async (user) => {
  if (!user.access_token) return;

  const now = new Date();
  let deadlines;
  try {
    deadlines = await getAllDeadlines(user.access_token, user.refresh_token);
  } catch (e) {
    if (e.message?.includes("Insufficient Permission") || e.code === 403) return;
    throw e;
  }
  const upcoming = [];
  const overdue  = [];

  for (const d of deadlines) {
    const dueDate  = new Date(d.dueDate);
    const diffDays = Math.ceil((dueDate - now) / 86400000);
    if (diffDays < 0)     overdue.push({ ...d, daysOverdue: Math.abs(diffDays) });
    else if (diffDays <= 3) upcoming.push({ ...d, daysUntilDue: diffDays });
  }

  const firstName = user.name?.split(" ")[0] || "Student";

  if (upcoming.length > 0) {
    const key = `deadline-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "deadline_reminder", key, 20)) {
      await sendEmail(
        user.access_token, user.refresh_token, user.email,
        `📋 BUPulse: ${upcoming.length} upcoming deadline${upcoming.length > 1 ? "s" : ""}`,
        deadlineTemplate(firstName, upcoming)
      );
      await logNotification(user.id, "deadline_reminder", { reference_key: key, count: upcoming.length });
      console.log(`  ✉️  Deadline reminder → ${user.email}`);
    }
  }

  if (overdue.length > 0) {
    const key = `overdue-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "overdue_alert", key, 20)) {
      await sendEmail(
        user.access_token, user.refresh_token, user.email,
        `🚨 BUPulse: ${overdue.length} overdue assignment${overdue.length > 1 ? "s" : ""}`,
        overdueTemplate(firstName, overdue)
      );
      await logNotification(user.id, "overdue_alert", { reference_key: key, count: overdue.length });
      console.log(`  ⚠️  Overdue alert → ${user.email}`);
    }
  }

  const futureWork = deadlines.filter((d) => {
    const days = Math.ceil((new Date(d.dueDate) - now) / 86400000);
    return days >= 0 && days <= 7;
  });

  if (futureWork.length === 0) {
    const key = `no-work-${now.toDateString()}`;
    if (!await wasRecentlySent(user.id, "no_coursework", key, 48)) {
      await sendEmail(
        user.access_token, user.refresh_token, user.email,
        `🎉 BUPulse: You're all caught up — no upcoming coursework!`,
        noCourseworkTemplate(firstName)
      );
      await logNotification(user.id, "no_coursework", { reference_key: key });
      console.log(`  🎉  No-coursework notice → ${user.email}`);
    }
  }
};

// ══════════════════════════════════════════════════════════════════
// ANNOUNCEMENT CHECK — detects NEW posts since last check
// Used by both the scheduler (every 30 min) and instant notifications
// ══════════════════════════════════════════════════════════════════

// Get the timestamp of the last announcement notification sent to this user
const getLastAnnouncementCheck = async (userId) => {
  const { data } = await supabase
    .from("notification_logs")
    .select("sent_at, metadata")
    .eq("user_id", userId)
    .eq("notification_type", "announcement_notify")
    .order("sent_at", { ascending: false })
    .limit(1);

  if (!data?.length) {
    // First time — use 24 hours ago as baseline so we don't spam on first run
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
  return new Date(data[0].sent_at);
};

// Core function: check for new announcements and email if found
const checkAnnouncementsForUser = async (user) => {
  if (!user.access_token) return;

  const lastCheck = await getLastAnnouncementCheck(user.id);

  let announcements;
  try {
    announcements = await getAllAnnouncements(user.access_token, user.refresh_token);
  } catch (e) {
    // Insufficient Permission = token expired or scope not granted yet.
    // Skip silently — will retry on next scheduled run.
    if (e.message?.includes("Insufficient Permission") || e.code === 403) return;
    throw e; // re-throw unexpected errors
  }

  // Find announcements newer than last check
  const newAnnouncements = announcements.filter(
    (a) => new Date(a.updateTime || a.creationTime) > lastCheck
  );

  if (newAnnouncements.length === 0) return;

  // Deduplicate by announcement ID to avoid double-sending
  const refKey = `ann-${newAnnouncements.map((a) => a.id).sort().join("-")}`;
  if (await wasRecentlySent(user.id, "announcement_notify", refKey, 1)) return;

  const firstName = user.name?.split(" ")[0] || "Student";

  await sendEmail(
    user.access_token,
    user.refresh_token,
    user.email,
    `📢 BUPulse: ${newAnnouncements.length} new post${newAnnouncements.length > 1 ? "s" : ""} in your classes`,
    announcementTemplate(firstName, newAnnouncements.slice(0, 5))
  );

  await logNotification(user.id, "announcement_notify", {
    reference_key: refKey,
    count: newAnnouncements.length,
    announcement_ids: newAnnouncements.map((a) => a.id),
  });

  console.log(`  📢  Announcement notify (${newAnnouncements.length} new) → ${user.email}`);
};

// ── Run deadline check for ALL notification-enabled users ─────────
const checkAll = async () => {
  console.log(`[${new Date().toISOString()}] 🔔 Running scheduled checks...`);

  const { data: users } = await supabase
    .from("users")
    .select("id, email, name, access_token, refresh_token, notifications_enabled, notify_instant")
    .eq("notifications_enabled", true)
    .not("access_token", "is", null);

  if (!users?.length) return;

  for (const user of users) {
    try {
      await checkDeadlinesForUser(user);

      // For non-instant users, the scheduler also handles announcement checks
      // (instant users get them in real-time via triggerInstantAnnouncementCheck)
      if (!user.notify_instant) {
        await checkAnnouncementsForUser(user);
      }
    } catch (e) {
      console.error(`Error for ${user.email}:`, e.message);
    }
  }

  console.log(`[${new Date().toISOString()}] ✅ Done.`);
};

// ══════════════════════════════════════════════════════════════════
// INSTANT ANNOUNCEMENT CHECK
// Called from classroom route when a user refreshes their stream.
// Only runs for users who have notify_instant = true.
// ══════════════════════════════════════════════════════════════════
const triggerInstantAnnouncementCheck = async (userId) => {
  const { data: user } = await supabase
    .from("users")
    .select("id, email, name, access_token, refresh_token, notifications_enabled, notify_instant")
    .eq("id", userId)
    .single();

  if (!user || !user.notifications_enabled || !user.notify_instant || !user.access_token) return;

  // Run in background — don't block the API response
  checkAnnouncementsForUser(user).catch((e) =>
    console.error(`Instant announcement check error for ${user.email}:`, e.message)
  );
};

// ── Cron schedule ─────────────────────────────────────────────────
const startScheduler = () => {
  // Deadlines: 7AM and 5PM (existing)
  cron.schedule("0 7 * * *",  checkAll, { timezone: "Asia/Manila" });
  cron.schedule("0 17 * * *", checkAll, { timezone: "Asia/Manila" });

  // Announcements for non-instant users: every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name, access_token, refresh_token, notifications_enabled, notify_instant")
      .eq("notifications_enabled", true)
      .eq("notify_instant", false)
      .not("access_token", "is", null);

    if (!users?.length) return;
    for (const user of users) {
      try { await checkAnnouncementsForUser(user); }
      catch (e) { console.error(`Ann check error for ${user.email}:`, e.message); }
    }
  }, { timezone: "Asia/Manila" });

  console.log("📅 Scheduler started: deadlines at 7AM/5PM, announcements every 30 min (Asia/Manila)");
};

// ══════════════════════════════════════════════════════════════════
// INSTANT ANNOUNCEMENT NOTIFICATIONS
// Called immediately when a professor posts an announcement.
// Emails all enrolled students in the affected courses who have
// notifications enabled.
// ══════════════════════════════════════════════════════════════════
const sendAnnouncementNotifications = async ({ text, courseIds, postedBy }) => {
  if (!courseIds?.length || !text) return;

  console.log(`[Announce] Sending notifications for ${courseIds.length} course(s)...`);

  // Get all students enrolled in these courses who have notifications on
  const { data: students } = await supabase
    .from("users")
    .select("id, email, name, access_token, refresh_token, notifications_enabled")
    .eq("role", "student")
    .eq("notifications_enabled", true)
    .not("access_token", "is", null);

  if (!students?.length) {
    console.log("[Announce] No eligible students found.");
    return;
  }

  // Get professor info for context
  const { data: professor } = await supabase
    .from("users")
    .select("name")
    .eq("id", postedBy)
    .single();

  const profName = professor?.name || "Your professor";

  let sent = 0;
  for (const student of students) {
    try {
      // De-duplicate: don't send same announcement twice within 5 mins
      const refKey = `ann-instant-${courseIds.sort().join("-")}-${text.slice(0,40).replace(/\s/g,"")}`;
      if (await wasRecentlySent(student.id, "announcement_instant", refKey, 0.08)) continue;

      const firstName = student.name?.split(" ")[0] || "Student";
      const preview   = text.length > 200 ? text.slice(0, 200) + "…" : text;

      await sendEmail(
        student.access_token,
        student.refresh_token,
        student.email,
        `📢 New announcement from ${profName}`,
        announcementTemplate(firstName, [{
          type:       "ANNOUNCEMENT",
          courseName: "Your class",
          text:       preview,
          link:       process.env.FRONTEND_URL + "/announcements",
        }])
      );

      await logNotification(student.id, "announcement_instant", {
        reference_key: refKey,
        posted_by: postedBy,
      });

      sent++;
    } catch (e) {
      if (e.message?.includes("Insufficient Permission") || e.code === 403) continue;
      console.error(`[Announce] Failed for ${student.email}:`, e.message);
    }
  }

  console.log(`[Announce] Sent to ${sent}/${students.length} students.`);
};

module.exports = {
  startScheduler,
  checkDeadlinesForUser,
  checkAnnouncementsForUser,
  triggerInstantAnnouncementCheck,
  sendAnnouncementNotifications,
  checkAll,
};
