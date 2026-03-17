const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { checkDeadlinesForUser } = require("../services/scheduler");

// GET /api/notifications — fetch notification log
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

// POST /api/notifications/trigger
router.post("/trigger", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, access_token, refresh_token, notifications_enabled")
      .eq("id", req.user.id)
      .single();

    if (!user?.notifications_enabled) {
      return res.json({ message: "Notifications are disabled for this user" });
    }

    await checkDeadlinesForUser(user);
    res.json({ message: "Notification check triggered" });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger check" });
  }
});

// PATCH /api/notifications/settings — save notification preference to DB
router.patch("/settings", authenticateToken, async (req, res) => {
  const { notifications_enabled } = req.body;

  if (typeof notifications_enabled !== "boolean") {
    return res.status(400).json({ error: "notifications_enabled must be a boolean" });
  }

  const { error } = await supabase
    .from("users")
    .update({ notifications_enabled })
    .eq("id", req.user.id);

  if (error) {
    console.error("Save notification pref error:", error);
    return res.status(500).json({ error: "Failed to update notification settings" });
  }

  res.json({ success: true, notifications_enabled });
});

module.exports = router;
