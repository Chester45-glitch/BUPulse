const puppeteer = require('puppeteer');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

// NEW: Function to link using a manually provided cookie
async function linkBulmsWithCookie(userId, sessionCookie) {
    try {
        // We structure the cookie exactly how Puppeteer needs it
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
            .upsert({ 
                user_id: userId, 
                bulms_cookies: encryptedCookies, 
                status: 'connected' 
            });

        if (error) throw error;

        // Immediately try a test sync to see if the cookie works
        return await autoSyncBulmsData(userId);
    } catch (error) {
        console.error("Manual link error:", error.message);
        return { success: false, message: "Invalid session cookie. Please try again." };
    }
}

// Keep your existing autoSyncBulmsData function here...
async function autoSyncBulmsData(userId) {
    const { data: userCreds, error } = await supabase
        .from('user_credentials')
        .select('bulms_cookies')
        .eq('user_id', userId)
        .single();

    if (error || !userCreds) throw new Error("Credentials not found.");

    const decrypted = decryptData(userCreds.bulms_cookies);
    const rawCookies = JSON.parse(decrypted);

    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.setCookie(...rawCookies);
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { waitUntil: 'networkidle2' });
        
        // Wait for timeline
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(resolve => setTimeout(resolve, 5000)); 

        // Check if the cookie actually worked
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

        // Clean up dates
        const currentYear = new Date().getFullYear();
        activities = activities.map(act => {
            let d = act.dueDate;
            if (d && d.includes(',')) {
                d = d.substring(d.indexOf(',') + 1).trim();
                if (!/\d{4}/.test(d)) d = d.replace(",", ` ${currentYear},`);
            }
            return { ...act, dueDate: d };
        });

        const academicData = { subjects, activities, lastSynced: new Date().toISOString() };
        await supabase.from('academic_data').upsert({ user_id: userId, data: academicData });

        return { success: true, data: academicData };
    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = { linkBulmsWithCookie, autoSyncBulmsData };