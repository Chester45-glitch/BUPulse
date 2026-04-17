const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { linkBulmsAccount, autoSyncBulmsData } = require('../services/bulmsScraper');
const supabase = require('../db/supabase');

router.post('/link', authenticateToken, async (req, res) => {
    const { userId, sessionCookie } = req.body;
    if (!sessionCookie) return res.status(400).json({ error: "Session Key is required" });
    try {
        const result = await linkBulmsAccount(userId, sessionCookie);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync-now', authenticateToken, async (req, res) => {
    const { userId } = req.body;
    try {
        const result = await autoSyncBulmsData(userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/status', authenticateToken, async (req, res) => {
    const { userId } = req.query;
    try {
        const { data } = await supabase.from('user_credentials').select('status').eq('user_id', userId).single();
        res.json(data || { status: 'disconnected' });
    } catch (error) {
        res.json({ status: 'disconnected' });
    }
});

router.get('/data', authenticateToken, async (req, res) => {
    const { userId } = req.query;
    try {
        const { data } = await supabase.from('academic_data').select('data').eq('user_id', userId).single();
        res.json(data || { data: null });
    } catch (error) {
        res.json({ data: null });
    }
});

module.exports = router;