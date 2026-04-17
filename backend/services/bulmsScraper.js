const puppeteer = require('puppeteer');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

async function linkBulmsAccount(userId, sessionCookie) {
    try {
        console.log(`[Link] Attempting to save session for user: ${userId}`);
        const cookies = [{
            name: 'MoodleSession',
            value: sessionCookie,
            domain: 'bulms.bicol-u.edu.ph',
            path: '/',
            httpOnly: true,
            secure: true
        }];

        const encryptedCookies = encryptData(JSON.stringify(cookies));

        const { error } = await supabase
            .from('user_credentials')
            .upsert({ user_id: userId, bulms_cookies: encryptedCookies, status: 'connected' });

        if (error) throw error;
        console.log("[Link] Credentials saved to Supabase. Starting initial sync...");

        // Verify the key immediately
        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("[Link Error]:", error.message);
        return { success: false, message: "Sync failed. Ensure your session key is fresh." };
    }
}

async function autoSyncBulmsData(userId) {
    let browser;
    try {
        const { data: userCreds, error } = await supabase
            .from('user_credentials')
            .select('bulms_cookies')
            .eq('user_id', userId)
            .single();

        if (error || !userCreds) throw new Error("Credentials not found.");

        const decrypted = decryptData(userCreds.bulms_cookies);
        const rawCookies = JSON.parse(decrypted);

        console.log("[Sync] Launching browser...");
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // CRITICAL: Uses disk instead of RAM
                '--disable-gpu',           // Saves memory
                '--no-zygote', 
                '--single-process'         // Saves memory
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // SPEED & RAM BOOST: Block images and CSS
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log("[Sync] Setting cookies and navigating to BULMS...");
        await page.setCookie(...rawCookies);
        
        // Use 'domcontentloaded' instead of 'networkidle2' (it's faster and less prone to timeouts)
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        
        // Wait for the course list to appear
        await page.waitForSelector('.coursename', { timeout: 15000 });

        console.log("[Sync] Page loaded. Extracting data...");
        let { subjects, activities } = await page.evaluate(() => {
            const subjectLinks = Array.from(document.querySelectorAll('.dashboard-card .coursename, .coursebox .coursename'))
                .map(el => el.innerText.replace(/\n/g, ' ').trim())
                .filter(text => text.length > 5);
            
            const uniqueSubjects = [...new Set(subjectLinks)];
            const rawActivities = [];
            const listGroups = document.querySelectorAll('.list-group');
            
            listGroups.forEach(group => {
                const headerEl = group.previousElementSibling;
                let dateStr = headerEl ? headerEl.innerText.trim() : "";
                const items = group.querySelectorAll('[data-region="event-list-item"]');
                items.forEach(el => {
                    const titleEl = el.querySelector('.event-name, h6, [data-region="event-name"]');
                    const courseEl = el.querySelector('.text-muted, small, a[href*="course/view.php"]');
                    const timeEl = el.querySelector('.text-end, .text-right, [data-region="event-date"]');
                    if (titleEl) {
                        rawActivities.push({
                            title: (courseEl ? courseEl.innerText.trim() + " - " : "") + titleEl.innerText.trim(),
                            dueDate: `${dateStr} ${timeEl ? timeEl.innerText.trim() : ""}`.trim()
                        });
                    }
                });
            });
            return { subjects: uniqueSubjects, activities: rawActivities };
        });

        console.log(`[Sync] Found ${subjects.length} subjects and ${activities.length} activities.`);

        const today = new Date();
        activities = activities.map(act => {
            let d = act.dueDate;
            if (d && d.includes(',')) {
                d = d.substring(d.indexOf(',') + 1).trim();
                if (!/\d{4}/.test(d)) d = d.replace(",", ` ${today.getFullYear()},`);
            }
            return { ...act, dueDate: d };
        });

        const academicData = { subjects, activities, lastSynced: new Date().toISOString() };
        await supabase.from('academic_data').upsert({ user_id: userId, data: academicData });

        console.log("[Sync] Successfully saved to Supabase.");
        return { success: true, data: academicData };

    } catch (error) {
        console.error("[Sync Error]:", error.message);
        return { success: false, message: error.message };
    } finally {
        if (browser) {
            console.log("[Sync] Closing browser.");
            await browser.close();
        }
    }
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };