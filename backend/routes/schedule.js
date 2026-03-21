const express = require("express");
const router  = require("express").Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const Groq = require("groq-sdk");
const { extractFileContent } = require("../services/fileExtractor");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── GET /api/schedule ─────────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("user_id", req.user.id)
    .order("day_of_week")
    .order("start_time");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ schedules: data || [] });
});

// ── POST /api/schedule ────────────────────────────────────────────
// Create a single schedule entry manually
router.post("/", authenticateToken, async (req, res) => {
  const { course_name, course_code, day_of_week, start_time, end_time, room, color } = req.body;
  if (!course_name || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ error: "course_name, day_of_week, start_time, end_time are required" });
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: req.user.id,
      course_name, course_code, day_of_week, start_time, end_time,
      room, color: color || "#16a34a", source: "manual",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ schedule: data });
});

// ── PUT /api/schedule/:id ─────────────────────────────────────────
router.put("/:id", authenticateToken, async (req, res) => {
  const { course_name, course_code, day_of_week, start_time, end_time, room, color } = req.body;

  const { data, error } = await supabase
    .from("schedules")
    .update({ course_name, course_code, day_of_week, start_time, end_time, room, color, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ schedule: data });
});

// ── DELETE /api/schedule/:id ──────────────────────────────────────
router.delete("/:id", authenticateToken, async (req, res) => {
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── POST /api/schedule/extract ────────────────────────────────────
// Extract schedule from uploaded file using Groq AI
// Body: { fileData (base64), fileType, fileName } OR { text, fileName } (legacy)
router.post("/extract", authenticateToken, async (req, res) => {
  const { text, fileName, fileData, fileType } = req.body;

  let extractedText = text?.trim() || "";

  // If fileData provided, run it through the file extractor first (handles PDF, PPTX, DOCX, images)
  if (fileData && fileType) {
    try {
      const extracted = await extractFileContent(fileData, fileType, fileName);
      extractedText = extracted.text;
    } catch (err) {
      return res.status(400).json({ error: `Could not read file: ${err.message}` });
    }
  }

  if (!extractedText) return res.status(400).json({ error: "No readable content found in file." });

  const prompt = `Extract the class schedule from this text. Return ONLY a valid JSON array.

Each item must have:
- course_name (string): full course name
- course_code (string or null): course code if present (e.g. "CS101")
- day_of_week (string): one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- start_time (string): 24-hour format e.g. "08:00"
- end_time (string): 24-hour format e.g. "10:00"
- room (string or null): room/location if present

If a class meets multiple days, create one entry per day.
Return ONLY the JSON array, no explanation, no markdown.

TEXT:
${extractedText.slice(0, 6000)}`;

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const raw = result.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let entries;
    try {
      entries = JSON.parse(cleaned);
      if (!Array.isArray(entries)) throw new Error("Not an array");
    } catch {
      const arr = cleaned.match(/\[[\s\S]*\]/);
      entries = arr ? JSON.parse(arr[0]) : [];
    }

    res.json({ entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: `AI extraction failed: ${err.message}` });
  }
});

// ── POST /api/schedule/bulk ───────────────────────────────────────
// Save multiple schedule entries at once (after AI extraction)
router.post("/bulk", authenticateToken, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0)
    return res.status(400).json({ error: "entries array is required" });

  const rows = entries.map(e => ({
    user_id:     req.user.id,
    course_name: e.course_name,
    course_code: e.course_code || null,
    day_of_week: e.day_of_week,
    start_time:  e.start_time,
    end_time:    e.end_time,
    room:        e.room || null,
    color:       e.color || "#16a34a",
    source:      e.source || "upload",
  }));

  const { data, error } = await supabase
    .from("schedules")
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ schedules: data, count: data.length });
});

// ── DELETE /api/schedule/all ──────────────────────────────────────
router.delete("/all/clear", authenticateToken, async (req, res) => {
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
