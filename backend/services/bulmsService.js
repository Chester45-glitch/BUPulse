/**
 * bulmsService.js — Final "Relay" Version
 * Backend no longer scrapes; it only receives and saves data from the frontend.
 */
const supabase = require("../db/supabase");

async function syncUserData(userId, triggeredBy = "auto", externalData = null) {
  const syncStart = Date.now();
  
  // If no external data is provided, we can't scrape anymore due to 403
  if (!externalData) return { error: "manual_browser_sync_required" };

  const { subjects, activities } = externalData;

  try {
    // 1. Save Subjects
    if (subjects && subjects.length > 0) {
      const subjectRows = subjects.map(s => ({
        user_id: userId,
        course_id: s.course_id,
        course_name: s.course_name,
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

    return { success: true, newCount: activities?.length || 0 };
  } catch (err) {
    console.error("[BULMS Relay Error]", err.message);
    return { error: err.message };
  }
}

// Stubs to keep the rest of the app from breaking
async function validateSession() { return true; }
function encryptCookies(d) { return { cookies_encrypted: d, iv: 'none', auth_tag: 'none' }; }
function decryptCookies(d) { return d; }

module.exports = { syncUserData, validateSession, encryptCookies, decryptCookies };
