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

        // Save credentials to Supabase
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

        // Run the sync immediately to verify the key and pull initial data
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
 * Launches a browser and scrapes subjects/activities from BULMS dashboard.
 */
async function autoSyncBulmsData(userId) {
    let browser;
    try {
        // 1. Fetch encrypted cookies from DB
        const { data: userCreds, error: dbError } = await supabase
            .from('user_credentials')
            .select('bulms_cookies')
            .eq('user_id', userId)
            .single();

        if (dbError || !userCreds) throw new Error("Credentials not found in database.");

        const decrypted = decryptData(userCreds.bulms_cookies);
        const rawCookies = JSON.parse(decrypted);

        console.log("[Sync] Launching Docker-optimized browser...");
        
        // 2. Launch Puppeteer (Configured for Docker/Linux)
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for Render's 512MB RAM
                '--disable-gpu',
                '--no-zygote', 
                '--single-process'
            ],
            // This is the standard path in our Dockerfile
            executablePath: '/usr/bin/chromium',
        });
        
        const page = await browser.newPage();

        // 3. Set a real User Agent to avoid being blocked as a bot
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // 4. Optimization: Block images and media to save bandwidth/RAM
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log("[Sync] Applying cookies and navigating...");
        await page.setCookie(...rawCookies);
        
        // 5. Navigate to Dashboard
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        // Diagnostic Check: Verify if we were redirected
        const currentUrl = page.url();
        console.log(`[Sync] Landed on: ${currentUrl}`);

        if (currentUrl.includes('login/index.php')) {
            console.error("[Sync] Cookie rejected. Redirected to login page.");
            throw new Error("Session expired. Please get a new MoodleSession cookie.");
        }

        // 6. Mandatory Wait: Give Bicol U's AJAX cards time to render
        console.log("[Sync] Waiting 5 seconds for dashboard cards to load...");
        await new Promise(r => setTimeout(r, 5000)); 

        // 7. Scrape Content with Fallback Selectors
        const data = await page.evaluate(() => {
            // Find course names (Resilient Selectors for Bicol U Theme)
            const subjectNodes = document.querySelectorAll('.coursename, .multiline, .dashboard-card-entry-title, h6.mb-0');
            const subjects = [...new Set(Array.from(subjectNodes).map(el => el.innerText.trim()))]
                .filter(name => name.length > 5 && !name.includes('Dashboard') && !name.includes('Home'));

            // Find assignments/activities (Timeline & Calendar)
            const activityNodes = Array.from(document.querySelectorAll('[data-region="event-list-item"], .event-name, .list-group-item[data-event-id]'));
            
            const activities = activityNodes.map(el => {
                const titleEl = el.querySelector('.event-name, a, h6') || el;
                const timeEl = el.querySelector('[data-region="event-date"], .text-muted, small');
                
                return {
                    title: titleEl?.innerText.trim(),
                    dueDate: timeEl?.innerText.trim()
                };
            }).filter(act => act.title && act.title.length > 2);

            return { subjects, activities };
        });

        console.log(`[Sync] Successfully extracted ${data.subjects.length} subjects and ${data.activities.length} activities.`);

        // 8. Date Normalization (Ensures sorting works in frontend)
        const year = new Date().getFullYear();
        data.activities = data.activities.map(act => {
            let d = act.dueDate;
            if (d && d.includes(',') && !/\d{4}/.test(d)) {
                d = d.replace(',', ` ${year},`);
            }
            return { ...act, dueDate: d };
        });

        // 9. Save final data to Supabase
        const academicData = { 
            ...data, 
            lastSynced: new Date().toISOString() 
        };

        await supabase
            .from('academic_data')
            .upsert({ user_id: userId, data: academicData });

        console.log("[Sync] Database updated. Process complete.");
        return { success: true, data: academicData };

    } catch (error) {
        console.error("[Sync Error Details]:", error.message);
        return { success: false, message: error.message };
    } finally {
        if (browser) {
            console.log("[Sync] Closing browser instance.");
            await browser.close();
        }
    }
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };
