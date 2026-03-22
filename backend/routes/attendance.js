const express = require("express");
const router  = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "");

const GEMINI_MODELS = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-001",
];

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
// Extract names from uploaded file — uses Gemini for images, Groq for text
router.post("/extract", authenticateToken, async (req, res) => {
  const { text, fileData, fileType } = req.body;

  // ── Image path: send directly to Gemini vision ────────────────
  if (fileData && fileType?.startsWith("image/")) {
    const imagePrompt = `This is an attendance sheet image. Extract ALL student names listed.
Return ONLY a valid JSON array of full name strings.
No explanation, no markdown, no extra text.
Format: ["Full Name One", "Full Name Two", ...]`;

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
        let names;
        try {
          names = JSON.parse(cleaned);
          if (!Array.isArray(names)) throw new Error("Not array");
        } catch {
          const arr = cleaned.match(/\[[\s\S]*\]/);
          names = arr ? JSON.parse(arr[0]) : [];
        }
        const entries = names.map(n => ({
          name: typeof n === "string" ? n : n.name || String(n),
          status: "present",
        }));
        console.log(`Attendance: Gemini ${modelName} extracted ${entries.length} names`);
        return res.json({ names: entries, count: entries.length });
      } catch (err) {
        if (err.message?.includes("404") || err.message?.includes("not found")) {
          lastError = err; continue;
        }
        lastError = err; break;
      }
    }
    return res.status(500).json({ error: `Image extraction failed: ${lastError?.message}` });
  }

  // ── Text path: use Groq ────────────────────────────────────────
  const extractText = text?.trim();
  if (!extractText) return res.status(400).json({ error: "text or fileData (image) is required" });

  const prompt = `Extract student names from this attendance sheet text.
Return ONLY a valid JSON array of name strings. No explanation, no markdown.
Each item should be a clean full name string.

TEXT:
${extractText.slice(0, 4000)}

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
    const entries = names.map(n => ({
      name: typeof n === "string" ? n : n.name || String(n),
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

// ── GET /api/attendance/professor/all ────────────────────────────
// Professor sees all attendance records across all students
router.get("/professor/all", authenticateToken, async (req, res) => {
  const { data: user } = await supabase
    .from("users").select("role").eq("id", req.user.id).single();
  if (user?.role !== "professor")
    return res.status(403).json({ error: "Professor access required" });

  const { course_id, date } = req.query;
  let query = supabase
    .from("attendance_records")
    .select("*, user:user_id(id, name, email, picture)")
    .order("record_date", { ascending: false });

  if (course_id) query = query.eq("course_id", course_id);
  if (date)      query = query.eq("record_date", date);

  const { data, error } = await query.limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ records: data || [] });
});

// ── PATCH /api/attendance/professor/:id ──────────────────────────
// Professor edits any attendance record (names, status)
router.patch("/professor/:id", authenticateToken, async (req, res) => {
  const { data: user } = await supabase
    .from("users").select("role").eq("id", req.user.id).single();
  if (user?.role !== "professor")
    return res.status(403).json({ error: "Professor access required" });

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
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ record: data });
});

// ── GET /api/attendance/parent/:studentId ────────────────────────
// Parent views linked student's attendance records
router.get("/parent/:studentId", authenticateToken, async (req, res) => {
  const { data: user } = await supabase
    .from("users").select("role").eq("id", req.user.id).single();
  if (user?.role !== "parent")
    return res.status(403).json({ error: "Parent access required" });

  // Verify link
  const { data: link } = await supabase
    .from("parent_links")
    .select("id")
    .eq("parent_id", req.user.id)
    .eq("student_id", req.params.studentId)
    .single();
  if (!link) return res.status(403).json({ error: "Not linked to this student" });

  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", req.params.studentId)
    .order("record_date", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ records: data || [] });
});

module.exports = router;
