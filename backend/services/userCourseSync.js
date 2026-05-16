/**
 * services/userCourseSync.js
 * ══════════════════════════════════════════════════════════════════
 * Keeps the user_courses table in sync with Google Classroom.
 *
 * WHY THIS EXISTS
 *   Attendance visibility must work even when:
 *     - User B hasn't opened the app yet today
 *     - User B's Google token is expired
 *     - The Google API is slow or rate-limiting
 *
 *   The user_courses table is the single source of truth:
 *     SELECT class_id FROM user_courses WHERE user_id = $1
 *   replaces every fragile live-API call in the attendance routes.
 *
 * WHEN IS IT CALLED?
 *   1. On every login (auth callback)
 *   2. On every explicit course list fetch (classroom route)
 *   3. On the SSE connection handshake (attendance events)
 *   4. Background: every 30 min via scheduler (optional)
 *
 * EXPORTED
 *   syncUserCourses(userId, accessToken, refreshToken, role)
 *     → Promise<string[]>   array of synced course IDs
 *
 *   getClassIdsForUser(userId)
 *     → Promise<string[]>   reads DB only — never calls Google
 *
 *   verifyUserInClass(userId, classId)
 *     → Promise<boolean>
 */

const supabase = require("../db/supabase");
const { getCourses, getTaughtCourses } = require("./googleClassroom");

/**
 * Fetches courses from Google Classroom and upserts them into
 * user_courses.  Returns the array of course IDs that now belong
 * to the user.  Safe to call concurrently / repeatedly.
 */
const syncUserCourses = async (userId, accessToken, refreshToken, role) => {
  if (!accessToken) return getClassIdsForUser(userId);

  try {
    const courses = role === "professor"
      ? await getTaughtCourses(accessToken, refreshToken)
      : await getCourses(accessToken, refreshToken);

    if (!courses || courses.length === 0) return getClassIdsForUser(userId);

    const rows = courses.map(c => ({
      user_id:     userId,
      course_id:   c.id,
      course_name: c.name || c.courseName || "",
      role:        role || "student",
      synced_at:   new Date().toISOString(),
    }));

    // Upsert — conflict on (user_id, course_id) just updates synced_at
    const { error } = await supabase
      .from("user_courses")
      .upsert(rows, { onConflict: "user_id,course_id" });

    if (error) {
      console.error("[userCourseSync] upsert error:", error.message);
    }

    return courses.map(c => c.id);
  } catch (err) {
    console.error("[userCourseSync] sync error:", err.message);
    // Fall back to whatever is already in the DB
    return getClassIdsForUser(userId);
  }
};

/**
 * Reads course IDs from DB only — no Google API call.
 * Always fast; used inside attendance query paths.
 */
const getClassIdsForUser = async (userId) => {
  const { data, error } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[userCourseSync] getClassIds error:", error.message);
    return [];
  }
  return (data || []).map(r => r.course_id);
};

/**
 * Returns true if userId is a member of classId according to DB.
 */
const verifyUserInClass = async (userId, classId) => {
  const { data } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", classId)
    .single();
  return !!data;
};

module.exports = { syncUserCourses, getClassIdsForUser, verifyUserInClass };
