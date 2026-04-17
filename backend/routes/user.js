const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const supabase = require("../db/supabase");

// GET notification preferences
router.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("notify_email, notify_system")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    res.json({
      email: data.notify_email ?? false,
      system: data.notify_system ?? true,
    });
  } catch (err) {
    console.error("Get notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

// PATCH notification preferences
router.patch("/notifications", authenticateToken, async (req, res) => {
  try {
    const { email, system } = req.body;

    const { error } = await supabase
      .from("users")
      .update({
        notify_email: email,
        notify_system: system,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.user.id);

    if (error) throw error;

    res.json({ success: true, email, system });
  } catch (err) {
    console.error("Update notifications error:", err.message);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// NEW: DELETE BULMS Connection
router.delete("/account/bulms", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await supabase.from("user_credentials").delete().eq("user_id", userId);
    await supabase.from("academic_data").delete().eq("user_id", userId);
    res.json({ success: true, message: "BULMS disconnected successfully" });
  } catch (err) {
    console.error("Disconnect error:", err.message);
    res.status(500).json({ error: "Failed to disconnect BULMS" });
  }
});

// NEW: DELETE BULMS Connection
router.delete("/account/bulms", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await supabase.from("user_credentials").delete().eq("user_id", userId);
    await supabase.from("academic_data").delete().eq("user_id", userId);
    res.json({ success: true, message: "BULMS disconnected successfully" });
  } catch (err) {
    console.error("Disconnect error:", err.message);
    res.status(500).json({ error: "Failed to disconnect BULMS" });
  }
});

// DELETE account
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete in order (foreign keys)
    await supabase.from("chatbot_conversations").delete().eq("user_id", userId);
    await supabase.from("notification_logs").delete().eq("user_id", userId);
    await supabase.from("parent_links").delete().or(`parent_id.eq.${userId},student_id.eq.${userId}`);
    await supabase.from("users").delete().eq("id", userId);

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;

// GET /api/user/me — used by mobile app
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, picture, role, notifications_enabled")
      .eq("id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});