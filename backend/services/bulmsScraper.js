const puppeteer = require('puppeteer');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

/**
 * Links account using a manually provided session cookie.
 * This is the ONLY reliable way for Google-login users in production.
 */
async function linkBulmsAccount(userId, sessionCookie) {
    try {
        // Prepare the cookie structure for Puppeteer
        const cookies = [{
            name: 'MoodleSession',
            value: sessionCookie,
            domain: 'bulms.bicol-u.edu.ph',
            path: '/',
            httpOnly: true,
            secure: true
        }];

        const encryptedCookies = encryptData(JSON.stringify(cookies));

        // Store the key
        const { error } = await supabase
            .from('user_credentials')
            .upsert({ 
                user_id: userId, 
                bulms_cookies: encryptedCookies, 
                status: 'connected' 
            });

        if (error) throw error;

        // Verify immediately by running a sync
        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("Link error:", error.message);
        return { success: false, message: "Invalid session key. Please ensure you are logged in." };
    }
}

async function autoSyncBulmsData(userId) {
    const { data: userCreds, error } = await supabase
        .from('user_credentials')
        .select('bulms_cookies')
        .eq('user_id', userId)
        .single();

    if (error || !userCreds) throw new Error("Credentials not found.");

    const decrypted = decryptData(userCreds.bulms_cookies);
    const rawCookies = JSON.parse(decrypted);

    // PRODUCTION LAUNCH CONFIG
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--single-process',
            '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.setCookie(...rawCookies);
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { waitUntil: 'networkidle2' });
        
        // Wait for timeline lazy loading
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(resolve => setTimeout(resolve, 6000)); 

        // Check if still logged in
        const isLoggedOut = await page.$('.login');
        if (isLoggedOut) throw new Error("Session expired. Please re-link your account.");

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

        // Date cleaning
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

        return { success: true, data: academicData };
    } catch (error) {
        console.error("Sync error:", error.message);
        return { success: false, message: error.message };
    } finally {
        await browser.close();
    }
}

async function markAccountDisconnected(userId) {
    await supabase.from('user_credentials').update({ status: 'disconnected' }).eq('user_id', userId);
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };