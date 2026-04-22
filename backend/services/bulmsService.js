/**
 * bulmsService.js — BUPulse BULMS Integration (Native Fetch + Cheerio)
 * This entirely removes Puppeteer and bypasses strict WAF browser checks
 * by executing hyper-fast native node fetches and HTML parsing.
 */

const cheerio  = require("cheerio");
const crypto   = require("crypto");
const supabase = require("../db/supabase");

const BULMS_URL      = process.env.BULMS_URL || "https://bulms.bicol-u.edu.ph";
const BULMS_HOME_URL = `${BULMS_URL}/?redirect=0`;
const COOKIE_KEY     = process.env.BULMS_COOKIE_KEY || null;

// ── Encryption ───────────────────────────────────────────────────────────────
function getKey() {
  if (!COOKIE_KEY || COOKIE_KEY.length < 64) throw new Error("BULMS_COOKIE_KEY must be a 64-char hex string (32 bytes).");
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

// ── Native Fetch Helper ──────────────────────────────────────────────────────
async function fetchHtml(url, sessionCookie) {
  const response = await fetch(url, {
    headers: {
      "Cookie": `MoodleSession=${sessionCookie}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════════

// Stub for router compatibility
async function startLinkSession(userId, sessionToken) {
   await supabase.from("bulms_link_sessions").update({ status: "failed", error: "Please use the manual link method." }).eq("session_token", sessionToken);
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
    await finishLog({ status: "failed", error_message: "No session found." });
    return { error: "no_session" };
  }

  let cookies;
  try { cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag); }
  catch { await finishLog({ status: "failed", error_message: "Decryption failed." }); return { error: "decryption_failed" }; }

  // Robustly extract the cookie value whether it was saved as a raw string or JSON array
  let moodleSessionVal = "";
  if (Array.isArray(cookies)) {
     const c = cookies.find(x => x.name === "MoodleSession");
     if (c) moodleSessionVal = c.value;
  } else {
     moodleSessionVal = cookies;
  }

  if (!moodleSessionVal) {
     await finishLog({ status: "failed", error_message: "No MoodleSession value found." });
     return { error: "invalid_cookie" };
  }

  try {
    // 1. Fetch the Site Home to grab courses instantly
    const html = await fetchHtml(BULMS_HOME_URL, moodleSessionVal);
    
    // Check if cookie expired
    if (html.includes("login/index.php") || html.includes("Log in to the site")) {
      await supabase.from("bulms_sessions").update({ status: "expired" }).eq("user_id", userId);
      await finishLog({ status: "session_expired", error_message: "Session expired." });
      return { error: "session_expired" };
    }

    const $ = cheerio.load(html);

    // Extract basic info
    const userName = $(".usertext").first().text().trim() || session.moodle_username;
    const profileLink = $("a[href*='/user/profile']").attr("href") || "";
    const userIdMatch = profileLink.match(/[?&]id=(\d+)/);
    const moodleUserId = userIdMatch ? userIdMatch[1] : session.moodle_user_id;

    // 2. Extract Courses using the Cheerio vacuum
    const courses = [];
    $("a[href*='course/view.php?id=']").each((i, el) => {
        const href = $(el).attr("href");
        const match = href.match(/[?&]id=(\d+)/);
        if (!match) return;
        const courseId = match[1];

        // Skip dropdown menu links to avoid empty titles if we already found the main card
        if ($(el).closest('#nav-drawer, .dropdown-menu').length > 0 && courses.some(c => c.course_id === courseId)) return;

        let courseName = $(el).text().trim().replace(/\s+/g, ' ');
        if (courseName.length < 3) {
           courseName = $(el).closest('.card, .coursebox').find('.coursename, h3, h4').text().trim().replace(/\s+/g, ' ');
        }
        courseName = courseName.replace(/Course image/ig, '').trim();

        if (courseName.length > 3 && !courses.find(c => c.course_id === courseId)) {
            courses.push({
                course_id: courseId,
                course_name: courseName,
                short_name: null,
                category: $(el).closest('.card, .coursebox').find('.category-name').text().trim() || null,
                course_url: href.startsWith("http") ? href : `${BULMS_URL}${href}`,
                synced_at: new Date().toISOString()
            });
        }
    });

    if (courses.length > 0) {
        const subjectRows = courses.map(c => ({ user_id: userId, ...c }));
        await supabase.from("bulms_subjects").upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    // 3. Extract Activities across courses
    const allActivities = [];
    for (const course of courses.slice(0, 8)) {
        try {
            const cHtml = await fetchHtml(course.course_url, moodleSessionVal);
            const $c = cheerio.load(cHtml);

            $c(".activity, .activity-item, li.activity").each((i, el) => {
                 const classList = $c(el).attr("class") || "";
                 let type = "resource";
                 if (classList.includes("assign")) type = "assign";
                 else if (classList.includes("quiz")) type = "quiz";
                 else if (classList.includes("forum")) type = "forum";

                 if (!["assign","quiz","forum"].includes(type)) return;

                 const aTag = $c(el).find("a[href*='mod/']");
                 if (!aTag.length) return;
                 const href = aTag.attr("href");
                 const cmMatch = href.match(/[?&]id=(\d+)/);
                 if (!cmMatch) return;
                 const activityId = cmMatch[1];
                 
                 let name = aTag.text().trim().replace(/\s+/g, ' ').replace(/Mark as done/ig, '').trim();
                 if (!name) name = $c(el).find(".instancename").text().trim().replace(/\s+/g, ' ').replace(/Mark as done/ig, '').trim();

                 let dueDate = null;
                 const dateText = $c(el).find(".activitydate, [data-type='duedate'], .duedate, time").text();
                 if (dateText) {
                     const raw = dateText.replace(/Due:/i, '').trim();
                     const parsed = Date.parse(raw);
                     if (!isNaN(parsed)) dueDate = new Date(parsed).toISOString();
                 }

                 let status = "notsubmitted";
                 const statusText = $c(el).find(".submissionstatus, .completion-badge").text().toLowerCase();
                 if (statusText.includes("submitted") || statusText.includes("complete") || statusText.includes("turned in")) status = "submitted";
                 else if (statusText.includes("graded")) status = "graded";

                 allActivities.push({
                    user_id: userId,
                    course_id: course.course_id,
                    activity_id: `${course.course_id}_${activityId}`,
                    activity_name: name || "Activity",
                    activity_type: type,
                    due_date: dueDate,
                    description: null,
                    submission_status: status,
                    grade: null,
                    activity_url: href.startsWith("http") ? href : `${BULMS_URL}${href}`,
                    synced_at: new Date().toISOString()
                 });
            });
        } catch(e) {
           console.log(`[BULMS] Error scraping HTML for course ${course.course_id}: ${e.message}`);
        }
    }

    const { data: existingIds } = await supabase.from("bulms_activities").select("activity_id").eq("user_id", userId);
    const knownIds = new Set((existingIds || []).map((r) => r.activity_id));
    const newCount = allActivities.filter((a) => !knownIds.has(a.activity_id)).length;

    if (allActivities.length > 0) {
      await supabase.from("bulms_activities").upsert(allActivities, { onConflict: "user_id,activity_id" });
    }

    await supabase.from("bulms_sessions").update({
       moodle_username: userName,
       moodle_user_id: moodleUserId,
       last_verified_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
    }).eq("user_id", userId);

    await finishLog({ status: "success", subjects_count: courses.length, activities_count: allActivities.length, new_activities: newCount });

    return { subjects: courses, activities: allActivities, newCount, error: null };
  } catch (err) {
    console.error(`[BULMS Cheerio] syncUserData error for ${userId}:`, err.message);
    await finishLog({ status: "failed", error_message: err.message?.slice(0, 300) });
    return { error: err.message };
  }
}

async function validateSession(userId) {
  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session || session.status !== "active") return false;
  try {
    let cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag);
    let val = Array.isArray(cookies) ? cookies.find(x => x.name === "MoodleSession")?.value : cookies;
    const html = await fetchHtml(BULMS_HOME_URL, val);
    const valid = !(html.includes("login/index.php") || html.includes("Log in to the site"));
    if (!valid) await supabase.from("bulms_sessions").update({ status: "expired" }).eq("user_id", userId);
    return valid;
  } catch { return false; }
}

module.exports = { startLinkSession, syncUserData, validateSession, encryptCookies, decryptCookies };
