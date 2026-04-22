/**
 * bulmsScheduler.js — Auto-sync BULMS data for all linked users
 *
 * Schedule: every 8 hours (Asia/Manila timezone)
 * Also: stale session validation check every 24 hours
 * Also: expired link-session cleanup every 5 minutes
 */

const cron     = require("node-cron");
const supabase = require("../db/supabase");
const { syncUserData } = require("./bulmsService");

// ── Sync all active BULMS sessions ────────────────────────────────────────────
const runAutoSync = async () => {
  const startAt = new Date();
  console.log(`[BULMS Scheduler] ${startAt.toISOString()} — Starting auto-sync…`);

  const { data: sessions, error } = await supabase
    .from("bulms_sessions")
    .select("user_id")
    .eq("status", "active");

  if (error || !sessions?.length) {
    console.log("[BULMS Scheduler] No active sessions to sync.");
    return;
  }

  console.log(`[BULMS Scheduler] Syncing ${sessions.length} user(s)…`);

  let success = 0, expired = 0, failed = 0;

  for (const { user_id } of sessions) {
    try {
      const result = await syncUserData(user_id, "auto");
      if (result.error === "session_expired") {
        expired++;
        console.log(`[BULMS Scheduler]   ⚠  Session expired → ${user_id}`);
      } else if (result.error) {
        failed++;
        console.log(`[BULMS Scheduler]   ✗  Sync failed for ${user_id}: ${result.error}`);
      } else {
        success++;
        console.log(
          `[BULMS Scheduler]   ✓  ${user_id} — ${result.activities?.length || 0} activities ` +
          `(${result.newCount} new)`
        );
      }
    } catch (err) {
      failed++;
      console.error(`[BULMS Scheduler]   ✗  Unexpected error for ${user_id}:`, err.message);
    }
  }

  const elapsed = ((Date.now() - startAt.getTime()) / 1000).toFixed(1);
  console.log(
    `[BULMS Scheduler] Done in ${elapsed}s — ` +
    `✓ ${success} synced, ⚠ ${expired} expired, ✗ ${failed} failed.`
  );
};

// ── Clean up expired link-session rows ────────────────────────────────────────
const cleanupExpiredLinkSessions = async () => {
  const { error } = await supabase
    .from("bulms_link_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (error) console.error("[BULMS Scheduler] Link session cleanup error:", error.message);
};

// ── Register all cron jobs ────────────────────────────────────────────────────
const startBulmsScheduler = () => {
  // Auto-sync: 1 AM, 9 AM, and 5 PM (Asia/Manila)
  cron.schedule("0 1  * * *", runAutoSync, { timezone: "Asia/Manila" });
  cron.schedule("0 9  * * *", runAutoSync, { timezone: "Asia/Manila" });
  cron.schedule("0 17 * * *", runAutoSync, { timezone: "Asia/Manila" });

  // Link session cleanup: every 5 minutes
  cron.schedule("*/5 * * * *", cleanupExpiredLinkSessions);

  console.log(
    "📅 BULMS Scheduler started: auto-sync at 1AM/9AM/5PM (Asia/Manila), " +
    "link-session cleanup every 5 min."
  );
};

module.exports = { startBulmsScheduler, runAutoSync };
