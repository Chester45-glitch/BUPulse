/**
 * bulmsService.js — BUPulse BULMS Integration
 *
 * Puppeteer-powered scraper that:
 * 1. Opens a browser so the user can manually authenticate via Google SSO
 * 2. Captures and encrypts session cookies
 * 3. Scrapes subjects, activities, and due dates from Moodle
 * 4. Detects session expiry and marks the account as disconnected
 *
 * DEPLOYMENT NOTE:
 * - Development: headless: false opens a real visible window — no setup needed.
 * - Production server (Railway / Render / VPS):
 * apt-get install -y xvfb chromium-browser
 * PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
 * Start server with: xvfb-run -a node server.js
 * OR use headless: "new" (Chrome headless) with a display-less server.
 * The BULMS_HEADLESS env var controls this (default: false for local dev).
 */

const puppeteer  = require("puppeteer");
const crypto     = require("crypto");
const supabase   = require("../db/supabase");

// ── Config ────────────────────────────────────────────────────────────────────
const BULMS_URL        = process.env.BULMS_URL        || "https://bulms.bicol-u.edu.ph";
const BULMS_LOGIN_URL  = `${BULMS_URL}/login/index.php`;
const BULMS_MY_URL     = `${BULMS_URL}/my/`;
const COOKIE_KEY       = process.env.BULMS_COOKIE_KEY || null; // 32-byte hex key for AES-256-GCM
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min for user to complete Google OAuth
const SCRAPE_TIMEOUT   = 60_000;          // 1 min total for all scraping
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

// ── Browser factory ───────────────────────────────────────────────────────────
async function launchBrowser(headless = IS_HEADLESS) {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--start-maximized",
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];
  const browser = await puppeteer.launch({
    headless: headless ? "new" : false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args,
    defaultViewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
  });
  return browser;
}

// ── Session status update helper ──────────────────────────────────────────────
async function updateLinkSession(token, patch) {
  await supabase
    .from("bulms_link_sessions")
    .update({ ...patch })
    .eq("session_token", token);
}

// ── Wait for a selector with retry ───────────────────────────────────────────
async function waitForAny(page, selectors, timeout = 15_000) {
  const promises = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout }).then(() => sel).catch(() => null)
  );
  const found = await Promise.race(promises);
  return found;
}

// ── Detect if page is a login page (session expired) ─────────────────────────
function isLoginPage(url) {
  return (
    url.includes("/login/index.php") ||
    url.includes("/login/oauth2") ||
    url.includes("accounts.google.com") ||
    url.includes("login")
  );
}

// ── Scrape all courses from the My Courses dashboard ─────────────────────────
async function scrapeCourses(page) {
  try {
    await page.goto(`${BULMS_URL}/my/`, { waitUntil: "networkidle2", timeout: SCRAPE_TIMEOUT });

    // FIX: Wait for Moodle's delayed JS redirects to finish
    await new Promise(res => setTimeout(res, 3000));

    if (isLoginPage(page.url())) return null; // session expired

    // Try multiple possible Moodle dashboard selectors
    await waitForAny(page, [
      ".dashboard-card",
      ".course-info-container",
      ".coursename",
      "#region-main",
      ".my-course-item",
    ], 20_000);

    // FIX: One more small delay to ensure DOM is fully settled before evaluating
    await new Promise(res => setTimeout(res, 1000));

    const evaluateLogic = (baseUrl) => {
      const results = [];

      // Strategy 1: Moodle 4.x dashboard cards
      document.querySelectorAll(".dashboard-card, .course-card").forEach((card) => {
        const nameEl   = card.querySelector(".coursename a, .card-title a, h3 a, h4 a");
        const catEl    = card.querySelector(".category-name, .course-category");
        const shortEl  = card.querySelector(".shortname, [data-field='shortname']");
        const href     = nameEl?.getAttribute("href") || "";
        const match    = href.match(/[?&]id=(\d+)/);
        if (nameEl && match) {
          results.push({
            course_id:   match[1],
            course_name: nameEl.textContent.trim(),
            short_name:  shortEl?.textContent?.trim() || null,
            category:    catEl?.textContent?.trim()   || null,
            course_url:  href,
          });
        }
      });

      // Strategy 2: classic enrolled-courses list
      if (results.length === 0) {
        document.querySelectorAll(".course-info-container, .coursename, .enrolled-course-card").forEach((el) => {
          const nameEl = el.querySelector("a") || el.closest("a");
          if (!nameEl) return;
          const href  = nameEl.getAttribute("href") || "";
          const match = href.match(/[?&]id=(\d+)/);
          if (match) {
            results.push({
              course_id:   match[1],
              course_name: (el.querySelector(".course-title, h3, h4") || nameEl).textContent.trim(),
              short_name:  null,
              category:    null,
              course_url:  href.startsWith("http") ? href : `${baseUrl}${href}`,
            });
          }
        });
      }

      // Strategy 3: navigation block courses
      if (results.length === 0) {
        document.querySelectorAll(".type_course > a, [data-key='mycourses'] a").forEach((a) => {
          const href  = a.getAttribute("href") || "";
          const match = href.match(/[?&]id=(\d+)/);
          if (match) {
            results.push({
              course_id:   match[1],
              course_name: a.textContent.trim(),
              short_name:  null,
              category:    null,
              course_url:  href,
            });
          }
        });
      }

      // Deduplicate by course_id
      const seen = new Set();
      return results.filter((c) => {
        if (seen.has(c.course_id)) return false;
        seen.add(c.course_id);
        return true;
      });
    };

    // FIX: Catch context destruction and retry automatically
    let courses;
    try {
      courses = await page.evaluate(evaluateLogic, BULMS_URL);
    } catch (evalErr) {
      if (evalErr.message.includes("Execution context was destroyed")) {
        console.log("[BULMS] Context destroyed in courses, waiting 3s to retry...");
        await new Promise(res => setTimeout(res, 3000));
        if (isLoginPage(page.url())) return null;
        courses = await page.evaluate(evaluateLogic, BULMS_URL);
      } else {
        throw evalErr;
      }
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
    await page.goto(url, { waitUntil: "networkidle2", timeout: SCRAPE_TIMEOUT });

    // FIX: Add safety delay here as well
    await new Promise(res => setTimeout(res, 2000));

    if (isLoginPage(page.url())) return null; // session expired

    await waitForAny(page, ["#region-main", ".course-content", ".topics", ".weeks"], 15_000);

    await new Promise(res => setTimeout(res, 1000));

    const evaluateLogic = (cid, baseUrl) => {
      const results = [];

      // ── Unified activity selector (works for most Moodle 3.x/4.x themes) ──
      const activityEls = document.querySelectorAll(
        ".activity, .activity-item, [data-activityname], li.activity"
      );

      activityEls.forEach((el) => {
        // Determine activity type from class list
        const classList = el.className || "";
        let type = "resource";
        const typeMap = {
          modtype_assign:   "assign",
          modtype_quiz:     "quiz",
          modtype_forum:    "forum",
          modtype_url:      "url",
          modtype_resource: "resource",
          modtype_folder:   "folder",
          modtype_page:     "page",
          modtype_scorm:    "scorm",
          modtype_survey:   "survey",
          modtype_choice:   "choice",
        };
        for (const [cls, t] of Object.entries(typeMap)) {
          if (classList.includes(cls)) { type = t; break; }
        }

        // Only capture graded / submittable types
        if (!["assign", "quiz", "forum"].includes(type)) return;

        const nameEl   = el.querySelector(".instancename, .activity-name, [data-activityname], a .activityname") ||
                         el.querySelector("a");
        const linkEl   = el.querySelector("a[href]");
        const href     = linkEl?.getAttribute("href") || "";

        // Extract cmid from URL
        const cmMatch  = href.match(/[?&]id=(\d+)/);
        const activityId = el.getAttribute("id")?.replace("module-", "") ||
                           el.dataset?.id || cmMatch?.[1] || null;

        if (!activityId || !nameEl) return;

        // Due date — Moodle 4.x puts it in .activity-basis > span or data attributes
        let dueDate = null;
        const dueDateEl = el.querySelector(
          ".activity-basis .text-truncate, .activitydate, [data-type='duedate'], .duedate"
        );
        if (dueDateEl) {
          const raw = dueDateEl.textContent.trim().replace(/^Due:\s*/i, "");
          const parsed = Date.parse(raw);
          if (!isNaN(parsed)) dueDate = new Date(parsed).toISOString();
        }
        // Fall back to title attribute on date elements
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

        // Completion / submission status badge
        const statusEl = el.querySelector(
          ".completion-badge, .submissionstatus, [data-completionstate], .autocompletion"
        );
        let submissionStatus = "notsubmitted";
        if (statusEl) {
          const txt = statusEl.textContent.toLowerCase();
          if (txt.includes("submitted") || txt.includes("turned in")) submissionStatus = "submitted";
          else if (txt.includes("graded"))  submissionStatus = "graded";
          else if (txt.includes("complete")) submissionStatus = "submitted";
        }

        results.push({
          course_id:          cid,
          activity_id:        `${cid}_${activityId}`,
          activity_name:      nameEl.textContent.trim().replace(/\s+/g, " "),
          activity_type:      type,
          due_date:           dueDate,
          description:        null,
          submission_status:  submissionStatus,
          grade:              null,
          activity_url:       href.startsWith("http") ? href : `${baseUrl}${href}`,
        });
      });

      return results;
    };

    // FIX: Catch context destruction for activities as well
    let activities;
    try {
      activities = await page.evaluate(evaluateLogic, courseId, BULMS_URL);
    } catch (evalErr) {
      if (evalErr.message.includes("Execution context was destroyed")) {
        console.log(`[BULMS] Context destroyed in activities for ${courseId}, waiting 3s...`);
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

// ── Scrape submission status from individual assignment pages ──────────────────
async function enrichActivityDetails(page, activity) {
  if (activity.activity_type !== "assign") return activity;
  try {
    await page.goto(activity.activity_url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (isLoginPage(page.url())) return activity;

    const details = await page.evaluate(() => {
      // Due date from assignment details table
      let dueDate = null;
      document.querySelectorAll(".submissioninfotable tr, .generaltable tr").forEach((row) => {
        const label = row.querySelector("th, td:first-child")?.textContent?.toLowerCase() || "";
        if (label.includes("due date") || label.includes("due on")) {
          const val = row.querySelector("td:last-child, td:nth-child(2)")?.textContent?.trim();
          if (val) {
            const p = Date.parse(val);
            if (!isNaN(p)) dueDate = new Date(p).toISOString();
          }
        }
      });

      // Submission status
      let status = null;
      const submEl = document.querySelector(".submissionstatussubmitted, .submissionstatusnotsubmitted, [data-region='assignment-status'] .badge");
      if (submEl) {
        const txt = submEl.textContent.toLowerCase();
        if (txt.includes("submitted")) status = "submitted";
        else if (txt.includes("graded")) status = "graded";
        else status = "notsubmitted";
      }

      // Grade
      let grade = null;
      const gradeEl = document.querySelector(".gradingform_points, .feedback .grade, .grade");
      if (gradeEl) grade = gradeEl.textContent.trim();

      // Description
      let description = null;
      const descEl = document.querySelector(".activity-description, .intro, [data-region='assign-intro']");
      if (descEl) description = descEl.textContent.trim().slice(0, 500);

      return { dueDate, status, grade, description };
    });

    return {
      ...activity,
      due_date:          details.dueDate || activity.due_date,
      submission_status: details.status  || activity.submission_status,
      grade:             details.grade   || activity.grade,
      description:       details.description,
    };
  } catch {
    return activity; // fail gracefully
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * startLinkSession — launches Puppeteer, navigates to BULMS login,
 * waits for the user to authenticate, then extracts and stores cookies.
 *
 * @param {string} userId      - BUPulse user UUID
 * @param {string} sessionToken - unique token to track this link attempt
 * @returns {Promise<void>}    - resolves once cookies are saved (or rejects on timeout/error)
 */
async function startLinkSession(userId, sessionToken) {
  let browser;
  const startedAt = Date.now();

  try {
    await updateLinkSession(sessionToken, { status: "waiting" });

    browser = await launchBrowser(false); // Always headful for login — user must see the window
    const page = await browser.newPage();

    // Stealth: remove webdriver fingerprint
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(BULMS_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    console.log(`[BULMS] Browser opened for user ${userId}. Waiting for manual login…`);

    // ── Wait for user to complete Google OAuth (up to LOGIN_TIMEOUT_MS) ─────
    // We watch for any of the common post-login dashboard selectors
    const loginSuccess = await page.waitForFunction(
      (myUrl) => {
        const url = window.location.href;
        return (
          url.includes("/my/") ||
          url.includes("/dashboard") ||
          document.querySelector(".usermenu, [data-key=\"myhome\"], #page-site-index, .dashboard-card, #page-my-index") !== null
        );
      },
      { timeout: LOGIN_TIMEOUT_MS }
    ).catch(() => null);

    if (!loginSuccess) {
      await updateLinkSession(sessionToken, { status: "timeout", error: "Login timed out after 5 minutes." });
      return;
    }

    console.log(`[BULMS] Login detected for user ${userId}. Extracting cookies…`);
    await updateLinkSession(sessionToken, { status: "scraping" });

    // ── Extract all cookies ────────────────────────────────────────────────
    const cookies = await page.cookies();
    const cookiesJson = JSON.stringify(cookies);
    const { cookies_encrypted, iv, auth_tag } = encryptCookies(cookiesJson);

    // ── Extract BULMS user info if available ───────────────────────────────
    const bulmsUserInfo = await page.evaluate(() => {
      const menuEl = document.querySelector(".usermenu .userbutton, .usertext");
      const profileLink = document.querySelector("a[href*='/user/profile']");
      let moodleUserId = null;
      if (profileLink) {
        const m = profileLink.getAttribute("href")?.match(/[?&]id=(\d+)/);
        if (m) moodleUserId = m[1];
      }
      return {
        moodle_username: menuEl?.textContent?.trim() || null,
        moodle_user_id:  moodleUserId,
      };
    }).catch(() => ({ moodle_username: null, moodle_user_id: null }));

    // ── Upsert session into DB ─────────────────────────────────────────────
    const { error: sessionErr } = await supabase
      .from("bulms_sessions")
      .upsert({
        user_id:           userId,
        cookies_encrypted,
        iv,
        auth_tag,
        moodle_user_id:    bulmsUserInfo.moodle_user_id,
        moodle_username:   bulmsUserInfo.moodle_username,
        status:            "active",
        last_verified_at:  new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (sessionErr) throw sessionErr;

    await updateLinkSession(sessionToken, { status: "done" });
    console.log(`[BULMS] Session saved for user ${userId}.`);

  } catch (err) {
    console.error(`[BULMS] startLinkSession error for ${userId}:`, err.message);
    await updateLinkSession(sessionToken, {
      status: "failed",
      error: err.message?.slice(0, 200),
    }).catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
    const elapsed = Date.now() - startedAt;
    console.log(`[BULMS] Link session finished in ${(elapsed / 1000).toFixed(1)}s for user ${userId}.`);
  }
}

/**
 * syncUserData — uses stored cookies to scrape fresh academic data.
 *
 * @param {string}  userId
 * @param {string}  triggeredBy  - 'auto' | 'manual'
 * @returns {Promise<{subjects, activities, newCount, error}>}
 */
async function syncUserData(userId, triggeredBy = "auto") {
  const syncStart = Date.now();
  let logId;

  // Create sync log entry
  const { data: logRow } = await supabase
    .from("bulms_sync_logs")
    .insert({ user_id: userId, triggered_by: triggeredBy, status: "running" })
    .select("id")
    .single();
  logId = logRow?.id;

  const finishLog = async (patch) => {
    if (!logId) return;
    await supabase
      .from("bulms_sync_logs")
      .update({ ...patch, finished_at: new Date().toISOString(), duration_ms: Date.now() - syncStart })
      .eq("id", logId);
  };

  // ── Load session ──────────────────────────────────────────────────────────
  const { data: session, error: sessErr } = await supabase
    .from("bulms_sessions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (sessErr || !session) {
    await finishLog({ status: "failed", error_message: "No BULMS session found." });
    return { error: "no_session" };
  }
  if (session.status !== "active") {
    await finishLog({ status: "session_expired", error_message: "Session is not active." });
    return { error: "session_expired" };
  }

  // ── Decrypt cookies ───────────────────────────────────────────────────────
  let cookies;
  try {
    cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag);
  } catch (err) {
    await finishLog({ status: "failed", error_message: "Cookie decryption failed." });
    return { error: "decryption_failed" };
  }

  let browser;
  try {
    browser = await launchBrowser(true); // headless for scraping
    const page = await browser.newPage();

    // Stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // ── Restore session cookies ───────────────────────────────────────────
    const domain = new URL(BULMS_URL).hostname;
    for (const cookie of cookies) {
      try {
        await page.setCookie({ ...cookie, domain });
      } catch {} // skip malformed cookies
    }

    // ── Navigate to dashboard ─────────────────────────────────────────────
    await page.goto(BULMS_MY_URL, { waitUntil: "networkidle2", timeout: SCRAPE_TIMEOUT });

    // ── Check if session is still valid ───────────────────────────────────
    if (isLoginPage(page.url())) {
      await supabase
        .from("bulms_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      await finishLog({ status: "session_expired", error_message: "Session expired — login required." });
      return { error: "session_expired" };
    }

    // ── Scrape courses ────────────────────────────────────────────────────
    const courses = await scrapeCourses(page);
    if (!courses) {
      await finishLog({ status: "session_expired", error_message: "Redirected to login during scrape." });
      await supabase
        .from("bulms_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      return { error: "session_expired" };
    }

    console.log(`[BULMS] Scraped ${courses.length} courses for user ${userId}.`);

    // ── Upsert subjects ───────────────────────────────────────────────────
    if (courses.length > 0) {
      const subjectRows = courses.map((c) => ({
        user_id:     userId,
        course_id:   c.course_id,
        course_name: c.course_name,
        short_name:  c.short_name,
        category:    c.category,
        course_url:  c.course_url,
        synced_at:   new Date().toISOString(),
      }));
      await supabase
        .from("bulms_subjects")
        .upsert(subjectRows, { onConflict: "user_id,course_id" });
    }

    // ── Scrape activities per course (limit to first 8 to avoid timeouts) ──
    const allActivities = [];
    const coursesToScrape = courses.slice(0, 8);

    for (const course of coursesToScrape) {
      const acts = await scrapeActivitiesForCourse(page, course.course_id, course.course_url);
      if (acts === null) { // session expired mid-scrape
        break;
      }
      allActivities.push(...acts);
    }

    // ── Determine "new" activities (not previously seen) ─────────────────
    const { data: existingIds } = await supabase
      .from("bulms_activities")
      .select("activity_id")
      .eq("user_id", userId);

    const knownIds = new Set((existingIds || []).map((r) => r.activity_id));
    const newCount = allActivities.filter((a) => !knownIds.has(a.activity_id)).length;

    // ── Upsert activities ─────────────────────────────────────────────────
    if (allActivities.length > 0) {
      const activityRows = allActivities.map((a) => ({
        user_id:           userId,
        course_id:         a.course_id,
        activity_id:       a.activity_id,
        activity_name:     a.activity_name,
        activity_type:     a.activity_type,
        due_date:          a.due_date,
        description:       a.description,
        submission_status: a.submission_status,
        grade:             a.grade,
        activity_url:      a.activity_url,
        synced_at:         new Date().toISOString(),
      }));
      await supabase
        .from("bulms_activities")
        .upsert(activityRows, { onConflict: "user_id,activity_id" });
    }

    // ── Update session last verified ──────────────────────────────────────
    await supabase
      .from("bulms_sessions")
      .update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    await finishLog({
      status:           "success",
      subjects_count:   courses.length,
      activities_count: allActivities.length,
      new_activities:   newCount,
    });

    return {
      subjects:    courses,
      activities:  allActivities,
      newCount,
      error:       null,
    };

  } catch (err) {
    console.error(`[BULMS] syncUserData error for ${userId}:`, err.message);
    await finishLog({ status: "failed", error_message: err.message?.slice(0, 300) });
    return { error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * validateSession — quick check: loads BULMS dashboard with stored cookies,
 * returns true if session is still valid, false otherwise.
 */
async function validateSession(userId) {
  const { data: session } = await supabase
    .from("bulms_sessions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!session || session.status !== "active") return false;

  let cookies;
  try { cookies = decryptCookies(session.cookies_encrypted, session.iv, session.auth_tag); }
  catch { return false; }

  let browser;
  try {
    browser = await launchBrowser(true);
    const page = await browser.newPage();
    const domain = new URL(BULMS_URL).hostname;
    for (const c of cookies) {
      try { await page.setCookie({ ...c, domain }); } catch {}
    }
    await page.goto(BULMS_MY_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const valid = !isLoginPage(page.url());

    if (!valid) {
      await supabase
        .from("bulms_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    return valid;
  } catch {
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  startLinkSession,
  syncUserData,
  validateSession,
  decryptCookies,
  encryptCookies,
};
