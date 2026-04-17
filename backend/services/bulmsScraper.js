const puppeteer = require('puppeteer');
const { encryptData, decryptData } = require('../middleware/encryption');
const supabase = require('../db/supabase');

async function linkBulmsAccount(userId) {
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();

    try {
        await page.goto('https://bulms.bicol-u.edu.ph/login/index.php', { waitUntil: 'networkidle2' });
        console.log("Waiting for manual user login...");
        
        await page.waitForSelector('#page-my-index, .dashboard-card, .coursebox, #page-site-index', { timeout: 0 }); 

        console.log("Login successful! Extracting session cookies...");
        const cookies = await page.cookies();
        const encryptedCookies = encryptData(JSON.stringify(cookies));

        const { error } = await supabase
            .from('user_credentials')
            .upsert({ user_id: userId, bulms_cookies: encryptedCookies, status: 'connected' });

        if (error) throw error;
        console.log("Cookies securely stored.");
        return { success: true, message: "Account linked successfully." };

    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        await browser.close();
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
    if (!decrypted) throw new Error("Failed to decrypt cookies.");
    const rawCookies = JSON.parse(decrypted);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.setCookie(...rawCookies);

        // ==========================================
        // STEP 1: LOAD DASHBOARD & TRIGGER AJAX
        // ==========================================
        console.log("Navigating to Dashboard...");
        await page.goto('https://bulms.bicol-u.edu.ph/my/', { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => window.scrollBy(0, 1000));
        console.log("Waiting 6 seconds for Moodle's Timeline to load...");
        await new Promise(resolve => setTimeout(resolve, 6000)); 

        const currentUrl = page.url();
        if (currentUrl.includes('login/index.php')) {
            await markAccountDisconnected(userId);
            return { success: false, message: "Session expired" };
        }

        // ==========================================
        // STEP 2: SMART EXTRACTION
        // ==========================================
        let { subjects, activities } = await page.evaluate(() => {
            // --- A. Grab Subjects (Strictly from actual course cards) ---
            const subjectLinks = Array.from(document.querySelectorAll('.dashboard-card .coursename, .coursebox .coursename'))
                .map(el => el.innerText.replace(/\n/g, ' ').trim())
                .filter(text => text.length > 5);
            
            const uniqueSubjects = [...new Set(subjectLinks)];

            // --- B. Grab Activities & Parse Headers ---
            const rawActivities = [];
            // Moodle groups lists under date headers. We grab all the list-groups.
            const listGroups = document.querySelectorAll('.list-group');
            
            listGroups.forEach(group => {
                // The date header (e.g., "Sunday, 19 April") is usually the element right above the list
                const headerEl = group.previousElementSibling;
                let dateStr = headerEl ? headerEl.innerText.trim() : "";
                
                const items = group.querySelectorAll('[data-region="event-list-item"]');
                items.forEach(el => {
                    const titleEl = el.querySelector('.event-name, h6, [data-region="event-name"]');
                    const courseEl = el.querySelector('.text-muted, small, a[href*="course/view.php"]');
                    const timeEl = el.querySelector('.text-end, .text-right, [data-region="event-date"]');
                    
                    if (titleEl) {
                        let titleText = titleEl.innerText.trim();
                        let courseText = courseEl ? courseEl.innerText.trim() : "";
                        let timeText = timeEl ? timeEl.innerText.trim() : "";
                        
                        if (courseText.toLowerCase().includes("course") || courseText === titleText) courseText = "";

                        rawActivities.push({
                            title: courseText ? `${courseText} - ${titleText}` : titleText,
                            // Combine the Header Date + The Item Time!
                            dueDate: `${dateStr} ${timeText}`.trim()
                        });
                    }
                });
            });

            return { subjects: uniqueSubjects, activities: rawActivities };
        });

        // ==========================================
        // STEP 3: THE DATE FIXER
        // ==========================================
        const today = new Date();
        const currentYear = today.getFullYear();
        
        activities = activities.map(act => {
            let d = act.dueDate;
            
            if (d && d.includes(',')) {
                d = d.substring(d.indexOf(',') + 1).trim(); // Remove "Sunday"
                if (!/\d{4}/.test(d)) { 
                    d = d.replace(",", ` ${currentYear},`); // Add the year
                }
            }
            return { ...act, dueDate: d };
        });

        // ==========================================
        // STEP 4: SAVE
        // ==========================================
        const academicData = { subjects, activities, lastSynced: new Date().toISOString() };
        await supabase.from('academic_data').upsert({ user_id: userId, data: academicData });

        console.log(`✅ SYNC COMPLETE: Found ${subjects.length} subjects and ${activities.length} activities.`);
        return { success: true, data: academicData };

    } catch (error) {
        console.error(`Auto-sync failed:`, error);
        return { success: false, message: error.message };
    } finally {
        await browser.close();
    }
}

async function markAccountDisconnected(userId) {
    await supabase.from('user_credentials').update({ status: 'disconnected' }).eq('user_id', userId);
}

module.exports = { linkBulmsAccount, autoSyncBulmsData };