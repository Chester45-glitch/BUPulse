/**
 * bulmsService.js — Relay Edition (stores course_name + due_date)
 */
const supabase = require("../db/supabase");

async function syncUserData(userId, triggeredBy = "auto", externalData = null) {
  const syncStart = Date.now();

  const { data: logRow } = await supabase
    .from("bulms_sync_logs")
    .insert({ user_id: userId, triggered_by: triggeredBy, status: "running", started_at: new Date().toISOString() })
    .select("id").single();
  const logId = logRow?.id;

  if (!externalData) {
    if (logId) await supabase.from("bulms_sync_logs").update({ status: "failed", error_message: "No data provided" }).eq("id", logId);
    return { error: "manual_browser_sync_required" };
  }

  const { subjects, activities } = externalData;

  try {
    // ── Upsert subjects ──────────────────────────────────────────────────────
    if (subjects?.length > 0) {
      const subjectRows = subjects.map(s => ({
        user_id:     userId,
        course_id:   String(s.course_id),
        course_name: (s.course_name || "").replace(/Course image/gi, "").replace(/\s+/g, " ").trim(),
        course_url:  s.course_url || null,
        synced_at:   new Date().toISOString(),
      })).filter(s => s.course_name.length > 1);

      await supabase
        .from("bulms_subjects")
        .upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    // Build a course_id → course_name lookup for enriching activities
    const courseNameMap = {};
    (subjects || []).forEach(s => {
      const name = (s.course_name || "").replace(/Course image/gi, "").trim();
      if (name) courseNameMap[String(s.course_id)] = name;
    });

    // ── Upsert activities ────────────────────────────────────────────────────
    if (activities?.length > 0) {
      const activityRows = activities.map(a => ({
        user_id:           userId,
        course_id:         String(a.course_id),
        activity_id:       String(a.activity_id),
        activity_name:     (a.activity_name || "").trim(),
        activity_type:     a.activity_type || "assign",
        activity_url:      a.activity_url || null,
        // NEW: store course_name so it shows without a JOIN
        course_name:       a.course_name || courseNameMap[String(a.course_id)] || null,
        // NEW: store due_date if the script extracted it
        due_date:          a.due_date || null,
        synced_at:         new Date().toISOString(),
      })).filter(a => a.activity_name.length > 0);

      await supabase
        .from("bulms_activities")
        .upsert(activityRows, { onConflict: "user_id,activity_id" });
    }

    // ── Mark session active (so /status shows "connected") ──────────────────
    await supabase.from("bulms_sessions").upsert({
      user_id:          userId,
      cookies_encrypted: "relay",
      iv:               "none",
      auth_tag:         "none",
      status:           "active",
      last_verified_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (logId) {
      await supabase.from("bulms_sync_logs").update({
        status:           "success",
        subjects_count:   subjects?.length  || 0,
        activities_count: activities?.length || 0,
        new_activities:   activities?.length || 0,
        finished_at:      new Date().toISOString(),
        duration_ms:      Date.now() - syncStart,
      }).eq("id", logId);
    }

    return { success: true, newCount: activities?.length || 0 };
  } catch (err) {
    console.error("[BULMS Relay Error]", err.message);
    if (logId) await supabase.from("bulms_sync_logs").update({ status: "failed", error_message: err.message }).eq("id", logId);
    return { error: err.message };
  }
}

async function validateSession() { return true; }
function encryptCookies(d) { return { cookies_encrypted: String(d), iv: "none", auth_tag: "none" }; }
function decryptCookies(d) { return d; }

module.exports = { syncUserData, validateSession, encryptCookies, decryptCookies };
