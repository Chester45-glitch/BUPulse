import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// ── Banner gradients (matches GC palette) ────────────────────────
const BANNERS = [
  { bg: "linear-gradient(135deg,#1a3a5c 0%,#2563eb 100%)" },
  { bg: "linear-gradient(135deg,#1a2e1a 0%,#16a34a 100%)" },
  { bg: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)" },
  { bg: "linear-gradient(135deg,#7c2d12 0%,#ea580c 100%)" },
  { bg: "linear-gradient(135deg,#134e4a 0%,#0d9488 100%)" },
  { bg: "linear-gradient(135deg,#831843 0%,#db2777 100%)" },
  { bg: "linear-gradient(135deg,#1e3a5f 0%,#0284c7 100%)" },
  { bg: "linear-gradient(135deg,#365314 0%,#65a30d 100%)" },
];

const getBanner = (name = "") => BANNERS[name.charCodeAt(0) % BANNERS.length];

const getInitials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

// ── Skeleton card ────────────────────────────────────────────────
const SkeletonCard = ({ delay }) => (
  <div style={{
    borderRadius: 12, background: "var(--card-bg)",
    border: "1px solid var(--card-border)", overflow: "hidden",
    animation: `pulse-dot 1.5s ease-in-out ${delay}s infinite`,
  }}>
    <div style={{ height: 96, background: "var(--bg-tertiary)" }} />
    <div style={{ padding: "14px 16px" }}>
      <div style={{ height: 14, background: "var(--bg-tertiary)", borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 10, background: "var(--bg-tertiary)", borderRadius: 6, width: "60%" }} />
    </div>
  </div>
);

// ── Course card ──────────────────────────────────────────────────
function CourseCard({ course, index }) {
  const banner = getBanner(course.name);
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={course.alternateLink}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "var(--card-bg)", borderRadius: 12,
          border: "1px solid var(--card-border)", overflow: "hidden",
          boxShadow: hovered ? "var(--shadow-lg)" : "var(--shadow-sm)",
          transform: hovered ? "translateY(-3px)" : "none",
          transition: "all 0.2s ease",
          display: "flex", flexDirection: "column",
          animation: `fadeIn 0.3s ease ${index * 0.06}s both`,
        }}
      >
        <div style={{ height: 96, background: banner.bg, position: "relative", padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
          <div style={{ position: "relative" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}>
              {course.name?.length > 40 ? course.name.slice(0, 40) + "…" : course.name}
            </div>
            {course.section && (
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11.5, marginTop: 2 }}>
                {course.section}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "14px 16px", flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", top: -22, right: 16, width: 44, height: 44, borderRadius: "50%", background: "var(--card-bg)", border: "3px solid var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: banner.bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {getInitials(course.name)}
            </div>
          </div>

          <div style={{ marginBottom: 10, minHeight: 32, paddingTop: 2 }}>
            {course.teacherName ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>
                  Instructor
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                  {course.teacherName}
                </div>
              </>
            ) : course.ownerId ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {course.teacherFolder ? "Instructor" : "Course Owner"}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
            <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.5px" }}>
              ACTIVE
            </span>
            {course.room && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>📍 {course.room}</span>
            )}
            <span style={{ marginLeft: "auto", color: "var(--green-700)", fontSize: 12, fontWeight: 600 }}>
              Open →
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function EnrolledClasses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("bupulse_courses");
    if (cached) {
      try { setCourses(JSON.parse(cached)); } catch {}
    }

    const fetchAllData = async () => {
      try {
        // Fetch both Google Classroom and BULMS data simultaneously
        const [gcRes, bulmsRes] = await Promise.allSettled([
          api.get("/classroom/courses"),
          user?.id ? api.get(`/bulms/data?userId=${user.id}`) : Promise.resolve({ data: null })
        ]);

        let mergedCourses = [];

        if (gcRes.status === "fulfilled" && gcRes.value.data.courses) {
          mergedCourses = [...gcRes.value.data.courses];
        }

        if (bulmsRes.status === "fulfilled" && bulmsRes.value.data?.data?.subjects) {
          const bulmsCourses = bulmsRes.value.data.data.subjects.map((sub, i) => ({
            id: `bulms-course-${i}`,
            name: sub,
            alternateLink: 'https://bulms.bicol-u.edu.ph/my/',
            teacherName: 'Bicol University LMS',
            room: 'BULMS'
          }));
          mergedCourses = [...mergedCourses, ...bulmsCourses];
        }

        setCourses(mergedCourses);
        localStorage.setItem("bupulse_courses", JSON.stringify(mergedCourses));
      } catch (error) {
        console.error("Error fetching courses", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {courses.length} active course{courses.length !== 1 ? "s" : ""}
      </p>

      <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {loading && courses.length === 0
          ? [...Array(6)].map((_, i) => <SkeletonCard key={i} delay={i * 0.1} />)
          : courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))
        }
      </div>

      {!loading && courses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📚</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No active courses found.</p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 900px) { .courses-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 500px) { .courses-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}