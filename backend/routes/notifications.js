const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { checkDeadlinesForUser, checkAnnouncementsForUser } = require("../services/scheduler");

// ── GET /api/notifications — fetch log ───────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("notification_logs")
    .select("*")
    .eq("user_id", req.user.id)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: "Failed to fetch notifications" });
  res.json({ notifications: data });
});

// ── POST /api/notifications/trigger — manual test send ───────────
router.post("/trigger", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, access_token, refresh_token, notifications_enabled, notify_instant")
      .eq("id", req.user.id)
      .single();

    if (!user?.notifications_enabled)
      return res.json({ message: "Notifications are disabled for this user." });

    await checkDeadlinesForUser(user);
    await checkAnnouncementsForUser(user);
    res.json({ message: "Notification check triggered — check your email!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger check" });
  }
});

// ── PATCH /api/notifications/settings ────────────────────────────
// Body: { notifications_enabled?: boolean, notify_instant?: boolean }
router.patch("/settings", authenticateToken, async (req, res) => {
  const { notifications_enabled, notify_instant } = req.body;

  const updates = {};

  if (typeof notifications_enabled === "boolean")
    updates.notifications_enabled = notifications_enabled;

  if (typeof notify_instant === "boolean")
    updates.notify_instant = notify_instant;

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "No valid fields provided." });

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", req.user.id);

  if (error) {
    console.error("Save notification pref error:", error);
    return res.status(500).json({ error: "Failed to update notification settings" });
  }

  res.json({ success: true, ...updates });
});

module.exports = router;
