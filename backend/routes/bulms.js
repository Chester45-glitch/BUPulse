/**
 * routes/bulms.js — BUPulse BULMS Integration API (Relay Edition)
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

// ── Rate-limit guard ─────────────────────────────────────────────────────────
const syncCooldowns = new Map();
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════════
// NEW: MANUAL DATA RELAY (The "Magic Script" endpoint)
// ════════════════════════════════════════════════════════════════════════════════

router.post("/sync-manual-data", async (req, res) => {
  const userId = req.user.id;
  const { subjects, activities } = req.body;

  if (!subjects || !activities) {
    return res.status(400).json({ error: "Missing sync data. Please run the full script." });
  }

  try {
    console.log(`[BULMS] Receiving manual relay sync for user ${userId}`);
    
    // We pass the data directly to our Relay-version service
    const result = await syncUserData(userId, "manual", { subjects, activities });

    if (result.error) throw new Error(result.error);

    res.json({
      success: true,
      message: `Successfully synced ${subjects.length} subjects and ${activities.length} activities.`
    });
  } catch (err) {
    console.error("[BULMS] sync-manual-data error:", err.message);
    res.status(500).json({ error: "Failed to process manual sync data." });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// LINK FLOW — Option B: Manual cookie paste (Kept for session validation)
// ════════════════════════════════════════════════════════════════════════════════

router.post("/link-manual", async (req, res) => {
  const userId = req.user.id;
  const { moodle_session } = req.body;

  if (!moodle_session || typeof moodle_session !== "string") {
    return res.status(400).json({ error: "Invalid MoodleSession cookie." });
  }

  try {
    // We still save the cookie so the backend can "pretend" to be active 
    // even though it can't scrape due to 403.
    const { cookies_encrypted, iv, auth_tag } = encryptCookies(moodle_session.trim());

    const { error: sessErr } = await supabase
      .from("bulms_sessions")
      .upsert({
        user_id: userId,
        cookies_encrypted,
        iv,
        auth_tag,
        status: "active",
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (sessErr) throw sessErr;

    res.json({ success: true, message: "Session linked. Now use the Magic Script to sync data." });
  } catch (err) {
    console.error("[BULMS] link-manual error:", err);
    res.status(500).json({ error: "Failed to save session." });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// STATUS & DATA (Existing endpoints)
// ════════════════════════════════════════════════════════════════════════════════

router.get("/status", async (req, res) => {
  const userId = req.user.id;
  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session) return res.json({ connected: false, status: "not_linked" });

  const { data: lastSync } = await supabase.from("bulms_sync_logs").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).single();

  res.json({
    connected: session.status === "active",
    status: session.status,
    moodle_username: session.moodle_username,
    last_sync: lastSync || null
  });
});

router.get("/data", async (req, res) => {
  const userId = req.user.id;
  const [subjectsRes, activitiesRes] = await Promise.all([
    supabase.from("bulms_subjects").select("*").eq("user_id", userId).order("course_name"),
    supabase.from("bulms_activities").select("*").eq("user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  res.json({ subjects: subjectsRes.data || [], activities: activitiesRes.data || [] });
});

router.delete("/unlink", async (req, res) => {
  const userId = req.user.id;
  await Promise.all([
    supabase.from("bulms_sessions").delete().eq("user_id", userId),
    supabase.from("bulms_subjects").delete().eq("user_id", userId),
    supabase.from("bulms_activities").delete().eq("user_id", userId),
  ]);
  res.json({ success: true });
});

module.exports = router;
