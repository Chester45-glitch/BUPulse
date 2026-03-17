const { google } = require("googleapis");

const createClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.classroom({ version: "v1", auth });
};

const getCourses = async (accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.list({ courseStates: ["ACTIVE"], pageSize: 20 });
  return res.data.courses || [];
};

const getTaughtCourses = async (accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.list({ teacherId: "me", courseStates: ["ACTIVE"], pageSize: 20 });
    return res.data.courses || [];
  } catch (e) {
    console.error("getTaughtCourses error:", e.message);
    return [];
  }
};

const getCourseWork = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.courseWork.list({
    courseId, courseWorkStates: ["PUBLISHED"], pageSize: 30, orderBy: "dueDate asc",
  });
  return res.data.courseWork || [];
};

const getAnnouncementsForCourse = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.announcements.list({
    courseId, announcementStates: ["PUBLISHED"], pageSize: 10, orderBy: "updateTime desc",
  });
  return res.data.announcements || [];
};

// ── Fetch primary teacher name for a course ──────────────────
const getCourseTeacherName = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.teachers.list({ courseId, pageSize: 5 });
    const teachers = res.data.teachers || [];
    if (teachers.length === 0) return null;
    // First teacher is typically the owner/primary instructor
    return teachers[0].profile?.name?.fullName || null;
  } catch (e) {
    // If no roster permission, silently skip
    return null;
  }
};

// ── getAllAnnouncements (student) — includes teacher name ────
const getAllAnnouncements = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);
  return getAllAnnouncementsForCourses(courses, accessToken, refreshToken);
};

// ── Shared: fetch announcements for given course list ────────
const getAllAnnouncementsForCourses = async (courses, accessToken, refreshToken) => {
  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        // Fetch announcements and teacher name in parallel
        const [anns, teacherName] = await Promise.all([
          getAnnouncementsForCourse(course.id, accessToken, refreshToken),
          getCourseTeacherName(course.id, accessToken, refreshToken),
        ]);

        return anns.map(a => ({
          courseId: course.id,
          courseName: course.name,
          teacherName: teacherName || course.ownerId || null, // fallback
          id: a.id,
          text: a.text,
          creationTime: a.creationTime,
          updateTime: a.updateTime,
          link: a.alternateLink,
        }));
      } catch (e) {
        console.error(`Announcements error for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results.flat().sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
};

// ── Submission status check ──────────────────────────────────
const getSubmissionStatus = async (courseId, courseWorkId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.courseWork.studentSubmissions.list({
      courseId, courseWorkId, userId: "me",
    });
    const submissions = res.data.studentSubmissions || [];
    if (submissions.length === 0) return "NOT_SUBMITTED";
    const state = submissions[0].state;
    return (state === "TURNED_IN" || state === "RETURNED") ? "SUBMITTED" : "NOT_SUBMITTED";
  } catch (e) {
    return "UNKNOWN";
  }
};

// ── getAllDeadlines — only unsubmitted ───────────────────────
const getAllDeadlines = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const work = await getCourseWork(course.id, accessToken, refreshToken);
        const withDates = work.filter(w => w.dueDate);

        const withStatus = await Promise.all(
          withDates.map(async (w) => {
            const submissionStatus = await getSubmissionStatus(course.id, w.id, accessToken, refreshToken);
            const d = w.dueDate;
            const dueDate = new Date(
              `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}T${
                w.dueTime
                  ? `${String(w.dueTime.hours||0).padStart(2,"0")}:${String(w.dueTime.minutes||0).padStart(2,"0")}:00`
                  : "23:59:00"
              }`
            );
            return {
              courseId: course.id, courseName: course.name,
              courseWorkId: w.id, title: w.title,
              description: w.description || "", dueDate,
              link: w.alternateLink, submissionStatus,
              workType: w.workType || "ASSIGNMENT",
            };
          })
        );

        return withStatus.filter(w => w.submissionStatus !== "SUBMITTED");
      } catch (e) {
        console.error(`Coursework error for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results.flat().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};

const getCourseStudents = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.students.list({ courseId, pageSize: 50 });
    return res.data.students || [];
  } catch (e) {
    return [];
  }
};

const createAnnouncement = async (courseId, text, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.announcements.create({
    courseId,
    requestBody: { text, state: "PUBLISHED" },
  });
  return res.data;
};

module.exports = {
  getCourses,
  getTaughtCourses,
  getCourseWork,
  getAllDeadlines,
  getAllAnnouncements,
  getAllAnnouncementsForCourses,
  getCourseStudents,
  getCourseTeacherName,
  createAnnouncement,
};
