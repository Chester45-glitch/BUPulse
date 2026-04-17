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

        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("[Link Error]:", error.message);
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

        console.log("[Sync] Launching optimized browser...");
        
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--no-zygote', 
                '--single-process'
            ],
            // Path for your Singapore Docker Environment
            executablePath: '/usr/bin/chromium',
        });
        
        const page = await browser.newPage();

        // 1. ADD USER AGENT: Prevents site from blocking headless Chrome
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 2. OPTIMIZATION: Block heavy assets but KEEP scripts for AJAX loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log("[Sync] Applying cookies and navigating...");
        await page.setCookie(...rawCookies);
        
        // 3. IMPROVED NAVIGATION: Wait for network to be idle (AJAX finished)
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        const currentUrl = page.url();
        console.log(`[Sync] Landed on: ${currentUrl}`);

        if (currentUrl.includes('login/index.php')) {
            console.error("[Sync] Cookie rejected. Redirected to login.");
            throw new Error("Session expired. Please refresh your MoodleSession cookie.");
        }

        console.log("[Sync] Waiting for dashboard content...");
        
        // 4. SELECTOR RACE: Wait for courses OR timeline items
        try {
            await Promise.race([
                page.waitForSelector('.coursename', { timeout: 25000 }),
                page.waitForSelector('[data-region="event-list-item"]', { timeout: 25000 }),
                page.waitForSelector('.multiline', { timeout: 25000 })
            ]);
        } catch (e) {
            console.warn("[Sync Warning] Standard selectors not found. Attempting extraction anyway...");
        }

        // 5. RESILIENT EXTRACTION
        let { subjects, activities } = await page.evaluate(() => {
            // Find course names from various possible Moodle layouts
            const courseNodes = document.querySelectorAll('.coursename, .multiline, .dashboard-card-entry-title');
            const subjects = [...new Set(Array.from(courseNodes).map(el => el.innerText.trim()))]
                .filter(s => s.length > 5);
            
            // Find activities/deadlines
            const activities = Array.from(document.querySelectorAll('[data-region="event-list-item"]')).map(el => {
                const titleEl = el.querySelector('.event-name, h6, [data-region="event-name"]');
                const timeEl = el.querySelector('[data-region="event-date"]');
                return {
                    title: titleEl?.innerText.trim(),
                    dueDate: timeEl?.innerText.trim()
                };
            }).filter(a => a.title);
            
            return { subjects, activities };
        });

        console.log(`[Sync] Found ${subjects.length} subjects and ${activities.length} activities.`);

        // Normalize Dates
        const year = new Date().getFullYear();
        activities = activities.map(act => {
            let d = act.dueDate;
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

        await supabase
            .from('academic_data')
            .upsert({ user_id: userId, data: academicData });

        console.log("[Sync] Success! Data synced to Supabase.");
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
