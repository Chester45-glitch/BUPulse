/**
 * bulmsScraper.js
 * ──────────────────────────────────────────────────────────────────
 * Handles all Puppeteer logic for the BULMS LMS integration:
 *   - Launching a headed browser for manual Google login
 *   - Detecting successful login via URL / DOM selectors
 *   - Extracting + encrypting session cookies
 *   - Restoring sessions and scraping academic data
 *
 * BULMS is a Moodle-based LMS. All selectors target standard Moodle
 * DOM patterns with multiple fallbacks for layout resilience.
 * ──────────────────────────────────────────────────────────────────
 */

const puppeteer = require("puppeteer");
const crypto    = require("crypto");
const supabase  = require("../db/supabase");

// ── Config ──────────────────────────────────────────────────────
const BULMS_URL      = (process.env.BULMS_URL || "https://bulms.bicol.edu.ph").replace(/\/$/, "");
const LOGIN_TIMEOUT  = 4 * 60 * 1000;   // 4 minutes for user to log in
const NAV_TIMEOUT    = 30 * 1000;
const CHECK_INTERVAL = 2 * 1000;        // Poll every 2s for login detection

// AES-256-CBC key — must be exactly 32 bytes
const RAW_KEY = process.env.BULMS_ENCRYPTION_KEY || "bupulse-bulms-default-key-32byte";
const ENC_KEY = Buffer.from(RAW_KEY.padEnd(32, "0").slice(0, 32));

// In-memory registry of active headed browser sessions (userId → { browser, page })
const activeSessions = new Map();

// ── Encryption helpers ───────────────────────────────────────────
function encrypt(plaintext) {
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  const enc     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

function decrypt(ciphertext) {
  const [ivHex, encHex] = ciphertext.split(":");
  const iv       = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  const dec      = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}


// ── Clean subject name: strip course code prefixes ────────────────
// Converts "CS 104B - Data Structure and Algorithm" → "Data Structure and Algorithm"
// Converts "IT 203 - Networking 2" → "Networking 2"
const cleanSubjectName = (name) => {
  if (!name) return name;
  let s = name.trim();
  // 1. Strip BULMS literal prefixes: "Course name ", "Course starred " etc.
  s = s.replace(/^Course\s+(name|starred|pinned|archived|active)?\s*/i, "").trim();
  // 2. Strip course code prefixes: "CS 104B - ", "IT 203 - ", "CS-IT-IS_106 - "
  s = s.replace(/^[A-Z]{2,}[\s\-_]*[A-Z0-9]*[\s\-_]*\d+[A-Z0-9]*[\s\-_]*[-\u2013\u2014]+\s*/i, "").trim();
  return s || name.trim();
};

// ── Launch browser for manual user login ─────────────────────────
/**
 * Opens a real (headed) browser window so the user can complete
 * Google OAuth on BULMS manually. Resolves once login is detected.
 *
 * @param {string}   userId   - BUPulse user UUID
 * @param {Function} onStatus - Callback: ({ status, message }) => void
 * @returns {{ page, browser, allCookies }}
 */
async function launchLoginSession(userId, onStatus) {
  // Close any stale session for this user
  if (activeSessions.has(userId)) {
    try { await activeSessions.get(userId).browser.close(); } catch {}
    activeSessions.delete(userId);
  }

  onStatus({ status: "launching", message: "Opening BULMS login window…" });

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,820",
      "--window-position=120,80",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();

  // Remove webdriver fingerprint so Google OAuth doesn't block us
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  activeSessions.set(userId, { browser, page });

  try {
    await page.goto(`${BULMS_URL}/login/index.php`, {
      waitUntil: "networkidle2",
      timeout: NAV_TIMEOUT,
    });
  } catch {
    // BULMS might redirect immediately — ignore nav timeout
  }

  onStatus({
    status: "waiting_login",
    message: "A browser window has opened. Please log in with your Google account.",
  });

  // ── Poll until login is detected ──────────────────────────────
  return new Promise((resolve, reject) => {
    let resolved = false;

    const hardTimeout = setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      clearInterval(poll);
      try { await browser.close(); } catch {}
      activeSessions.delete(userId);
      reject(new Error("Login timeout — the window was open for 4 minutes with no login detected."));
    }, LOGIN_TIMEOUT);

    const poll = setInterval(async () => {
      if (resolved) return;
      try {
        const url = page.url();

        // Consider logged in if URL moved away from /login and looks like a Moodle page
        const awayFromLogin = !url.includes("/login/") && url.startsWith(BULMS_URL);
        // Also check for the Moodle user-menu element
        const userMenu = await page
          .$(".usermenu, #user-menu-toggle, [data-region=\"usermenu\"], .navbar-nav .usermenu")
          .catch(() => null);

        if (awayFromLogin || userMenu) {
          resolved = true;
          clearTimeout(hardTimeout);
          clearInterval(poll);

          onStatus({ status: "logged_in", message: "Login detected! Saving your session…" });

          const allCookies = await page.cookies();
          resolve({ page, browser, allCookies });
        }
      } catch {
        // Page is navigating — skip this tick
      }
    }, CHECK_INTERVAL);
  });
}

// ── Save session to Supabase ─────────────────────────────────────
async function saveSession(userId, allCookies) {
  const encrypted = encrypt(JSON.stringify(allCookies));
  const { error } = await supabase
    .from("bulms_sessions")
    .upsert(
      {
        user_id:            userId,
        cookies_encrypted:  encrypted,
        status:             "active",
        sync_error:         null,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`Failed to save session: ${error.message}`);
}

// ── Load session from Supabase ───────────────────────────────────
async function loadSession(userId) {
  const { data, error } = await supabase
    .from("bulms_sessions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  if (data.status !== "active") return null;

  try {
    const cookies = JSON.parse(decrypt(data.cookies_encrypted));
    return { ...data, cookies };
  } catch {
    return null;
  }
}

// ── Scrape academic data from an authenticated page ──────────────
/**
 * Navigates around BULMS and extracts:
 *   - subjects  : [{ name, url }]
 *   - activities: [{ id, name, courseName, courseId, dueDate, type, url, description }]
 *
 * Uses Moodle AJAX API first; falls back to DOM scraping.
 */
async function scrapeAcademicData(page) {
  const result = {
    subjects:   [],
    activities: [],
    scrapedAt:  new Date().toISOString(),
  };

  // ── Navigate to My Dashboard ──────────────────────────────────
  try {
    await page.goto(`${BULMS_URL}/my/`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
  } catch {
    // Partial load — continue anyway
  }

  const currentUrl = page.url();
  if (currentUrl.includes("/login/")) throw new Error("SESSION_EXPIRED");

  // ── Extract courses / subjects ────────────────────────────────
  result.subjects = await page.evaluate(() => {
    const SELECTORS = [
      ".course-info-container",
      "[data-region=\"course-content\"]",
      ".coursebox",
      ".card.dashboard-card",
      "[data-region=\"myoverview\"] .card",
      ".course-listitem",
      "[data-type=\"course\"]",
    ];

    let elements = [];
    for (const sel of SELECTORS) {
      elements = Array.from(document.querySelectorAll(sel));
      if (elements.length > 0) break;
    }

    return elements.map(el => {
      const anchor =
        el.querySelector("h3 a, h4 a, .coursename a, .card-title a, .multiline a, a[title]");
      return {
        name: cleanSubjectName(anchor?.textContent?.trim() || el.textContent?.trim().slice(0, 80) || "Unknown"),
        url:  anchor?.href || null,
      };
    }).filter(s => s.name && s.name !== "Unknown");
  });

  // ── Extract upcoming activities via Moodle AJAX API ──────────
  try {
    const nowSec     = Math.floor(Date.now() / 1000);
    const futuresSec = nowSec + 60 * 60 * 24 * 45; // next 45 days

    const apiEvents = await page.evaluate(
      async (baseUrl, from, to) => {
        // Grab the sesskey Moodle embeds in the page JS config
        const sesskey = (typeof M !== "undefined" && M?.cfg?.sesskey) || "";
        const resp = await fetch(`${baseUrl}/lib/ajax/service.php?sesskey=${sesskey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([
            {
              index:      0,
              methodname: "core_calendar_get_action_events_by_timesort",
              args: { limitnum: 50, timesortfrom: from, timesortto: to },
            },
          ]),
        });
        if (!resp.ok) return null;
        return resp.json();
      },
      BULMS_URL,
      nowSec,
      futuresSec
    );

    if (apiEvents?.[0]?.data?.events?.length > 0) {
      result.activities = apiEvents[0].data.events.map(ev => ({
        id:          ev.id,
        name:        ev.name,
        courseName:  cleanSubjectName(ev.course?.fullname || ""),
        courseId:    ev.courseid || null,
        dueDate:     ev.timesort ? new Date(ev.timesort * 1000).toISOString() : null,
        type:        ev.eventtype || "activity",
        url:         ev.url || null,
        description: (ev.description || "").replace(/<[^>]*>/g, "").trim().slice(0, 300),
      }));
    }
  } catch (err) {
    console.warn("[BULMS] AJAX scrape failed, falling back to calendar DOM:", err.message);
  }

  // ── Fallback: scrape calendar page DOM ────────────────────────
  if (result.activities.length === 0) {
    try {
      await page.goto(`${BULMS_URL}/calendar/view.php?view=upcoming`, {
        waitUntil: "networkidle2",
        timeout: NAV_TIMEOUT,
      });

      result.activities = await page.evaluate(() => {
        const EVENT_SEL = [
          "[data-region=\"event-item\"]",
          ".event",
          ".calendar-event-panel",
          ".calendarwrapper li",
        ];

        let events = [];
        for (const sel of EVENT_SEL) {
          events = Array.from(document.querySelectorAll(sel));
          if (events.length > 0) break;
        }

        return events.slice(0, 50).map(el => {
          const anchor = el.querySelector("a[data-action=\"view-event\"], h3 a, a");
          const dateEl = el.querySelector("time, .date, .calendar-event-panel-side time");
          return {
            id:          null,
            name:        anchor?.textContent?.trim() || el.textContent?.trim().slice(0, 100),
            courseName:  el.querySelector(".course, .coursename")?.textContent?.trim() || "",
            courseId:    null,
            dueDate:     dateEl?.getAttribute("datetime") || dateEl?.textContent?.trim() || null,
            type:        "calendar",
            url:         anchor?.href || null,
            description: "",
          };
        }).filter(a => a.name);
      });
    } catch (err) {
      console.warn("[BULMS] Calendar DOM scrape failed:", err.message);
    }
  }

  return result;
}

// ── Headless sync using saved cookies ────────────────────────────
/**
 * Restores a saved Moodle session (no browser window shown),
 * checks validity, and scrapes fresh academic data.
 *
 * Throws "SESSION_EXPIRED" or "NO_SESSION" on failure.
 */
async function syncWithSavedSession(userId) {
  const sessionData = await loadSession(userId);
  if (!sessionData) throw new Error("NO_SESSION");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const hostname = new URL(BULMS_URL).hostname;

    // Restore all saved cookies
    const cookiesWithDomain = sessionData.cookies.map(c => ({
      ...c,
      domain: c.domain || hostname,
    }));
    await page.setCookie(...cookiesWithDomain);

    // Navigate to dashboard
    try {
      await page.goto(`${BULMS_URL}/my/`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    } catch {
      // Partial load — check URL anyway
    }

    if (page.url().includes("/login/")) {
      // Mark session as expired in DB
      await supabase
        .from("bulms_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      throw new Error("SESSION_EXPIRED");
    }

    const data = await scrapeAcademicData(page);
    await browser.close();
    return data;
  } catch (err) {
    try { await browser.close(); } catch {}
    throw err;
  }
}

module.exports = {
  launchLoginSession,
  saveSession,
  loadSession,
  scrapeAcademicData,
  syncWithSavedSession,
  activeSessions,
};
