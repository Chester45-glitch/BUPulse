const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const supabase = require('../db/supabase');
const { linkBulmsAccount, autoSyncBulmsData } = require('../services/bulmsScraper');

// NEW: Dedicated status check to survive page refreshes
router.get('/status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { data } = await supabase
        .from('user_credentials')
        .select('status')
        .eq('user_id', userId)
        .single();

    res.status(200).json({ status: data?.status || 'disconnected' });
});

router.post('/link', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const result = await linkBulmsAccount(userId);
    if (result.success) {
        // Automatically sync data right after linking!
        await autoSyncBulmsData(userId);
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
});

router.get('/data', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { data, error } = await supabase
        .from('academic_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    if (error) return res.status(404).json({ error: "Data not found" });
    res.status(200).json({ data: data.data });
});

router.post('/sync-now', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const result = await autoSyncBulmsData(userId);
    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
});

// CRON JOB
cron.schedule('0 */6 * * *', async () => {
    const { data: users } = await supabase.from('user_credentials').select('user_id').eq('status', 'connected');
    if (!users) return;
    for (const user of users) {
        try {
            await autoSyncBulmsData(user.user_id);
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (err) {}
    }
});

module.exports = router;