const { google } = require("googleapis");

// ── OAuth client factory ────────────────────────────────────────
const createClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.classroom({ version: "v1", auth });
};

// ── Courses ─────────────────────────────────────────────────────
const getCourses = async (accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.list({ courseStates: ["ACTIVE"], pageSize: 20 });
  return res.data.courses || [];
};

const getTaughtCourses = async (accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.list({
      teacherId: "me",
      courseStates: ["ACTIVE"],
      pageSize: 20,
    });
    return res.data.courses || [];
  } catch (e) {
    console.error("getTaughtCourses error:", e.message);
    return [];
  }
};

// ── Teacher name ────────────────────────────────────────────────
const getCourseTeacherName = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.teachers.list({ courseId, pageSize: 5 });
    const teachers = res.data.teachers || [];
    return teachers[0]?.profile?.name?.fullName || null;
  } catch {
    return null;
  }
};

// ── Course work (assignments) ───────────────────────────────────
const getCourseWork = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.courseWork.list({
    courseId,
    courseWorkStates: ["PUBLISHED"],
    pageSize: 30,
    orderBy: "dueDate asc",
  });
  return res.data.courseWork || [];
};

// ── Announcements for a single course ──────────────────────────
const getAnnouncementsForCourse = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.announcements.list({
    courseId,
    announcementStates: ["PUBLISHED"],
    pageSize: 10,
    orderBy: "updateTime desc",
  });
  return res.data.announcements || [];
};

// ── Materials (files, links, videos) ───────────────────────────
const getCourseMaterials = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.courseWorkMaterials.list({
      courseId,
      courseWorkMaterialStates: ["PUBLISHED"],
      pageSize: 10,
      orderBy: "updateTime desc",
    });
    return res.data.courseWorkMaterial || [];
  } catch (e) {
    // courseWorkMaterials may not be available on all courses/scopes
    console.error(`Materials error for ${courseId}:`, e.message);
    return [];
  }
};

// ── Normalize attached materials from GC API ───────────────────
const normalizeMaterials = (materials = []) =>
  materials.map((m) => {
    if (m.driveFile)
      return { type: "drive", title: m.driveFile.driveFile?.title || "File", url: m.driveFile.driveFile?.alternateLink || "#" };
    if (m.youtubeVideo)
      return { type: "youtube", title: m.youtubeVideo.title || "Video", url: m.youtubeVideo.alternateLink || "#" };
    if (m.link)
      return { type: "link", title: m.link.title || m.link.url || "Link", url: m.link.url || "#" };
    if (m.form)
      return { type: "form", title: m.form.title || "Form", url: m.form.formUrl || "#" };
    return null;
  }).filter(Boolean);

// ── Unified stream (announcements + materials + quizzes) ────────
// Returns a normalized array sorted by most-recent-first.
const getUnifiedStream = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const [announcements, materials, coursework, teacherName] = await Promise.all([
          getAnnouncementsForCourse(course.id, accessToken, refreshToken),
          getCourseMaterials(course.id, accessToken, refreshToken),
          getCourseWork(course.id, accessToken, refreshToken),
          getCourseTeacherName(course.id, accessToken, refreshToken),
        ]);

        const base = { courseId: course.id, courseName: course.name, teacherName };

        // ── Announcements ──
        const announcementItems = announcements.map((a) => ({
          ...base,
          id: `ann-${a.id}`,
          type: "ANNOUNCEMENT",
          title: null,
          text: a.text || "",
          creationTime: a.creationTime,
          updateTime: a.updateTime || a.creationTime,
          link: a.alternateLink,
          attachments: normalizeMaterials(a.materials || []),
        }));

        // ── Materials ──
        const materialItems = materials.map((m) => ({
          ...base,
          id: `mat-${m.id}`,
          type: "MATERIAL",
          title: m.title || "Untitled Material",
          text: m.description || "",
          creationTime: m.creationTime,
          updateTime: m.updateTime || m.creationTime,
          link: m.alternateLink,
          attachments: normalizeMaterials(m.materials || []),
        }));

        // ── Quizzes / Forms (coursework that has a form attachment or is MCQ/SA) ──
        const quizItems = coursework
          .filter((w) => {
            const hasForm = (w.materials || []).some((m) => m.form);
            const isQuestion =
              w.workType === "SHORT_ANSWER_QUESTION" ||
              w.workType === "MULTIPLE_CHOICE_QUESTION";
            return hasForm || isQuestion;
          })
          .map((w) => ({
            ...base,
            id: `quiz-${w.id}`,
            type: "QUIZ",
            title: w.title || "Untitled Quiz",
            text: w.description || "",
            creationTime: w.creationTime,
            updateTime: w.updateTime || w.creationTime,
            link: w.alternateLink,
            dueDate: w.dueDate
              ? new Date(
                  `${w.dueDate.year}-${String(w.dueDate.month).padStart(2, "0")}-${String(w.dueDate.day).padStart(2, "0")}`
                ).toISOString()
              : null,
            attachments: normalizeMaterials(w.materials || []),
          }));

        return [...announcementItems, ...materialItems, ...quizItems];
      } catch (e) {
        console.error(`Stream error for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results
    .flat()
    .sort(
      (a, b) =>
        new Date(b.updateTime || b.creationTime) -
        new Date(a.updateTime || a.creationTime)
    );
};

// ── Student announcements (legacy – used by dashboard) ─────────
const getAllAnnouncements = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);
  return getAllAnnouncementsForCourses(courses, accessToken, refreshToken);
};

const getAllAnnouncementsForCourses = async (courses, accessToken, refreshToken) => {
  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const [anns, teacherName] = await Promise.all([
          getAnnouncementsForCourse(course.id, accessToken, refreshToken),
          getCourseTeacherName(course.id, accessToken, refreshToken),
        ]);
        return anns.map((a) => ({
          courseId: course.id,
          courseName: course.name,
          teacherName: teacherName || null,
          id: a.id,
          text: a.text,
          creationTime: a.creationTime,
          updateTime: a.updateTime,
          link: a.alternateLink,
          attachments: normalizeMaterials(a.materials || []),
        }));
      } catch (e) {
        console.error(`Announcements error for ${course.id}:`, e.message);
        return [];
      }
    })
  );
  return results.flat().sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
};

// ── Submission status ───────────────────────────────────────────
const getSubmissionStatus = async (courseId, courseWorkId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      userId: "me",
    });
    const submissions = res.data.studentSubmissions || [];
    if (!submissions.length) return "NOT_SUBMITTED";
    const state = submissions[0].state;
    return state === "TURNED_IN" || state === "RETURNED" ? "SUBMITTED" : "NOT_SUBMITTED";
  } catch {
    return "UNKNOWN";
  }
};

// ── All deadlines (unsubmitted only) ───────────────────────────
const getAllDeadlines = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const work = await getCourseWork(course.id, accessToken, refreshToken);
        const withDates = work.filter((w) => w.dueDate);

        const withStatus = await Promise.all(
          withDates.map(async (w) => {
            const submissionStatus = await getSubmissionStatus(
              course.id,
              w.id,
              accessToken,
              refreshToken
            );
            const d = w.dueDate;
            const dueDate = new Date(
              `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}T${
                w.dueTime
                  ? `${String(w.dueTime.hours || 0).padStart(2, "0")}:${String(w.dueTime.minutes || 0).padStart(2, "0")}:00`
                  : "23:59:00"
              }`
            );
            return {
              courseId: course.id,
              courseName: course.name,
              courseWorkId: w.id,
              title: w.title,
              description: w.description || "",
              dueDate,
              link: w.alternateLink,
              submissionStatus,
              workType: w.workType || "ASSIGNMENT",
            };
          })
        );

        return withStatus.filter((w) => w.submissionStatus !== "SUBMITTED");
      } catch (e) {
        console.error(`Coursework error for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results
    .flat()
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};

// ── Students in a course ────────────────────────────────────────
const getCourseStudents = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.students.list({ courseId, pageSize: 50 });
    return res.data.students || [];
  } catch (e) {
    console.error(`Students error for ${courseId}:`, e.message);
    return [];
  }
};

// ── Create announcement in a course ────────────────────────────
// ── Create announcement with optional Drive file attachments ──────
// driveFiles: [{ driveFileId, fileName }]
const createAnnouncement = async (courseId, text, accessToken, refreshToken, driveFiles = []) => {
  const classroom = createClient(accessToken, refreshToken);

  const materials = driveFiles
    .filter((f) => f.driveFileId)
    .map((f) => ({
      driveFile: {
        driveFile: { id: f.driveFileId, title: f.fileName || "Attachment" },
        shareMode: "VIEW",
      },
    }));

  const res = await classroom.courses.announcements.create({
    courseId,
    requestBody: {
      text,
      state: "PUBLISHED",
      materials: materials.length > 0 ? materials : undefined,
    },
  });
  return res.data;
};

// ── Parse due date/time into Classroom API format ─────────────────
// dateStr: "YYYY-MM-DD", timeStr: "HH:MM" (optional, defaults 23:59)
// ── Resolve relative date strings to YYYY-MM-DD ──────────────────
const resolveDate = (dateStr) => {
  if (!dateStr) return null;
  const s = dateStr.toLowerCase().trim();

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const now = new Date();

  if (s === "today")    return fmt(now);
  if (s === "tomorrow") {
    const d = new Date(now); d.setDate(d.getDate() + 1); return fmt(d);
  }
  if (s === "next week") {
    const d = new Date(now); d.setDate(d.getDate() + 7); return fmt(d);
  }
  if (s === "next monday") {
    const d = new Date(now);
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    return fmt(d);
  }
  if (s === "next friday") {
    const d = new Date(now);
    d.setDate(d.getDate() + ((5 + 7 - d.getDay()) % 7 || 7));
    return fmt(d);
  }

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try native Date parse as fallback (e.g. "March 30", "March 30 2025")
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return fmt(parsed);

  return null; // unresolvable — caller will skip dueDate
};

// ── Parse due date/time into Classroom API format ─────────────────
const parseDue = (dateStr, timeStr = "23:59") => {
  const resolved = resolveDate(dateStr);
  if (!resolved) return {}; // no due date — don't set it

  const [year, month, day] = resolved.split("-").map(Number);
  const [hours, minutes]   = (timeStr || "23:59").split(":").map(Number);

  // Validate all parts are real numbers
  if (!year || !month || !day) return {};

  return {
    dueDate: { year, month, day },
    dueTime: { hours: hours || 23, minutes: minutes || 59 },
  };
};

// ── Create Assignment ─────────────────────────────────────────────
// options: { title, description, dueDate, dueTime, points, driveFiles }
const createAssignment = async (courseId, options, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const { title, description, dueDate, dueTime, points = 100, driveFiles = [] } = options;

  const materials = driveFiles
    .filter((f) => f.driveFileId)
    .map((f) => ({
      driveFile: {
        driveFile: { id: f.driveFileId, title: f.fileName || "Attachment" },
        shareMode: "STUDENT_COPY",
      },
    }));

  const res = await classroom.courses.courseWork.create({
    courseId,
    requestBody: {
      title,
      description: description || "",
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      maxPoints: points,
      materials: materials.length > 0 ? materials : undefined,
      ...parseDue(dueDate, dueTime),
    },
  });
  return res.data;
};

// ── Create Submission Bin ─────────────────────────────────────────
// Like an assignment but specifically for file submission — no description needed
const createSubmissionBin = async (courseId, options, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const { title, description, dueDate, dueTime, points = 100 } = options;

  const res = await classroom.courses.courseWork.create({
    courseId,
    requestBody: {
      title,
      description: description || "Submit your work here.",
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      maxPoints: points,
      submissionModificationMode: "MODIFIABLE_UNTIL_TURNED_IN",
      ...parseDue(dueDate, dueTime),
    },
  });
  return res.data;
};

// ── Create Quiz Assignment (attaches a Google Form) ───────────────
// formUrl: the responder URL of an already-created Google Form
// formId:  Drive file ID of the form
const createQuizAssignment = async (courseId, options, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const { title, description, dueDate, dueTime, points = 100, formId, formUrl } = options;

  // Attach the form as a Drive file — this is the most reliable method.
  // Forms ARE Drive files (formId === Drive file ID), and driveFile attachment
  // always works whereas the `form` material type can silently fail.
  const materials = formId
    ? [{
        driveFile: {
          driveFile: { id: formId, title },
          shareMode: "VIEW",
        },
      }]
    : undefined;

  try {
    const res = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title,
        description: description
          ? `${description}\n\nQuiz link: ${formUrl}`
          : `Quiz link: ${formUrl}`,
        workType: "ASSIGNMENT",
        state: "PUBLISHED",
        maxPoints: points,
        materials,
        ...parseDue(dueDate, dueTime),
      },
    });
    return res.data;
  } catch (err) {
    // Surface the actual API error message so callers can report it
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Classroom API error (courseId ${courseId}): ${msg}`);
  }
};

module.exports = {
  getCourses,
  getTaughtCourses,
  getCourseWork,
  getAllDeadlines,
  getAllAnnouncements,
  getAllAnnouncementsForCourses,
  getUnifiedStream,
  getCourseMaterials,
  getCourseStudents,
  getCourseTeacherName,
  createAnnouncement,
  createAssignment,
  createSubmissionBin,
  createQuizAssignment,
  normalizeMaterials,
};

