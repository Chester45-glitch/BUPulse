const express = require("express");
const router  = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── GET /api/attendance ───────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { course_id, date } = req.query;

  let query = supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", req.user.id)
    .order("record_date", { ascending: false });

  if (course_id) query = query.eq("course_id", course_id);
  if (date)      query = query.eq("record_date", date);

  const { data, error } = await query.limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ records: data || [] });
});

// ── GET /api/attendance/:id ───────────────────────────────────────
router.get("/:id", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: "Record not found" });
  res.json({ record: data });
});

// ── POST /api/attendance ──────────────────────────────────────────
router.post("/", authenticateToken, async (req, res) => {
  const { course_id, course_name, record_date, names, file_url, file_name, source } = req.body;

  if (!course_name || !record_date) {
    return res.status(400).json({ error: "course_name and record_date are required" });
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .insert({
      user_id: req.user.id,
      course_id: course_id || null,
      course_name,
      record_date,
      names: names || [],
      file_url: file_url || null,
      file_name: file_name || null,
      source: source || "manual",
      status: "draft",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ record: data });
});

// ── PATCH /api/attendance/:id ─────────────────────────────────────
router.patch("/:id", authenticateToken, async (req, res) => {
  const { names, status, course_name, record_date } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (names)       updates.names       = names;
  if (status)      updates.status      = status;
  if (course_name) updates.course_name = course_name;
  if (record_date) updates.record_date = record_date;

  const { data, error } = await supabase
    .from("attendance_records")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ record: data });
});

// ── DELETE /api/attendance/:id ────────────────────────────────────
router.delete("/:id", authenticateToken, async (req, res) => {
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── POST /api/attendance/extract ──────────────────────────────────
// Extract names from uploaded file text using Groq AI
router.post("/extract", authenticateToken, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text is required" });

  const prompt = `Extract student names from this attendance sheet text.
Return ONLY a valid JSON array of name strings. No explanation, no markdown.
Each item should be a clean full name string.

TEXT:
${text.slice(0, 4000)}

Return format: ["Name One", "Name Two", ...]`;

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const raw = result.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let names;
    try {
      names = JSON.parse(cleaned);
      if (!Array.isArray(names)) throw new Error("Not array");
    } catch {
      const arr = cleaned.match(/\[[\s\S]*\]/);
      names = arr ? JSON.parse(arr[0]) : [];
    }

    // Convert to { name, status } objects
    const entries = names.map(n => ({
      name:   typeof n === "string" ? n : n.name || String(n),
      status: "present",
    }));

    res.json({ names: entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: `AI extraction failed: ${err.message}` });
  }
});

// ── PATCH /api/attendance/:id/verify ─────────────────────────────
// Professor verifies a student-submitted attendance record
router.patch("/:id/verify", authenticateToken, async (req, res) => {
  const { data: user } = await supabase
    .from("users").select("role").eq("id", req.user.id).single();

  if (user?.role !== "professor")
    return res.status(403).json({ error: "Only professors can verify attendance" });

  const { data, error } = await supabase
    .from("attendance_records")
    .update({ status: "verified", verified_by: req.user.id, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ record: data });
});

module.exports = router;
