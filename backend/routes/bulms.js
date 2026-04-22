/**
 * routes/bulms.js — BUPulse BULMS Integration API
 *
 * Endpoints:
 *  POST   /api/bulms/link-start          Start a link session (Puppeteer — local/VPS only)
 *  POST   /api/bulms/link-manual         Link via pasted MoodleSession cookie (production)
 *  GET    /api/bulms/link-status         Poll link session progress
 *  DELETE /api/bulms/unlink              Remove stored session + data
 *  GET    /api/bulms/status              Get current connection status
 *  POST   /api/bulms/sync                Manual sync trigger
 *  GET    /api/bulms/data                Get all synced subjects + activities
 *  GET    /api/bulms/activities          Get activities (with filter params)
 *  GET    /api/bulms/sync-history        Last N sync log entries
 *  POST   /api/bulms/validate-session    Quick session validation
 */

const express  = require("express");
const crypto   = require("crypto");
const router   = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const {
  startLinkSession,
  syncUserData,
  validateSession,
  encryptCookies,
} = require("../services/bulmsService");

router.use(authenticateToken);

// ── Rate-limit guard (simple in-memory) ───────────────────────────────────────
const syncCooldowns = new Map();
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════════
// LINK FLOW — Option A: Puppeteer (local dev / VPS with display)
// ════════════════════════════════════════════════════════════════════════════════

router.post("/link-start", async (req, res) => {
  const userId = req.user.id;
  try {
    await supabase.from("bulms_link_sessions").delete().eq("user_id", userId);
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const { error: insertErr } = await supabase
      .from("bulms_link_sessions")
      .insert({
        user_id:       userId,
        session_token: sessionToken,
        status:        "waiting",
        expires_at:    new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    if (insertErr) throw insertErr;

    startLinkSession(userId, sessionToken).catch((err) =>
      console.error(`[BULMS] startLinkSession bg error for ${userId}:`, err.message)
    );

    res.json({
      success:       true,
      session_token: sessionToken,
      message:       "BULMS browser opened. Please log in with your university Google account.",
    });
  } catch (err) {
    console.error("[BULMS] link-start error:", err);
    res.status(500).json({ error: "Failed to start link session." });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// LINK FLOW — Option B: Manual cookie paste (production / Render)
//
// The user:
//  1. Opens BULMS in their own browser and logs in
//  2. Opens DevTools → Application tab → Cookies → bulms.bicol-u.edu.ph
//  3. Copies the value of the "MoodleSession" cookie
//  4. Pastes it into BUPulse
//
// This endpoint takes that cookie value, wraps it as a proper cookie array,
// encrypts it, stores it, then immediately runs a sync to validate + scrape.
// ════════════════════════════════════════════════════════════════════════════════

router.post("/link-manual", async (req, res) => {
  const userId = req.user.id;
  const { moodle_session } = req.body; // the raw cookie value from the user

  if (!moodle_session || typeof moodle_session !== "string" || moodle_session.trim().length < 10) {
    return res.status(400).json({
      error: "Invalid MoodleSession cookie. Please copy the full value from your browser.",
    });
  }

  const BULMS_URL = process.env.BULMS_URL || "https://bulms.bicol-u.edu.ph";
  const domain = new URL(BULMS_URL).hostname;

  try {
    // Build a minimal cookie array that Puppeteer / fetch can use
    const cookies = [
      {
        name:     "MoodleSession",
        value:    moodle_session.trim(),
        domain,
        path:     "/",
        httpOnly: true,
        secure:   true,
        sameSite: "Lax",
      },
    ];

    const cookiesJson = JSON.stringify(cookies);
    const { cookies_encrypted, iv, auth_tag } = encryptCookies(cookiesJson);

    // Upsert session row
    const { error: sessErr } = await supabase
      .from("bulms_sessions")
      .upsert({
        user_id:           userId,
        cookies_encrypted,
        iv,
        auth_tag,
        status:            "active",
        last_verified_at:  new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (sessErr) throw sessErr;

    // Fire-and-forget: run a sync immediately to validate the session
    // and populate subjects + activities
    syncUserData(userId, "manual").then((result) => {
      if (result.error === "session_expired") {
        // Mark as invalid so the frontend shows the re-link prompt
        supabase
          .from("bulms_sessions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .then(() => {});
        console.log(`[BULMS] Manual link: session invalid for ${userId}.`);
      } else {
        console.log(`[BULMS] Manual link sync done for ${userId}.`);
      }
    }).catch((err) => {
      console.error(`[BULMS] Manual link sync error for ${userId}:`, err.message);
    });

    res.json({
      success: true,
      message: "Session saved. Syncing your data now — it will appear in a few moments.",
    });
  } catch (err) {
    console.error("[BULMS] link-manual error:", err);
    res.status(500).json({ error: "Failed to save session." });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// LINK STATUS (Puppeteer flow polling)
// ════════════════════════════════════════════════════════════════════════════════

router.get("/link-status", async (req, res) => {
  const userId = req.user.id;
  const { data: session, error } = await supabase
    .from("bulms_link_sessions")
    .select("status, error, expires_at, created_at")
    .eq("user_id", userId)
    .single();

  if (error || !session) return res.json({ status: "none" });
  if (new Date() > new Date(session.expires_at) && session.status === "waiting") {
    return res.json({ status: "timeout", message: "Link session timed out." });
  }
  return res.json({ status: session.status, error: session.error || null, started_at: session.created_at });
});

// ════════════════════════════════════════════════════════════════════════════════
// STATUS
// ════════════════════════════════════════════════════════════════════════════════

router.get("/status", async (req, res) => {
  const userId = req.user.id;
  const { data: session } = await supabase
    .from("bulms_sessions")
    .select("status, moodle_username, last_verified_at, created_at, updated_at")
    .eq("user_id", userId)
    .single();

  if (!session) return res.json({ connected: false, status: "not_linked" });

  const { data: lastSync } = await supabase
    .from("bulms_sync_logs")
    .select("status, triggered_by, activities_count, new_activities, started_at, finished_at, error_message")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  const { count: subjectCount }  = await supabase.from("bulms_subjects").select("*", { count: "exact", head: true }).eq("user_id", userId);
  const { count: activityCount } = await supabase.from("bulms_activities").select("*", { count: "exact", head: true }).eq("user_id", userId);
  const { count: overdueCount }  = await supabase.from("bulms_activities").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_overdue", true);

  res.json({
    connected:       session.status === "active",
    status:          session.status,
    moodle_username: session.moodle_username,
    last_verified:   session.last_verified_at,
    linked_at:       session.created_at,
    last_sync:       lastSync || null,
    counts: {
      subjects:   subjectCount  || 0,
      activities: activityCount || 0,
      overdue:    overdueCount  || 0,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// MANUAL SYNC
// ════════════════════════════════════════════════════════════════════════════════

router.post("/sync", async (req, res) => {
  const userId = req.user.id;
  const lastSync = syncCooldowns.get(userId) || 0;
  if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    const remaining = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastSync)) / 1000);
    return res.status(429).json({ error: "Sync too frequent.", retry_in: remaining, message: `Please wait ${remaining}s before syncing again.` });
  }
  syncCooldowns.set(userId, Date.now());
  res.json({ success: true, message: "Sync started. Data will update shortly." });
  syncUserData(userId, "manual").catch((err) =>
    console.error(`[BULMS] Manual sync error for ${userId}:`, err.message)
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════════════════════════

router.get("/data", async (req, res) => {
  const userId = req.user.id;
  const [subjectsRes, activitiesRes] = await Promise.all([
    supabase.from("bulms_subjects").select("*").eq("user_id", userId).order("course_name"),
    supabase.from("bulms_activities").select("*").eq("user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  res.json({ subjects: subjectsRes.data || [], activities: activitiesRes.data || [] });
});

router.get("/activities", async (req, res) => {
  const userId = req.user.id;
  const { course_id, type, overdue, limit = 100 } = req.query;
  let query = supabase.from("bulms_activities").select("*").eq("user_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(Math.min(Number(limit), 200));
  if (course_id)         query = query.eq("course_id", course_id);
  if (type)              query = query.eq("activity_type", type);
  if (overdue === "true") query = query.eq("is_overdue", true);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Failed to fetch activities." });
  res.json({ activities: data || [] });
});

router.get("/sync-history", async (req, res) => {
  const userId = req.user.id;
  const { data } = await supabase
    .from("bulms_sync_logs")
    .select("id, triggered_by, status, subjects_count, activities_count, new_activities, error_message, started_at, finished_at, duration_ms")
    .eq("user_id", userId).order("started_at", { ascending: false }).limit(20);
  res.json({ history: data || [] });
});

router.delete("/unlink", async (req, res) => {
  const userId = req.user.id;
  try {
    await Promise.all([
      supabase.from("bulms_sessions").delete().eq("user_id", userId),
      supabase.from("bulms_subjects").delete().eq("user_id", userId),
      supabase.from("bulms_activities").delete().eq("user_id", userId),
      supabase.from("bulms_link_sessions").delete().eq("user_id", userId),
    ]);
    res.json({ success: true, message: "BULMS account unlinked and data removed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to unlink account." });
  }
});

router.post("/validate-session", async (req, res) => {
  const userId = req.user.id;
  res.json({ message: "Validation started." });
  validateSession(userId).catch((err) =>
    console.error(`[BULMS] validateSession error for ${userId}:`, err.message)
  );
});

module.exports = router;
