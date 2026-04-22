/**
 * bulmsService.js — Final Relay Version
 * Cleans and saves data provided by the frontend Magic Script.
 */
const supabase = require("../db/supabase");

async function syncUserData(userId, triggeredBy = "auto", externalData = null) {
  const syncStart = Date.now();
  
  // Create a log entry for history
  const { data: logRow } = await supabase.from("bulms_sync_logs").insert({ 
    user_id: userId, 
    triggered_by: triggeredBy, 
    status: "running",
    started_at: new Date().toISOString()
  }).select("id").single();
  
  const logId = logRow?.id;

  if (!externalData) {
    if (logId) await supabase.from("bulms_sync_logs").update({ status: "failed", error_message: "No data provided" }).eq("id", logId);
    return { error: "manual_browser_sync_required" };
  }

  const { subjects, activities } = externalData;

  try {
    // 1. Save & Clean Subjects
    if (subjects && subjects.length > 0) {
      const subjectRows = subjects.map(s => ({
        user_id: userId,
        course_id: s.course_id,
        // Final backend cleaning pass
        course_name: s.course_name.replace(/Course image/ig, '').trim(),
        course_url: s.course_url,
        synced_at: new Date().toISOString()
      }));
      await supabase.from("bulms_subjects").upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    // 2. Save Activities
    if (activities && activities.length > 0) {
      const activityRows = activities.map(a => ({
        user_id: userId,
        course_id: a.course_id,
        activity_id: a.activity_id,
        activity_name: a.activity_name,
        activity_type: a.activity_type,
        activity_url: a.activity_url,
        synced_at: new Date().toISOString()
      }));
      await supabase.from("bulms_activities").upsert(activityRows, { onConflict: "user_id,activity_id" });
    }

    // 3. Mark success
    if (logId) {
      await supabase.from("bulms_sync_logs").update({ 
        status: "success", 
        subjects_count: subjects?.length || 0,
        activities_count: activities?.length || 0,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - syncStart
      }).eq("id", logId);
    }

    return { success: true, newCount: activities?.length || 0 };
  } catch (err) {
    console.error("[BULMS Relay Error]", err.message);
    if (logId) await supabase.from("bulms_sync_logs").update({ status: "failed", error_message: err.message }).eq("id", logId);
    return { error: err.message };
  }
}

// Compatibility Stubs
async function validateSession() { return true; }
function encryptCookies(d) { return { cookies_encrypted: d, iv: 'none', auth_tag: 'none' }; }
function decryptCookies(d) { return d; }

module.exports = { syncUserData, validateSession, encryptCookies, decryptCookies };
