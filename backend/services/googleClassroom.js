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

const getCourseWork = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.courseWork.list({
    courseId, courseWorkStates: ["PUBLISHED"], pageSize: 30, orderBy: "dueDate asc",
  });
  return res.data.courseWork || [];
};

const getAnnouncements = async (courseId, accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.announcements.list({
    courseId, announcementStates: ["PUBLISHED"], pageSize: 10, orderBy: "updateTime desc",
  });
  return res.data.announcements || [];
};

// Check if a specific assignment is submitted
const getSubmissionStatus = async (courseId, courseWorkId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      userId: "me",
    });
    const submissions = res.data.studentSubmissions || [];
    if (submissions.length === 0) return "NOT_SUBMITTED";
    const state = submissions[0].state;
    // TURNED_IN or RETURNED means submitted/graded
    if (state === "TURNED_IN" || state === "RETURNED") return "SUBMITTED";
    return "NOT_SUBMITTED";
  } catch (e) {
    console.error(`Error checking submission for ${courseWorkId}:`, e.message);
    return "UNKNOWN";
  }
};

const getAllDeadlines = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  // Fetch all coursework in parallel
  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const work = await getCourseWork(course.id, accessToken, refreshToken);
        const workWithDates = work.filter(w => w.dueDate);

        // Check submission status for all work in this course in parallel
        const workWithStatus = await Promise.all(
          workWithDates.map(async (w) => {
            const submissionStatus = await getSubmissionStatus(
              course.id, w.id, accessToken, refreshToken
            );
            const d = w.dueDate;
            const dueDate = new Date(
              `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}T${
                w.dueTime
                  ? `${String(w.dueTime.hours||0).padStart(2,"0")}:${String(w.dueTime.minutes||0).padStart(2,"0")}:00`
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
              submissionStatus, // "SUBMITTED", "NOT_SUBMITTED", "UNKNOWN"
              workType: w.workType || "ASSIGNMENT",
            };
          })
        );

        // Only return NOT submitted items
        return workWithStatus.filter(w => w.submissionStatus !== "SUBMITTED");
      } catch (e) {
        console.error(`Error fetching coursework for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results.flat().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};

const getAllAnnouncements = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const anns = await getAnnouncements(course.id, accessToken, refreshToken);
        return anns.map(a => ({
          courseId: course.id,
          courseName: course.name,
          id: a.id,
          text: a.text,
          creationTime: a.creationTime,
          updateTime: a.updateTime,
          link: a.alternateLink,
        }));
      } catch (e) {
        console.error(`Error fetching announcements for ${course.id}:`, e.message);
        return [];
      }
    })
  );

  return results.flat().sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
};

// For professor: get all students in a course
const getCourseStudents = async (courseId, accessToken, refreshToken) => {
  try {
    const classroom = createClient(accessToken, refreshToken);
    const res = await classroom.courses.students.list({ courseId, pageSize: 50 });
    return res.data.students || [];
  } catch (e) {
    console.error(`Error fetching students for ${courseId}:`, e.message);
    return [];
  }
};

// For professor: get courses they teach
const getTaughtCourses = async (accessToken, refreshToken) => {
  const classroom = createClient(accessToken, refreshToken);
  const res = await classroom.courses.list({ teacherId: "me", courseStates: ["ACTIVE"], pageSize: 20 });
  return res.data.courses || [];
};

// For professor: create announcement
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
  getCourseWork,
  getAnnouncements,
  getAllDeadlines,
  getAllAnnouncements,
  getCourseStudents,
  getTaughtCourses,
  createAnnouncement,
};
