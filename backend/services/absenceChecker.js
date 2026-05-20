/**
 * services/absenceChecker.js
 * ══════════════════════════════════════════════════════════════════
 * Checks every VERIFIED attendance record for students who appear
 * absent (or not listed at all) 3 consecutive times in the same class.
 *
 * LOGIC:
 *   For each class that has verified attendance records:
 *     1. Get all enrolled students (from user_courses)
 *     2. Get the last N verified records, sorted newest first
 *     3. For each student, check if they are absent/unlisted in the
 *        last 3 consecutive verified records
 *     4. If yes — send email to:
 *          • the student
 *          • the professor (verifier of the records)
 *          • linked parents (from parent_links)
 *        Only if an alert hasn't been sent for this student+class today.
 *
 * Called from: scheduler.js (every 6 hours)
 * Also triggered after: PATCH /attendance/class/:id/verify
 */

const supabase   = require("../db/supabase");
const { sendSystemEmail } = require("./gmail");

const CONSECUTIVE_THRESHOLD = 3;

// ── Normalize a name for fuzzy comparison ────────────────────────
// "DELA CRUZ, Juan" → "juan dela cruz"
const normalizeName = (name = "") =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Check if studentName appears in a names array with fuzzy match
const studentInRecord = (studentName, names = []) => {
  const normalStudent = normalizeName(studentName);
  return names.some(entry => {
    const normalEntry = normalizeName(entry.name || "");
    return (
      normalEntry === normalStudent ||
      normalEntry.includes(normalStudent) ||
      normalStudent.includes(normalEntry)
    );
  });
};

// Check if student is "absent" in record — either explicitly marked absent
// or not listed at all (i.e., not found in the names array)
const isAbsentInRecord = (studentName, record) => {
  const names = record.names || [];

  // Not listed at all → treat as absent
  if (!studentInRecord(studentName, names)) return true;

  // Listed but status is absent or late
  const normalStudent = normalizeName(studentName);
  const entry = names.find(n => {
    const ne = normalizeName(n.name || "");
    return ne === normalStudent || ne.includes(normalStudent) || normalStudent.includes(ne);
  });
  return entry?.status === "absent";
};

// ── Email templates ──────────────────────────────────────────────
const buildStudentEmail = (studentName, className, count) => ({
  subject: `⚠️ Attendance Alert: ${count} Consecutive Absences in ${className}`,
  html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#dc2626;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
    <h2 style="margin:0">⚠️ Attendance Alert</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${studentName}</strong>,</p>
    <p>This is an automated notice from <strong>BUPulse</strong>.</p>
    <p>Our system has detected that you have been <strong>absent for ${count} consecutive verified sessions</strong> in:</p>
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:14px 18px;margin:16px 0">
      <strong style="color:#dc2626;font-size:16px">${className}</strong>
    </div>
    <p>Please reach out to your professor and ensure your attendance is updated if there is an error.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">This email was sent automatically by BUPulse — Bicol University Academic Platform.</p>
  </div>
</div>`,
});

const buildProfessorEmail = (studentName, studentEmail, className, count) => ({
  subject: `📋 Attendance Alert: ${studentName} — ${count} Consecutive Absences`,
  html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1e40af;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
    <h2 style="margin:0">📋 Student Absence Alert</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Dear Professor,</p>
    <p>This is an automated notice from <strong>BUPulse</strong>.</p>
    <p>The following student has been absent for <strong>${count} consecutive verified sessions</strong>:</p>
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:16px 0">
      <div><strong>Student:</strong> ${studentName} (${studentEmail})</div>
      <div><strong>Class:</strong> ${className}</div>
      <div><strong>Consecutive Absences:</strong> ${count}</div>
    </div>
    <p>Please follow up with this student at your earliest convenience.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">This email was sent automatically by BUPulse — Bicol University Academic Platform.</p>
  </div>
</div>`,
});

const buildParentEmail = (parentName, studentName, className, count) => ({
  subject: `👨‍👩‍👧 Attendance Alert: ${studentName} — ${count} Consecutive Absences`,
  html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#7c3aed;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
    <h2 style="margin:0">👨‍👩‍👧 Parent Attendance Notice</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Dear ${parentName || "Parent/Guardian"},</p>
    <p>This is an automated notice from <strong>BUPulse</strong> regarding your child's attendance.</p>
    <p><strong>${studentName}</strong> has been absent for <strong>${count} consecutive verified sessions</strong> in:</p>
    <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:8px;padding:14px 18px;margin:16px 0">
      <strong style="color:#7c3aed;font-size:16px">${className}</strong>
    </div>
    <p>We recommend speaking with your child and their professor to address this situation.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">This email was sent automatically by BUPulse — Bicol University Academic Platform.</p>
  </div>
</div>`,
});

// ── Main check function ──────────────────────────────────────────
/**
 * Run the absence check for a specific class after a record is verified,
 * OR for all classes when called from the scheduler.
 *
 * @param {string|null} specificClassId  If provided, only check this class.
 */
const checkAbsences = async (specificClassId = null) => {
  try {
    // Get all classes that have at least THRESHOLD verified records
    let classQuery = supabase
      .from("class_attendance")
      .select("class_id, class_name")
      .eq("is_verified", true);

    if (specificClassId) classQuery = classQuery.eq("class_id", specificClassId);

    const { data: classRows } = await classQuery;
    if (!classRows?.length) return;

    // Unique classes
    const classMap = {};
    classRows.forEach(r => { classMap[r.class_id] = r.class_name; });

    for (const [classId, className] of Object.entries(classMap)) {
      await checkClassAbsences(classId, className);
    }
  } catch (err) {
    console.error("[AbsenceChecker] Error:", err.message);
  }
};

const checkClassAbsences = async (classId, className) => {
  // Get last N verified records for this class, newest first
  const { data: records } = await supabase
    .from("class_attendance")
    .select("id, names, verified_by, verified_at, poster:posted_by(id, name, email)")
    .eq("class_id", classId)
    .eq("is_verified", true)
    .order("record_date", { ascending: false })
    .limit(CONSECUTIVE_THRESHOLD + 2); // fetch a few extra for accuracy

  if (!records || records.length < CONSECUTIVE_THRESHOLD) return;

  // Get all students enrolled in this class
  const { data: enrolled } = await supabase
    .from("user_courses")
    .select("user_id, users:user_id(id, name, email)")
    .eq("course_id", classId);

  if (!enrolled?.length) return;

  // Get the professor who verified (use the most recent verifier)
  const verifierId = records[0]?.verified_by;
  let professorRow = null;
  if (verifierId) {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, access_token, refresh_token")
      .eq("id", verifierId)
      .single();
    professorRow = data;
  }

  for (const enrollment of enrolled) {
    const student = enrollment.users;
    if (!student?.name) continue;

    // Skip the professor — only students can be considered absent
    if (professorRow && student.id === professorRow.id) continue;

    // Check last CONSECUTIVE_THRESHOLD records
    const lastRecords = records.slice(0, CONSECUTIVE_THRESHOLD);
    const allAbsent   = lastRecords.every(r => isAbsentInRecord(student.name, r));

    if (!allAbsent) continue;

    // Check if we've already sent an alert for this student+class today
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("absence_alerts")
      .select("id")
      .eq("student_id", student.id)
      .eq("class_id", classId)
      .eq("alert_date", today)
      .single();

    if (existing) continue; // Already alerted today

    // ── Send emails ──────────────────────────────────────────────
    console.log(`[AbsenceChecker] Sending alert: ${student.name} — ${className} (${CONSECUTIVE_THRESHOLD} absences)`);

    try {
      // 1. Email to student
      const stuMail = buildStudentEmail(student.name, className, CONSECUTIVE_THRESHOLD);
      await sendSystemEmail(student.email, stuMail.subject, stuMail.html);

      // 2. Email to professor
      if (professorRow && professorRow.email !== student.email) {
        const profMail = buildProfessorEmail(student.name, student.email, className, CONSECUTIVE_THRESHOLD);
        await sendSystemEmail(professorRow.email, profMail.subject, profMail.html);
      }

      // 3. Emails to linked parents
      const { data: parentLinks } = await supabase
        .from("parent_links")
        .select("parent:parent_id(id, name, email)")
        .eq("student_id", student.id);

      for (const link of (parentLinks || [])) {
        const parent = link.parent;
        if (!parent?.email) continue;
        const parentMail = buildParentEmail(parent.name, student.name, className, CONSECUTIVE_THRESHOLD);
        await sendSystemEmail(parent.email, parentMail.subject, parentMail.html).catch(() => {});
      }

      // Log the alert so we don't re-send today
      await supabase.from("absence_alerts").insert({
        student_id:  student.id,
        class_id:    classId,
        class_name:  className,
        alert_date:  new Date().toISOString().split("T")[0],
        consecutive: CONSECUTIVE_THRESHOLD,
      });
    } catch (err) {
      console.error(`[AbsenceChecker] Email error for ${student.email}:`, err.message);
    }
  }
};

module.exports = { checkAbsences };
