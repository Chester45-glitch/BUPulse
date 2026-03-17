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
    courseId, courseWorkStates: ["PUBLISHED"], pageSize: 20, orderBy: "dueDate asc",
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

const getAllDeadlines = async (accessToken, refreshToken) => {
  const courses = await getCourses(accessToken, refreshToken);

  // Fetch all courses IN PARALLEL instead of one by one
  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const work = await getCourseWork(course.id, accessToken, refreshToken);
        return work
          .filter(w => w.dueDate)
          .map(w => {
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
              description: w.description || "", dueDate, link: w.alternateLink,
            };
          });
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

  // Fetch all courses IN PARALLEL instead of one by one
  const results = await Promise.all(
    courses.map(async (course) => {
      try {
        const anns = await getAnnouncements(course.id, accessToken, refreshToken);
        return anns.map(a => ({
          courseId: course.id, courseName: course.name,
          id: a.id, text: a.text,
          creationTime: a.creationTime, updateTime: a.updateTime,
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

module.exports = { getCourses, getCourseWork, getAnnouncements, getAllDeadlines, getAllAnnouncements };
