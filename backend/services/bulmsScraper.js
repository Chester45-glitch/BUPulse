const puppeteer = require('puppeteer');
const fs = require('fs');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

/**
 * Links a BULMS account by saving the MoodleSession cookie and running an initial sync.
 */
async function linkBulmsAccount(userId, sessionCookie) {
    try {
        console.log(`[Link] Attempting to save session for user: ${userId}`);
        
        const cookies = [{
            name: 'MoodleSession',
            value: sessionCookie,
            domain: 'bulms.bicol-u.edu.ph',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax'
        }];

        const encryptedCookies = encryptData(JSON.stringify(cookies));

        const { error } = await supabase
            .from('user_credentials')
            .upsert({ 
                user_id: userId, 
                bulms_cookies: encryptedCookies, 
                status: 'connected',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log("[Link] Credentials saved to Supabase. Triggering first sync...");

        // Run the sync immediately to verify the key
        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("[Link Error]:", error.message);
        // Returning a user-friendly message for the frontend popup
        return { 
            success: false, 
            message: "Session Key expired or invalid. Please refresh BULMS and try again." 
        };
    }
}

/**
 * Launches a browser and scrapes subjects/activities from BULMS.
 */
async function autoSyncBulmsData(userId) {
    let browser;
    try {
        const { data: userCreds, error: dbError } = await supabase
            .from('user_credentials')
            .select('bulms_cookies')
            .eq('user_id', userId)
            .single();

        if (dbError || !userCreds) throw new Error("Credentials not found in database.");

        const decrypted = decryptData(userCreds.bulms_cookies);
        const rawCookies = JSON.parse(decrypted);

        console.log("[Sync] Searching for Chrome/Chromium binary...");
        
        // Render/Linux Path Discovery
        const possiblePaths = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/app/.apt/usr/bin/google-chrome-stable',
            '/app/.render/chrome/opt/google/chrome/chrome'
        ];

        const executablePath = possiblePaths.find(path => path && fs.existsSync(path));
        
        if (!executablePath) {
            console.warn("[Sync Warning] No hardcoded binary found. Falling back to Puppeteer default.");
        } else {
            console.log(`[Sync] Browser located at: ${executablePath}`);
        }

        browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for Render Free Tier
                '--disable-gpu',
                '--no-zygote', 
                '--single-process'         // Saves significant RAM
            ],
            executablePath: executablePath || undefined,
        });
        
        const page = await browser.newPage();
        
        // Speed Optimization: Block resource-heavy assets
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resource = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resource)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("[Sync] Applying cookies and navigating...");
        await page.setCookie(...rawCookies);
        
        // Use a longer timeout for Render Free Tier
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // ── Redirect Check ──
        const finalUrl = page.url();
        if (finalUrl.includes('login/index.php')) {
            console.error("[Sync] Redirected to login. Cookie is dead.");
            throw new Error("Session expired.");
        }

        console.log("[Sync] Page loaded. Waiting for dashboard content...");
        await page.waitForSelector('.coursename', { timeout: 20000 });

        // ── Data Extraction ──
        let { subjects, activities } = await page.evaluate(() => {
            // Get Subjects
            const subjectElements = document.querySelectorAll('.dashboard-card .coursename, .coursebox .coursename');
            const subjects = [...new Set(Array.from(subjectElements).map(el => el.innerText.trim()))]
                .filter(s => s.length > 2);
            
            // Get Activities/Events
            const activities = Array.from(document.querySelectorAll('[data-region="event-list-item"]')).map(el => {
                const titleEl = el.querySelector('.event-name, h6, [data-region="event-name"]');
                const timeEl = el.querySelector('[data-region="event-date"]');
                return {
                    title: titleEl?.innerText.trim(),
                    dueDate: timeEl?.innerText.trim()
                };
            });
            
            return { subjects, activities };
        });

        console.log(`[Sync] Found ${subjects.length} subjects and ${activities.length} activities.`);

        // ── Date Normalization ──
        const year = new Date().getFullYear();
        activities = activities.map(act => {
            let d = act.dueDate;
            // If date contains a comma but no year (e.g., "Saturday, 18 April"), inject current year
            if (d && d.includes(',') && !/\d{4}/.test(d)) {
                d = d.replace(',', ` ${year},`);
            }
            return { ...act, dueDate: d };
        });

        const academicData = { 
            subjects, 
            activities, 
            lastSynced: new Date().toISOString() 
        };

        // Save to Supabase
        await supabase
            .from('academic_data')
            .upsert({ user_id: userId, data: academicData });

        console.log("[Sync] Process complete. Data saved.");
        return { success: true, data: academicData };

    } catch (error) {
        console.error("[Sync Error Details]:", error.message);
        return { success: false, message: error.message };
    } finally {
        if (browser) {
            console.log("[Sync] Closing browser.");
            await browser.close();
        }
    }
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };
