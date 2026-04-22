/**
 * bulmsService.js — BUPulse BULMS Integration (Official REST API Version)
 * Completely bypasses Web Application Firewalls (Cloudflare/Imperva) by utilizing
 * the official Moodle Mobile Web Service API. Puppeteer is no longer required!
 */

const crypto   = require("crypto");
const supabase = require("../db/supabase");

const BULMS_URL  = process.env.BULMS_URL || "https://bulms.bicol-u.edu.ph";
const COOKIE_KEY = process.env.BULMS_COOKIE_KEY || null;

// ── Encryption (Reused for the Token) ─────────────────────────────────────────
function getKey() {
  if (!COOKIE_KEY || COOKIE_KEY.length < 64) throw new Error("BULMS_COOKIE_KEY must be a 64-char hex string.");
  return Buffer.from(COOKIE_KEY, "hex");
}

function encryptToken(tokenString) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(tokenString, "utf8"), cipher.final()]);
  return { cookies_encrypted: encrypted.toString("hex"), iv: iv.toString("hex"), auth_tag: cipher.getAuthTag().toString("hex") };
}

function decryptToken(encrypted, iv, authTag) {
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}

// ── Native Fetch Helper ───────────────────────────────────────────────────────
async function fetchMoodle(token, wsfunction, params = {}) {
  const url = new URL(`${BULMS_URL}/webservice/rest/server.php`);
  url.searchParams.append("wstoken", token);
  url.searchParams.append("wsfunction", wsfunction);
  url.searchParams.append("moodlewsrestformat", "json");
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  
  const data = await response.json();
  if (data && data.exception) {
    throw new Error(`Moodle API Error: ${data.message}`);
  }
  return data;
}

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API (Function signatures remain exactly the same to avoid breaking router)
// ════════════════════════════════════════════════════════════════════════════════

// The frontend will still call /link-manual and pass the token as 'moodle_session'
const encryptCookies = encryptToken;
const decryptCookies = decryptToken;

// Puppeteer flow is dead, but we keep the stub so the router doesn't crash if called
async function startLinkSession(userId, sessionToken) {
  await supabase.from("bulms_link_sessions").update({ status: "failed", error: "Please use the manual Token link method." }).eq("session_token", sessionToken);
}

async function syncUserData(userId, triggeredBy = "auto") {
  const syncStart = Date.now();
  let logId;

  const { data: logRow } = await supabase.from("bulms_sync_logs").insert({ user_id: userId, triggered_by: triggeredBy, status: "running" }).select("id").single();
  logId = logRow?.id;

  const finishLog = async (patch) => {
    if (!logId) return;
    await supabase.from("bulms_sync_logs").update({ ...patch, finished_at: new Date().toISOString(), duration_ms: Date.now() - syncStart }).eq("id", logId);
  };

  const { data: session, error: sessErr } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();

  if (sessErr || !session) {
    await finishLog({ status: "failed", error_message: "No BULMS token found." });
    return { error: "no_session" };
  }

  let token;
  try {
    token = decryptToken(session.cookies_encrypted, session.iv, session.auth_tag);
  } catch (err) {
    await finishLog({ status: "failed", error_message: "Token decryption failed." });
    return { error: "decryption_failed" };
  }

  try {
    // 1. Validate Token & Get User Info
    const siteInfo = await fetchMoodle(token, "core_webservice_get_site_info");
    const moodleUserId = siteInfo.userid;

    // 2. Fetch Courses
    const enrolledCourses = await fetchMoodle(token, "core_enrol_get_users_courses", { userid: moodleUserId });
    
    if (enrolledCourses.length > 0) {
      const subjectRows = enrolledCourses.map((c) => ({
        user_id: userId,
        course_id: c.id.toString(),
        course_name: c.fullname,
        short_name: c.shortname,
        category: null, 
        course_url: `${BULMS_URL}/course/view.php?id=${c.id}`,
        synced_at: new Date().toISOString(),
      }));
      await supabase.from("bulms_subjects").upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    // 3. Fetch Assignments across all courses instantly
    // The Moodle API can fetch all assignments for a user in a single ultra-fast request
    const assignmentData = await fetchMoodle(token, "mod_assign_get_assignments");
    let allActivities = [];

    // Parse the assignment data
    for (const course of assignmentData.courses || []) {
      for (const assign of course.assignments || []) {
        
        let status = "notsubmitted";
        // Check submission status if available
        try {
           const statusData = await fetchMoodle(token, "mod_assign_get_submission_status", { assignid: assign.id });
           if (statusData.lastattempt && statusData.lastattempt.submission) {
              if (statusData.lastattempt.submission.status === "submitted") status = "submitted";
           }
           if (statusData.feedback && statusData.feedback.grade) status = "graded";
        } catch(e) { /* Ignore status check failures to keep sync fast */ }

        allActivities.push({
          user_id: userId,
          course_id: course.id.toString(),
          activity_id: `${course.id}_${assign.id}`,
          activity_name: assign.name,
          activity_type: "assign",
          due_date: assign.duedate ? new Date(assign.duedate * 1000).toISOString() : null,
          description: assign.intro,
          submission_status: status,
          grade: null,
          activity_url: `${BULMS_URL}/mod/assign/view.php?id=${assign.cmid}`,
          synced_at: new Date().toISOString(),
        });
      }
    }

    // Determine new activities
    const { data: existingIds } = await supabase.from("bulms_activities").select("activity_id").eq("user_id", userId);
    const knownIds = new Set((existingIds || []).map((r) => r.activity_id));
    const newCount = allActivities.filter((a) => !knownIds.has(a.activity_id)).length;

    if (allActivities.length > 0) {
      await supabase.from("bulms_activities").upsert(allActivities, { onConflict: "user_id,activity_id" });
    }

    // Update Session Status
    await supabase.from("bulms_sessions").update({ 
      moodle_username: siteInfo.fullname,
      moodle_user_id: moodleUserId.toString(),
      last_verified_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    }).eq("user_id", userId);
    
    await finishLog({ status: "success", subjects_count: enrolledCourses.length, activities_count: allActivities.length, new_activities: newCount });

    return { subjects: enrolledCourses, activities: allActivities, newCount, error: null };
  } catch (err) {
    console.error(`[BULMS API] syncUserData error for ${userId}:`, err.message);
    
    // If it's an invalid token error from Moodle, mark session expired
    if (err.message.includes("Invalid token")) {
      await supabase.from("bulms_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
      await finishLog({ status: "session_expired", error_message: "Token expired or invalid." });
      return { error: "session_expired" };
    }

    await finishLog({ status: "failed", error_message: err.message?.slice(0, 300) });
    return { error: err.message };
  }
}

async function validateSession(userId) {
  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session || session.status !== "active") return false;
  
  try {
    const token = decryptToken(session.cookies_encrypted, session.iv, session.auth_tag);
    await fetchMoodle(token, "core_webservice_get_site_info");
    return true;
  } catch (err) {
    if (err.message.includes("Invalid token")) {
      await supabase.from("bulms_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    return false;
  }
}

module.exports = { startLinkSession, syncUserData, validateSession, encryptCookies, decryptCookies };
