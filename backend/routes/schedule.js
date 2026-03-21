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
  const { course_name, course_code, day_of_week, start_time, end_time, room, color, professor } = req.body;
  if (!course_name || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ error: "course_name, day_of_week, start_time, end_time are required" });
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: req.user.id,
      course_name, course_code, day_of_week, start_time, end_time,
      room, professor: professor || null, color: color || "#16a34a", source: "manual",
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
// Extract schedule from uploaded file using AI
// Body: { fileData (base64), fileType, fileName } OR { text, fileName } (legacy)
router.post("/extract", authenticateToken, async (req, res) => {
  const { text, fileName, fileData, fileType } = req.body;

  // ── If it's an image, send directly to Gemini for structured parsing ──
  // This preserves the table layout which is critical for correct day detection.
  // Text extraction (Gemini OCR → Groq parse) loses the column structure.
  if (fileData && fileType?.startsWith("image/")) {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "");

      const imagePrompt = `You are reading a class schedule image. Extract every class entry as a JSON array.

CRITICAL: Look at the COLUMN HEADERS carefully. The schedule has separate columns for each day (Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday). Each class block appears under its correct day column — do NOT assign them all to Monday.

Each item in the array must have:
- course_name (string): full course name
- course_code (string or null): course code e.g. "CS101"  
- day_of_week (string): EXACTLY the day column this class appears under — one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- start_time (string): 24-hour format e.g. "08:00"
- end_time (string): 24-hour format e.g. "10:00"
- room (string or null): room/location
- professor (string or null): professor/instructor name

Return ONLY a valid JSON array. No markdown, no explanation, no extra text.`;

      const GEMINI_MODELS = [
        "gemini-2.5-flash-preview-04-17",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash-001",
      ];

      let entries = null;
      let lastError;

      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
          const result = await model.generateContent([
            { inlineData: { mimeType: fileType, data: fileData } },
            imagePrompt,
          ]);
          const raw = result.response.text()?.trim() || "";
          const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          entries = JSON.parse(cleaned);
          if (!Array.isArray(entries)) throw new Error("Not array");
          console.log(`Schedule image parsed by Gemini model: ${modelName}, found ${entries.length} entries`);
          break;
        } catch (err) {
          if (err.message?.includes("404") || err.message?.includes("not found")) {
            lastError = err; continue;
          }
          // JSON parse error — try to extract array
          if (err instanceof SyntaxError) {
            try {
              const model = genAI.getGenerativeModel({ model: GEMINI_MODELS[0] }, { apiVersion: "v1beta" });
              const result = await model.generateContent([
                { inlineData: { mimeType: fileType, data: fileData } },
                imagePrompt,
              ]);
              const raw = result.response.text()?.trim() || "";
              const arr = raw.match(/\[[\s\S]*\]/);
              if (arr) { entries = JSON.parse(arr[0]); break; }
            } catch {}
          }
          lastError = err;
        }
      }

      if (!entries) throw new Error(`Gemini could not parse schedule: ${lastError?.message}`);
      return res.json({ entries, count: entries.length });
    } catch (err) {
      return res.status(400).json({ error: `Could not read schedule image: ${err.message}` });
    }
  }

  // ── Non-image files (PDF, DOCX, etc): extract text first then parse ──
  let extractedText = text?.trim() || "";
  if (fileData && fileType && !fileType.startsWith("image/")) {
    try {
      const extracted = await extractFileContent(fileData, fileType, fileName);
      extractedText = extracted.text;
    } catch (err) {
      return res.status(400).json({ error: `Could not read file: ${err.message}` });
    }
  }

  if (!extractedText) return res.status(400).json({ error: "No readable content found in file." });

  const prompt = `You are extracting a class schedule from text. Read it VERY carefully.

CRITICAL RULES:
- Each class may appear on DIFFERENT days (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
- Do NOT assume all classes are on the same day
- The day column in a table or the label before a class block tells you which day it is
- If a class meets on multiple days (e.g. MWF or TTh), create a SEPARATE entry for EACH day
- Look for day abbreviations: M=Monday, T=Tuesday, W=Wednesday, Th=Thursday, F=Friday, S=Saturday, Su=Sunday
- Also look for: MTh, MWF, TTh, MWThF patterns — split each into individual days
- Read ALL rows/blocks carefully, not just the first one

Return ONLY a valid JSON array where each item has:
- course_name (string): full course name
- course_code (string or null): course code if present
- day_of_week (string): EXACTLY one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- start_time (string): 24-hour format e.g. "08:00"
- end_time (string): 24-hour format e.g. "10:00"
- room (string or null): room/location if present
- professor (string or null): professor/instructor name if present

Return ONLY the JSON array, no explanation, no markdown, no extra text.

SCHEDULE TEXT:
${extractedText.slice(0, 8000)}`;

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
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
    professor:   e.professor || null,
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
