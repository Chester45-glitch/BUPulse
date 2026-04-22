/**
 * bulmsService.js — Hyper-Compatible HTML Version
 */

const cheerio  = require("cheerio");
const crypto   = require("crypto");
const supabase = require("../db/supabase");

const BULMS_URL = process.env.BULMS_URL || "https://bulms.bicol-u.edu.ph";
// TARGET: The Mobile launch page contains a static list of courses in raw HTML
const BULMS_STATIC_COURSES = `${BULMS_URL}/admin/tool/mobile/launch.php?service=moodle_mobile_app`;
const COOKIE_KEY = process.env.BULMS_COOKIE_KEY || null;

function getKey() {
  if (!COOKIE_KEY || COOKIE_KEY.length < 64) throw new Error("BULMS_COOKIE_KEY must be a 64-char hex string.");
  return Buffer.from(COOKIE_KEY, "hex");
}

function encryptCookies(data) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return { cookies_encrypted: encrypted.toString("hex"), iv: iv.toString("hex"), auth_tag: cipher.getAuthTag().toString("hex") };
}

function decryptCookies(encrypted, iv, authTag) {
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
  try { return JSON.parse(decrypted); } catch { return decrypted; }
}

async function fetchHtml(url, sessionCookie) {
  const response = await fetch(url, {
    headers: {
      "Cookie": `MoodleSession=${sessionCookie}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

async function startLinkSession(userId, sessionToken) {
   await supabase.from("bulms_link_sessions").update({ status: "failed", error: "Manual sync required." }).eq("session_token", sessionToken);
}

async function syncUserData(userId, triggeredBy = "auto") {
  const syncStart = Date.now();
  const { data: logRow } = await supabase.from("bulms_sync_logs").insert({ user_id: userId, triggered_by: triggeredBy, status: "running" }).select("id").single();
  const logId = logRow?.id;
  
  const finishLog = async (patch) => {
    if (logId) await supabase.from("bulms_sync_logs").update({ ...patch, finished_at: new Date().toISOString(), duration_ms: Date.now() - syncStart }).eq("id", logId);
  };

  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session) return { error: "no_session" };

  try {
    const cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag);
    const moodleSessionVal = Array.isArray(cookies) ? cookies.find(x => x.name === "MoodleSession")?.value : cookies;

    if (!moodleSessionVal) throw new Error("Invalid session cookie.");

    // 1. Fetch the static course list
    const html = await fetchHtml(BULMS_STATIC_COURSES, moodleSessionVal);
    const $ = cheerio.load(html);

    if (html.includes("login/index.php")) {
      await supabase.from("bulms_sessions").update({ status: "expired" }).eq("user_id", userId);
      await finishLog({ status: "session_expired" });
      return { error: "session_expired" };
    }

    const courses = [];
    // This selector targets the list Moodle generates for "Open in the App"
    $("a[href*='course/view.php?id=']").each((i, el) => {
      const href = $(el).attr("href");
      const match = href.match(/[?&]id=(\d+)/);
      if (!match) return;
      const cid = match[1];

      let name = $(el).text().trim().replace(/\s+/g, ' ');
      // If text is empty (like an icon), try to find text nearby
      if (name.length < 2) {
          name = $(el).parent().text().trim();
      }

      if (name.length > 2 && !courses.find(c => c.course_id === cid)) {
        courses.push({ course_id: cid, course_name: name, course_url: href });
      }
    });

    console.log(`[BULMS] Found ${courses.length} courses for user ${userId}`);

    if (courses.length > 0) {
      const rows = courses.map(c => ({ user_id: userId, course_id: c.course_id, course_name: c.course_name, course_url: c.course_url, synced_at: new Date().toISOString() }));
      await supabase.from("bulms_subjects").upsert(rows, { onConflict: "user_id,course_id" });
    }

    // 2. Activities (Course pages are usually static enough for Cheerio)
    const allActivities = [];
    for (const course of courses.slice(0, 8)) {
      try {
        const cHtml = await fetchHtml(course.course_url, moodleSessionVal);
        const $c = cheerio.load(cHtml);

        $c("li.activity").each((i, el) => {
          const aTag = $c(el).find("a[href*='mod/assign/'], a[href*='mod/quiz/']");
          if (!aTag.length) return;

          const href = aTag.attr("href");
          const cmMatch = href.match(/[?&]id=(\d+)/);
          if (!cmMatch) return;

          // Clean up course name (remove "Mark as done" etc)
          const rawName = aTag.text().trim();
          const cleanName = rawName.split(/\n/)[0].replace(/Mark as done/ig, '').trim();

          const type = href.includes("quiz") ? "quiz" : "assign";

          allActivities.push({
            user_id: userId,
            course_id: course.course_id,
            activity_id: `${course.course_id}_${cmMatch[1]}`,
            activity_name: cleanName || "Untitled Activity",
            activity_type: type,
            activity_url: href,
            synced_at: new Date().toISOString()
          });
        });
      } catch (e) { console.log(`[BULMS] Activity Scrape Error: ${e.message}`); }
    }

    if (allActivities.length > 0) {
      await supabase.from("bulms_activities").upsert(allActivities, { onConflict: "user_id,activity_id" });
    }

    await finishLog({ status: "success", subjects_count: courses.length, activities_count: allActivities.length });
    return { success: true };

  } catch (err) {
    console.error(`[BULMS Sync Error] ${err.message}`);
    await finishLog({ status: "failed", error_message: err.message });
    return { error: err.message };
  }
}

async function validateSession(userId) {
  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session) return false;
  try {
    const cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag);
    const val = Array.isArray(cookies) ? cookies.find(x => x.name === "MoodleSession")?.value : cookies;
    const html = await fetchHtml(`${BULMS_URL}/my/`, val);
    return !html.includes("login/index.php");
  } catch { return false; }
}

module.exports = { startLinkSession, syncUserData, validateSession, encryptCookies, decryptCookies };
