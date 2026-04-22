/**
 * bulmsService.js — BUPulse BULMS Integration (Stealth Edition)
 */

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin  = require("puppeteer-extra-plugin-stealth");
puppeteerExtra.use(StealthPlugin()); // Activate stealth mode to bypass WAF 403s

const crypto     = require("crypto");
const supabase   = require("../db/supabase");

// ── Config ────────────────────────────────────────────────────────────────────
const BULMS_URL        = process.env.BULMS_URL        || "https://bulms.bicol-u.edu.ph";
const BULMS_LOGIN_URL  = `${BULMS_URL}/login/index.php`;
const BULMS_MY_URL     = `${BULMS_URL}/my/`;
const COOKIE_KEY       = process.env.BULMS_COOKIE_KEY || null; 
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;  
const SCRAPE_TIMEOUT   = 60_000;          
const IS_HEADLESS      = process.env.BULMS_HEADLESS === "true" || process.env.NODE_ENV === "production";

// ── Encryption helpers ────────────────────────────────────────────────────────
function getKey() {
  if (!COOKIE_KEY || COOKIE_KEY.length < 64) {
    throw new Error("BULMS_COOKIE_KEY env var must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(COOKIE_KEY, "hex");
}

function encryptCookies(cookiesJson) {
  const key  = getKey();
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(cookiesJson, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    cookies_encrypted: encrypted.toString("hex"),
    iv:      iv.toString("hex"),
    auth_tag: authTag.toString("hex"),
  };
}

function decryptCookies(encrypted, iv, authTag) {
  const key    = getKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

// ── Browser factory (Stealth Mode) ────────────────────────────────────────────
async function launchBrowser(headless = IS_HEADLESS) {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--start-maximized"
  ];
  // Use puppeteerExtra instead of standard puppeteer
  const browser = await puppeteerExtra.launch({
    headless: headless ? "new" : false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args,
    defaultViewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
  });
  return browser;
}

async function updateLinkSession(token, patch) {
  await supabase.from("bulms_link_sessions").update({ ...patch }).eq("session_token", token);
}

async function waitForAny(page, selectors, timeout = 15_000) {
  const promises = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout }).then(() => sel).catch(() => null)
  );
  const found = await Promise.race(promises);
  return found;
}

function isLoginPage(url) {
  return (
    url.includes("/login/index.php") ||
    url.includes("/login/oauth2") ||
    url.includes("accounts.google.com")
  );
}

// ── Bulletproof Course Scraper ───────────────────────────────────────────────
async function scrapeCourses(page) {
  try {
    await page.goto(`${BULMS_URL}/my/`, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });

    await new Promise(res => setTimeout(res, 3000));
    if (isLoginPage(page.url())) return null;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    console.log(`[BULMS] Authenticated successfully. Waiting for courses to render...`);

    await page.waitForFunction(() => {
      return document.querySelectorAll("a[href*='course/view.php?id=']").length > 0;
    }, { timeout: 15000 }).catch(() => console.log("[BULMS] Timeout waiting for course links. Checking fallbacks..."));

    await new Promise(res => setTimeout(res, 1500));

    const evaluateLogic = (baseUrl) => {
      const courseMap = new Map();

      document.querySelectorAll("a[href*='course/view.php?id=']").forEach((a) => {
        const href = a.getAttribute("href");
        const match = href.match(/[?&]id=(\d+)/);
        if (!match) return;
        
        const courseId = match[1];
        const isMenuLink = a.closest('#nav-drawer') || a.closest('.dropdown-menu') || a.closest('nav');

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, { id: courseId, textSegments: [], card: null, href: href, isMenuLink });
        }

        const data = courseMap.get(courseId);
        
        if (data.isMenuLink && !isMenuLink) data.isMenuLink = false;

        if (!data.card && !isMenuLink) {
          data.card = a.closest('.card, .coursebox, .dashboard-card, .my-course-item, [data-region="course-events-container"]');
        }

        const text = a.textContent.trim();
        if (text) data.textSegments.push(text);
      });

      const results = [];

      courseMap.forEach((data, courseId) => {
        let courseName = "";
        let category = null;

        if (data.card) {
          const titleEl = data.card.querySelector(".coursename, .card-title, h3, h4, .multiline");
          if (titleEl) courseName = titleEl.textContent;
          
          const catEl = data.card.querySelector(".category-name, .text-muted, .course-category");
          if (catEl) category = catEl.textContent.trim();
        }

        if (!courseName || !courseName.trim()) {
          courseName = data.textSegments.sort((a, b) => b.length - a.length)[0] || "";
        }

        courseName = courseName
          .replace(/Course image/ig, '').replace(/Star course/ig, '').replace(/Course is starred/ig, '')
          .replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        if (courseName.length > 3) {
          results.push({
            course_id: courseId, course_name: courseName, short_name: null, category: category,
            course_url: data.href.startsWith("http") ? data.href : `${baseUrl}${data.href}`,
          });
        }
      });

      return results;
    };

    let courses;
    try {
      courses = await page.evaluate(evaluateLogic, BULMS_URL);
    } catch (evalErr) {
      if (evalErr.message.includes("Execution context was destroyed")) {
        await new Promise(res => setTimeout(res, 3000));
        if (isLoginPage(page.url())) return null;
        courses = await page.evaluate(evaluateLogic, BULMS_URL);
      } else {
        throw evalErr;
      }
    }

    if (!courses || courses.length === 0) {
      console.log(`[BULMS] 0 courses on /my/, trying /my/courses.php...`);
      await page.goto(`${BULMS_URL}/my/courses.php`, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });
      await new Promise(res => setTimeout(res, 3000));
      await page.waitForFunction(() => { return document.querySelectorAll("a[href*='course/view.php?id=']").length > 0; }, { timeout: 10000 }).catch(() => null);
      courses = await page.evaluate(evaluateLogic, BULMS_URL);
    }

    if (!courses || courses.length === 0) {
      const pageSnip = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\n/g, ' '));
      console.log(`[BULMS DEBUG] No courses found. Page text snippet: ${pageSnip}`);
    }

    return courses || [];
  } catch (err) {
    console.error("[BULMS] scrapeCourses error:", err.message);
    return [];
  }
}

// ── Scrape activities for a single course ─────────────────────────────────────
async function scrapeActivitiesForCourse(page, courseId, courseUrl) {
  try {
    const url = courseUrl || `${BULMS_URL}/course/view.php?id=${courseId}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });

    await new Promise(res => setTimeout(res, 2000));
    if (isLoginPage(page.url())) return null;

    await waitForAny(page, ["#region-main", ".course-content", ".topics", ".weeks"], 15_000);

    const evaluateLogic = (cid, baseUrl) => {
      const results = [];
      const activityEls = document.querySelectorAll(".activity, .activity-item, [data-activityname], li.activity");

      activityEls.forEach((el) => {
        const classList = el.className || "";
        let type = "resource";
        const typeMap = { modtype_assign: "assign", modtype_quiz: "quiz", modtype_forum: "forum", modtype_url: "url", modtype_resource: "resource", modtype_folder: "folder", modtype_page: "page", modtype_scorm: "scorm", modtype_survey: "survey", modtype_choice: "choice" };
        for (const [cls, t] of Object.entries(typeMap)) {
          if (classList.includes(cls)) { type = t; break; }
        }

        if (!["assign", "quiz", "forum"].includes(type)) return;

        const nameEl = el.querySelector(".instancename, .activity-name, [data-activityname], a .activityname") || el.querySelector("a");
        const linkEl = el.querySelector("a[href]");
        const href   = linkEl?.getAttribute("href") || "";
        const cmMatch = href.match(/[?&]id=(\d+)/);
        const activityId = el.getAttribute("id")?.replace("module-", "") || el.dataset?.id || cmMatch?.[1] || null;

        if (!activityId || !nameEl) return;

        let dueDate = null;
        const dueDateEl = el.querySelector(".activity-basis .text-truncate, .activitydate, [data-type='duedate'], .duedate");
        if (dueDateEl) {
          const raw = dueDateEl.textContent.trim().replace(/^Due:\s*/i, "");
          const parsed = Date.parse(raw);
          if (!isNaN(parsed)) dueDate = new Date(parsed).toISOString();
        }
        if (!dueDate) {
          const dateEl = el.querySelector("time, [title*='due'], [title*='Due']");
          if (dateEl) {
            const ts = dateEl.getAttribute("datetime") || dateEl.getAttribute("title");
            if (ts) {
              const parsed = Date.parse(ts);
              if (!isNaN(parsed)) dueDate = new Date(parsed).toISOString();
            }
          }
        }

        const statusEl = el.querySelector(".completion-badge, .submissionstatus, [data-completionstate], .autocompletion");
        let submissionStatus = "notsubmitted";
        if (statusEl) {
          const txt = statusEl.textContent.toLowerCase();
          if (txt.includes("submitted") || txt.includes("turned in") || txt.includes("complete")) submissionStatus = "submitted";
          else if (txt.includes("graded")) submissionStatus = "graded";
        }

        results.push({
          course_id: cid, activity_id: `${cid}_${activityId}`, activity_name: nameEl.textContent.trim().replace(/\s+/g, " ").replace(/Mark as done/ig, '').trim(),
          activity_type: type, due_date: dueDate, description: null, submission_status: submissionStatus, grade: null,
          activity_url: href.startsWith("http") ? href : `${baseUrl}${href}`,
        });
      });

      return results;
    };

    let activities;
    try {
      activities = await page.evaluate(evaluateLogic, courseId, BULMS_URL);
    } catch (evalErr) {
      if (evalErr.message.includes("Execution context was destroyed")) {
        await new Promise(res => setTimeout(res, 3000));
        if (isLoginPage(page.url())) return null;
        activities = await page.evaluate(evaluateLogic, courseId, BULMS_URL);
      } else {
        throw evalErr;
      }
    }

    return activities || [];
  } catch (err) {
    console.error(`[BULMS] scrapeActivities error for course ${courseId}:`, err.message);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════════

async function startLinkSession(userId, sessionToken) {
  let browser;
  const startedAt = Date.now();

  try {
    await updateLinkSession(sessionToken, { status: "waiting" });

    browser = await launchBrowser(false); 
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
    await page.goto(BULMS_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const loginSuccess = await page.waitForFunction(
      (myUrl) => {
        const url = window.location.href;
        return (url.includes("/my/") || url.includes("/dashboard") || document.querySelector(".usermenu, [data-key=\"myhome\"], #page-site-index, .dashboard-card, #page-my-index") !== null);
      },
      { timeout: LOGIN_TIMEOUT_MS }
    ).catch(() => null);

    if (!loginSuccess) {
      await updateLinkSession(sessionToken, { status: "timeout", error: "Login timed out." });
      return;
    }

    await updateLinkSession(sessionToken, { status: "scraping" });

    const cookies = await page.cookies();
    const cookiesJson = JSON.stringify(cookies);
    const { cookies_encrypted, iv, auth_tag } = encryptCookies(cookiesJson);

    const bulmsUserInfo = await page.evaluate(() => {
      const menuEl = document.querySelector(".usermenu .userbutton, .usertext");
      const profileLink = document.querySelector("a[href*='/user/profile']");
      let moodleUserId = null;
      if (profileLink) {
        const m = profileLink.getAttribute("href")?.match(/[?&]id=(\d+)/);
        if (m) moodleUserId = m[1];
      }
      return { moodle_username: menuEl?.textContent?.trim() || null, moodle_user_id: moodleUserId };
    }).catch(() => ({ moodle_username: null, moodle_user_id: null }));

    const { error: sessionErr } = await supabase
      .from("bulms_sessions")
      .upsert({
        user_id: userId, cookies_encrypted, iv, auth_tag, moodle_user_id: bulmsUserInfo.moodle_user_id,
        moodle_username: bulmsUserInfo.moodle_username, status: "active",
        last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (sessionErr) throw sessionErr;
    await updateLinkSession(sessionToken, { status: "done" });
  } catch (err) {
    console.error(`[BULMS] startLinkSession error for ${userId}:`, err.message);
    await updateLinkSession(sessionToken, { status: "failed", error: err.message?.slice(0, 200) }).catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
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
    await finishLog({ status: "failed", error_message: "No BULMS session found." });
    return { error: "no_session" };
  }
  if (session.status !== "active") {
    await finishLog({ status: "session_expired", error_message: "Session is not active." });
    return { error: "session_expired" };
  }

  let cookies;
  try {
    cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag);
  } catch (err) {
    await finishLog({ status: "failed", error_message: "Cookie decryption failed." });
    return { error: "decryption_failed" };
  }

  let browser;
  try {
    browser = await launchBrowser(true); 
    const page = await browser.newPage();

    // STEALTH: Inject extra headers to look like a real human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1'
    });

    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });

    const domain = new URL(BULMS_URL).hostname;
    for (const cookie of cookies) {
      try { await page.setCookie({ ...cookie, domain }); } catch {} 
    }

    await page.goto(BULMS_MY_URL, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });

    if (isLoginPage(page.url())) {
      await supabase.from("bulms_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
      await finishLog({ status: "session_expired", error_message: "Session expired — login required." });
      return { error: "session_expired" };
    }

    const courses = await scrapeCourses(page);
    if (!courses) {
      await finishLog({ status: "session_expired", error_message: "Redirected to login during scrape." });
      await supabase.from("bulms_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
      return { error: "session_expired" };
    }

    console.log(`[BULMS] Scraped ${courses.length} courses for user ${userId}.`);

    if (courses.length > 0) {
      const subjectRows = courses.map((c) => ({
        user_id: userId, course_id: c.course_id, course_name: c.course_name, short_name: c.short_name, category: c.category, course_url: c.course_url, synced_at: new Date().toISOString(),
      }));
      await supabase.from("bulms_subjects").upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    const allActivities = [];
    const coursesToScrape = courses.slice(0, 8); 

    for (const course of coursesToScrape) {
      const acts = await scrapeActivitiesForCourse(page, course.course_id, course.course_url);
      if (acts === null) break; 
      allActivities.push(...acts);
    }

    const { data: existingIds } = await supabase.from("bulms_activities").select("activity_id").eq("user_id", userId);
    const knownIds = new Set((existingIds || []).map((r) => r.activity_id));
    const newCount = allActivities.filter((a) => !knownIds.has(a.activity_id)).length;

    if (allActivities.length > 0) {
      const activityRows = allActivities.map((a) => ({
        user_id: userId, course_id: a.course_id, activity_id: a.activity_id, activity_name: a.activity_name, activity_type: a.activity_type, due_date: a.due_date, description: a.description, submission_status: a.submission_status, grade: a.grade, activity_url: a.activity_url, synced_at: new Date().toISOString(),
      }));
      await supabase.from("bulms_activities").upsert(activityRows, { onConflict: "user_id,activity_id" });
    }

    await supabase.from("bulms_sessions").update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId);
    await finishLog({ status: "success", subjects_count: courses.length, activities_count: allActivities.length, new_activities: newCount });

    return { subjects: courses, activities: allActivities, newCount, error: null };
  } catch (err) {
    console.error(`[BULMS] syncUserData error for ${userId}:`, err.message);
    await finishLog({ status: "failed", error_message: err.message?.slice(0, 300) });
    return { error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function validateSession(userId) {
  const { data: session } = await supabase.from("bulms_sessions").select("*").eq("user_id", userId).single();
  if (!session || session.status !== "active") return false;
  let cookies;
  try { cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag); }
  catch { return false; }
  let browser;
  try {
    browser = await launchBrowser(true);
    const page = await browser.newPage();
    const domain = new URL(BULMS_URL).hostname;
    for (const c of cookies) { try { await page.setCookie({ ...c, domain }); } catch {} }
    await page.goto(BULMS_MY_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const valid = !isLoginPage(page.url());
    if (!valid) await supabase.from("bulms_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
    return valid;
  } catch { return false; } 
  finally { if (browser) await browser.close().catch(() => {}); }
}

module.exports = { startLinkSession, syncUserData, validateSession, decryptCookies, encryptCookies };
