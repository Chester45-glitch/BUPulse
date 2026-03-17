import { useState, useEffect } from "react";
import api from "../utils/api";

const BANNERS = [
  { bg: "linear-gradient(135deg, #1a3a5c 0%, #2563eb 100%)", pattern: "#1e40af" },
  { bg: "linear-gradient(135deg, #1a2e1a 0%, #16a34a 100%)", pattern: "#15803d" },
  { bg: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)", pattern: "#6d28d9" },
  { bg: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)", pattern: "#c2410c" },
  { bg: "linear-gradient(135deg, #134e4a 0%, #0d9488 100%)", pattern: "#0f766e" },
  { bg: "linear-gradient(135deg, #831843 0%, #db2777 100%)", pattern: "#be185d" },
  { bg: "linear-gradient(135deg, #1e3a5f 0%, #0284c7 100%)", pattern: "#0369a1" },
  { bg: "linear-gradient(135deg, #365314 0%, #65a30d 100%)", pattern: "#4d7c0f" },
];

const getBanner = (name = "") => BANNERS[name.charCodeAt(0) % BANNERS.length];

const getInitials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function EnrolledClasses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("bupulse_courses");
    if (cached) setCourses(JSON.parse(cached));

    api.get("/classroom/courses")
      .then(r => {
        const c = r.data.courses || [];
        setCourses(c);
        localStorage.setItem("bupulse_courses", JSON.stringify(c));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {courses.length} active course{courses.length !== 1 ? "s" : ""}
      </p>

      {loading && courses.length === 0
        ? <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 220, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />
          ))}
        </div>
        : <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {courses.map((course, i) => {
            const banner = getBanner(course.name);
            return (
              <a key={course.id} href={course.alternateLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "var(--card-bg)", borderRadius: 12,
                  border: "1px solid var(--card-border)", overflow: "hidden",
                  boxShadow: "var(--shadow-sm)", cursor: "pointer", transition: "all 0.2s",
                  animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
                  display: "flex", flexDirection: "column",
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-3px)", e.currentTarget.style.boxShadow = "var(--shadow-lg)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
                >
                  {/* Banner */}
                  <div style={{ height: 96, background: banner.bg, position: "relative", padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {/* Dot pattern */}
                    <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`, backgroundSize: "18px 18px" }} />
                    {/* Course name on banner */}
                    <div style={{ position: "relative" }}>
                      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
                        {course.name?.length > 40 ? course.name.slice(0, 40) + "…" : course.name}
                      </div>
                      {course.section && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>{course.section}</div>}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "14px 16px", flex: 1, position: "relative" }}>
                    {/* Instructor avatar (circle overlapping banner) */}
                    <div style={{
                      position: "absolute", top: -22, right: 16,
                      width: 44, height: 44, borderRadius: "50%",
                      background: "var(--card-bg)", border: "3px solid var(--card-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "var(--shadow-md)",
                    }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: banner.bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                        {getInitials(course.name)}
                      </div>
                    </div>

                    {/* Instructor name */}
                    <div style={{ marginBottom: 12 }}>
                      {course.ownerId && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                          {course.teacherFolder ? "Instructor" : "Course Owner"}
                        </div>
                      )}
                    </div>

                    {/* Bottom row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                      <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.5px" }}>ACTIVE</span>
                      {course.room && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>📍 {course.room}</span>}
                      <span style={{ marginLeft: "auto", color: "var(--green-700)", fontSize: 12, fontWeight: 500 }}>Open →</span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      }

      <style>{`
        @media (max-width: 900px) { .courses-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 500px) { .courses-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
