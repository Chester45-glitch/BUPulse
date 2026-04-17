const puppeteer = require('puppeteer');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

async function linkBulmsAccount(userId, sessionCookie) {
    try {
        console.log(`[Link] Syncing session for: ${userId}`);
        const cookies = [{
            name: 'MoodleSession',
            value: sessionCookie,
            domain: 'bulms.bicol-u.edu.ph',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax' // Added for better compatibility
        }];

        const encryptedCookies = encryptData(JSON.stringify(cookies));

        const { error } = await supabase
            .from('user_credentials')
            .upsert({ user_id: userId, bulms_cookies: encryptedCookies, status: 'connected' });

        if (error) throw error;
        
        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("[Link Error]:", error.message);
        // This is the message you see in the popup
        return { success: false, message: "Session Key expired or invalid. Please refresh BULMS and try again." };
    }
}

async function autoSyncBulmsData(userId) {
    let browser;
    try {
        const { data: userCreds } = await supabase
            .from('user_credentials')
            .select('bulms_cookies')
            .eq('user_id', userId)
            .single();

        if (!userCreds) throw new Error("No credentials found in database.");

        const rawCookies = JSON.parse(decryptData(userCreds.bulms_cookies));

        console.log("[Sync] Launching optimized browser...");
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Optimization: Skip images/CSS
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log("[Sync] Applying cookies and navigating...");
        await page.setCookie(...rawCookies);
        
        // Navigate to the dashboard
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // ── DIAGNOSTIC CHECK ──
        const currentUrl = page.url();
        console.log(`[Sync] Landed on: ${currentUrl}`);

        if (currentUrl.includes('login/index.php')) {
            console.error("[Sync] ERROR: Redirected to Login. Cookie was rejected.");
            throw new Error("Your session key is invalid or expired.");
        }

        console.log("[Sync] Waiting for content...");
        // Increase timeout for Render Free tier
        await page.waitForSelector('.coursename', { timeout: 20000 });

        const data = await page.evaluate(() => {
            const subjects = [...new Set(Array.from(document.querySelectorAll('.coursename')).map(el => el.innerText.trim()))];
            const activities = Array.from(document.querySelectorAll('[data-region="event-list-item"]')).map(el => {
                const titleEl = el.querySelector('.event-name, h6');
                const timeEl = el.querySelector('[data-region="event-date"]');
                return {
                    title: titleEl?.innerText.trim(),
                    dueDate: timeEl?.innerText.trim()
                };
            });
            return { subjects, activities };
        });

        // Clean dates
        const year = new Date().getFullYear();
        data.activities = data.activities.map(a => ({
            ...a,
            dueDate: a.dueDate?.includes(',') && !/\d{4}/.test(a.dueDate) ? a.dueDate.replace(',', ` ${year},`) : a.dueDate
        }));

        await supabase.from('academic_data').upsert({ user_id: userId, data: { ...data, lastSynced: new Date().toISOString() }});
        
        console.log("[Sync] Success!");
        return { success: true, data };

    } catch (error) {
        console.error("[Sync Error Details]:", error.message);
        throw error; // Re-throw so linkBulmsAccount catches it
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };
