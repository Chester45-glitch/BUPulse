/**
 * routes/attendance.js  (DEFINITIVE FIX)
 * ══════════════════════════════════════════════════════════════════
 * Shared class attendance — visibility, permissions, realtime.
 *
 * VISIBILITY (fixed)
 *   Uses user_courses table — populated at login and on every course
 *   fetch — so Student B always sees class attendance even if their
 *   Google token is expired or they haven't opened the app today.
 *
 *   Query: SELECT course_id FROM user_courses WHERE user_id = $userId
 *   Then:  SELECT * FROM class_attendance WHERE class_id IN (...)
 *
 * PERMISSION MATRIX (enforced server-side, no exceptions)
 *   ┌─────────────────────┬─────────────┬─────────────┬──────────┐
 *   │ Action              │ Student(U)  │ Student(V)  │Professor │
 *   ├─────────────────────┼─────────────┼─────────────┼──────────┤
 *   │ Create              │     ✅      │     ❌      │    ✅    │
 *   │ Edit own record     │     ✅      │     ❌      │    ✅    │
 *   │ Delete own record   │     ✅      │     ❌      │    ✅    │
 *   │ Verify              │     ❌      │     ❌      │    ✅    │
 *   │ Delete any/verified │     ❌      │     ❌      │    ✅    │
 *   └─────────────────────┴─────────────┴─────────────┴──────────┘
 *   U = unverified, V = verified
 *
 * REALTIME
 *   SSE endpoint GET /api/attendance/events?token=JWT
 *   On INSERT/UPDATE/DELETE → broadcasts to all SSE clients whose
 *   user_courses includes the affected class_id.
 */

const express  = require("express");
const router   = express.Router();
const supabase = require("../db/supabase");
const { authenticateToken } = require("../middleware/auth");
const { syncUserCourses, getClassIdsForUser, verifyUserInClass } = require("../services/userCourseSync");
const { checkAbsences } = require("../services/absenceChecker");
const { sendEmail }     = require("../services/gmail");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "");
const GEMINI_MODELS = [
  "gemini-2.5-flash-preview-04-17","gemini-2.5-flash","gemini-2.0-flash",
  "gemini-2.0-flash-lite","gemini-1.5-flash-001",
];

// ── Full Supabase select with related user rows ───────────────────
const FULL_SELECT = `
  *,
  poster:posted_by(id, name, email, picture, role),
  verifier:verified_by(id, name, email, picture)
`;

// ══════════════════════════════════════════════════════════════════
// SSE registry — Map<userId, { res, classIds }>
// ══════════════════════════════════════════════════════════════════
const sseClients = new Map();

function broadcastToClass(classId, payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [, client] of sseClients) {
    if (!client.res.writableEnded && client.classIds.includes(classId)) {
      client.res.write(msg);
    }
  }
}

// ── Helper: get user role from DB ────────────────────────────────
const getUserRole = async (userId) => {
  const { data } = await supabase
    .from("users")
    .select("role, access_token, refresh_token")
    .eq("id", userId)
    .single();
  return data;
};

// ══════════════════════════════════════════════════════════════════
// GET /api/attendance/events  — SSE realtime stream
// Token passed as ?token= because EventSource can't send headers.
// ══════════════════════════════════════════════════════════════════
router.get("/events", authenticateToken, async (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Heartbeat keeps the connection alive through proxies / Render
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": heartbeat\n\n");
  }, 20000);

  // Read class IDs from DB (never calls Google API here)
  const classIds = await getClassIdsForUser(req.user.id);
  sseClients.set(req.user.id, { res, classIds });

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(req.user.id);
  });
});

// ══════════════════════════════════════════════════════════════════
// GET /api/attendance/my-classes
// Returns all attendance records for the current user's classes.
// Reads class membership from user_courses — no Google API call.
// ══════════════════════════════════════════════════════════════════
router.get("/my-classes", authenticateToken, async (req, res) => {
  try {
    // Primary: read from user_courses table
    let classIds = await getClassIdsForUser(req.user.id);

    // If the user has no cached courses yet (first time, never logged in
    // since the migration), try to populate by syncing now.
    if (classIds.length === 0) {
      const userRow = await getUserRole(req.user.id);
      if (userRow?.access_token) {
        classIds = await syncUserCourses(
          req.user.id,
          userRow.access_token,
          userRow.refresh_token,
          userRow.role
        );
      }
    }

    if (classIds.length === 0) return res.json({ records: [] });

    const { data, error } = await supabase
      .from("class_attendance")
      .select(FULL_SELECT)
      .in("class_id", classIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    console.error("[attendance] my-classes error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/attendance/class/:classId
// All records for one class — access-gated via user_courses.
// ══════════════════════════════════════════════════════════════════
router.get("/class/:classId", authenticateToken, async (req, res) => {
  try {
    const inClass = await verifyUserInClass(req.user.id, req.params.classId);
    if (!inClass) return res.status(403).json({ error: "Not enrolled in this class" });

    const { data, error } = await supabase
      .from("class_attendance")
      .select(FULL_SELECT)
      .eq("class_id", req.params.classId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/attendance/class  — create a record
// ══════════════════════════════════════════════════════════════════
router.post("/class", authenticateToken, async (req, res) => {
  try {
    const { classId, className, recordDate, names, sessionLabel, notes } = req.body;

    if (!classId || !className || !recordDate) {
      return res.status(400).json({ error: "classId, className, and recordDate are required" });
    }

    // Verify membership via DB
    const inClass = await verifyUserInClass(req.user.id, classId);
    if (!inClass) return res.status(403).json({ error: "Not a member of this class" });

    const { data: record, error } = await supabase
      .from("class_attendance")
      .insert({
        class_id:      classId,
        class_name:    className,
        posted_by:     req.user.id,
        record_date:   recordDate,
        session_label: sessionLabel || null,
        names:         names   || [],
        notes:         notes   || null,
        is_verified:   false,
      })
      .select(FULL_SELECT)
      .single();

    if (error) throw error;

    // Notify all connected class members in real time (SSE)
    broadcastToClass(classId, { event: "INSERT", record });

    // Email notification to all class members (fire-and-forget)
    notifyClassMembersOfNewAttendance(classId, className, record).catch(e =>
      console.error("[attendance] notify error:", e.message)
    );

    res.json({ record });
  } catch (err) {
    console.error("[attendance] create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/attendance/class/:id/verify  — professor only
// Must be BEFORE /class/:id to avoid Express treating "verify" as id
// ══════════════════════════════════════════════════════════════════
router.patch("/class/:id/verify", authenticateToken, async (req, res) => {
  try {
    const userRow = await getUserRole(req.user.id);
    if (userRow?.role !== "professor") {
      return res.status(403).json({ error: "Only professors can verify attendance." });
    }

    const { data: record, error } = await supabase
      .from("class_attendance")
      .update({
        is_verified: true,
        verified_by: req.user.id,
        verified_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select(FULL_SELECT)
      .single();

    if (error) throw error;

    broadcastToClass(record.class_id, { event: "UPDATE", record });
    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/attendance/class/:id  — edit a record
// ══════════════════════════════════════════════════════════════════
router.patch("/class/:id", authenticateToken, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from("class_attendance")
      .select("id, class_id, posted_by, is_verified")
      .eq("id", req.params.id)
      .single();
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const userRow    = await getUserRole(req.user.id);
    const isProfessor = userRow?.role === "professor";
    const isOwnRecord = existing.posted_by === req.user.id;
    const isVerified  = existing.is_verified === true;

    // ── Server-side permission check ────────────────────────────
    if (!isProfessor) {
      if (isVerified) {
        return res.status(403).json({
          error: "Verified attendance cannot be modified by students.",
        });
      }
      if (!isOwnRecord) {
        return res.status(403).json({
          error: "Students can only edit their own attendance records.",
        });
      }
    }

    const { names, session_label, notes, record_date } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (names         !== undefined) updates.names         = names;
    if (session_label !== undefined) updates.session_label = session_label;
    if (notes         !== undefined) updates.notes         = notes;
    if (record_date   !== undefined) updates.record_date   = record_date;

    const { data: record, error } = await supabase
      .from("class_attendance")
      .update(updates)
      .eq("id", req.params.id)
      .select(FULL_SELECT)
      .single();

    if (error) throw error;

    broadcastToClass(existing.class_id, { event: "UPDATE", record });
    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DELETE /api/attendance/class/:id
//
// Permission rules (all enforced server-side):
//   Professor   → always allowed
//   Student     → only if: own record AND not verified
//   Student     → BLOCKED if: verified OR not own record
// ══════════════════════════════════════════════════════════════════
router.delete("/class/:id", authenticateToken, async (req, res) => {
  try {
    // Fetch the record first — we need ownership + verification status
    const { data: existing, error: fetchErr } = await supabase
      .from("class_attendance")
      .select("id, class_id, posted_by, is_verified")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const userRow    = await getUserRole(req.user.id);
    const isProfessor = userRow?.role === "professor";
    const isOwnRecord = existing.posted_by === req.user.id;
    const isVerified  = existing.is_verified === true;

    // ── Server-side permission check ────────────────────────────
    if (isProfessor) {
      // Professors can delete anything — no further checks
    } else if (isVerified) {
      return res.status(403).json({
        error: "This attendance has been verified by the professor and cannot be deleted.",
      });
    } else if (!isOwnRecord) {
      return res.status(403).json({
        error: "You can only delete your own attendance records.",
      });
    }
    // else: student deleting their own unverified record — allowed

    const { error: delErr } = await supabase
      .from("class_attendance")
      .delete()
      .eq("id", req.params.id);

    if (delErr) throw delErr;

    // Notify connected clients
    broadcastToClass(existing.class_id, {
      event:    "DELETE",
      recordId: existing.id,
      classId:  existing.class_id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[attendance] delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/attendance/extract  — AI name extraction (unchanged)
// ══════════════════════════════════════════════════════════════════
router.post("/extract", authenticateToken, async (req, res) => {
  const { text, fileData, fileType } = req.body;

  if (fileData && fileType?.startsWith("image/")) {
    const prompt = [
      "This is an attendance sheet image. Extract ALL student names listed.",
      "Return ONLY a valid JSON array of full name strings. No explanation, no markdown.",
      'Format: ["Full Name One", "Full Name Two", ...]',
    ].join("\n");

    let lastError;
    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
        const result = await model.generateContent([
          { inlineData: { mimeType: fileType, data: fileData } }, prompt,
        ]);
        const raw = result.response.text()?.trim() || "";
        const cleaned = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
        let names;
        try { names = JSON.parse(cleaned); if (!Array.isArray(names)) throw new Error(); }
        catch { const a = cleaned.match(/\[[\s\S]*\]/); names = a ? JSON.parse(a[0]) : []; }
        const entries = names.map(n => ({ name: typeof n==="string"?n:n.name||String(n), status:"present" }));
        return res.json({ names: entries, count: entries.length });
      } catch (err) {
        if (err.message?.includes("404")||err.message?.includes("not found")) { lastError=err; continue; }
        lastError=err; break;
      }
    }
    return res.status(500).json({ error: `Image extraction failed: ${lastError?.message}` });
  }

  const extractText = text?.trim();
  if (!extractText) return res.status(400).json({ error: "text or fileData (image) is required" });

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content:
        `Extract student names from this attendance sheet text.\nReturn ONLY a valid JSON array of name strings. No explanation, no markdown.\nTEXT:\n${extractText.slice(0,4000)}\nReturn format: ["Name One", "Name Two", ...]`
      }],
      max_tokens: 1000, temperature: 0.1,
    });
    const raw = result.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    let names;
    try { names = JSON.parse(cleaned); if (!Array.isArray(names)) throw new Error(); }
    catch { const a = cleaned.match(/\[[\s\S]*\]/); names = a ? JSON.parse(a[0]) : []; }
    const entries = names.map(n => ({ name: typeof n==="string"?n:n.name||String(n), status:"present" }));
    res.json({ names: entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: `AI extraction failed: ${err.message}` });
  }
});


// ══════════════════════════════════════════════════════════════════
// POST /api/attendance/sync-courses
// Manually triggers a Google Classroom → user_courses sync.
// Called by the frontend when the user explicitly refreshes,
// ensuring their course list is always up to date.
// ══════════════════════════════════════════════════════════════════
router.post("/sync-courses", authenticateToken, async (req, res) => {
  try {
    const userRow = await getUserRole(req.user.id);
    if (!userRow?.access_token) {
      return res.status(400).json({ error: "No Google access token found. Please log in again." });
    }
    const courseIds = await syncUserCourses(
      req.user.id,
      userRow.access_token,
      userRow.refresh_token,
      userRow.role
    );
    res.json({ synced: true, courseCount: courseIds.length, courseIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Legacy personal records ───────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { course_id, date } = req.query;
  let q = supabase.from("attendance_records").select("*")
    .eq("user_id", req.user.id).order("record_date", { ascending: false });
  if (course_id) q = q.eq("course_id", course_id);
  if (date)      q = q.eq("record_date", date);
  const { data, error } = await q.limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ records: data || [] });
});

module.exports = router;
