const express = require("express");
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { checkDeadlinesForUser } = require("../services/scheduler");

const router = express.Router();

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

router.post("/trigger", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name, access_token, refresh_token, notifications_enabled")
      .eq("id", req.user.id)
      .single();
    await checkDeadlinesForUser(user);
    res.json({ message: "Notification check triggered" });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger check" });
  }
});

router.patch("/settings", authenticateToken, async (req, res) => {
  const { notifications_enabled } = req.body;
  const { error } = await supabase
    .from("users")
    .update({ notifications_enabled })
    .eq("id", req.user.id);
  if (error) return res.status(500).json({ error: "Failed to update settings" });
  res.json({ message: "Settings updated", notifications_enabled });
});

module.exports = router;
