import { useState, useEffect } from "react";
import api from "../utils/api";

const COLORS = ["#2d5a1b","#1d4ed8","#7c3aed","#b45309","#0f766e","#be123c","#0369a1","#4d7c0f"];
const getBg = (i) => COLORS[i % COLORS.length];

export default function EnrolledClasses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/classroom/courses")
      .then(r => setCourses(r.data.courses || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {courses.length} active course{courses.length !== 1 ? "s" : ""} from Google Classroom
      </p>

      {loading
        ? <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ height: 160, borderRadius: "var(--radius-lg)", background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}
        </div>
        : courses.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>No Classes Found</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Make sure you're enrolled in Google Classroom courses.</p>
          </div>
          : <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {courses.map((course, i) => (
              <a key={course.id} href={course.alternateLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "var(--card-bg)", borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--card-border)", overflow: "hidden",
                  boxShadow: "var(--shadow-sm)", cursor: "pointer", transition: "all 0.2s",
                  animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-3px)", e.currentTarget.style.boxShadow = "var(--shadow-lg)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
                >
                  {/* Color banner */}
                  <div style={{ height: 80, background: getBg(i), position: "relative", display: "flex", alignItems: "flex-end", padding: "12px" }}>
                    <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                    <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📖</div>
                  </div>

                  <div style={{ padding: "14px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{course.name}</h3>
                    {course.section && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{course.section}</p>}
                    {course.room && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Room: {course.room}</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                      <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99 }}>ACTIVE</span>
                      <span style={{ marginLeft: "auto", color: "var(--green-700)", fontSize: 12, fontWeight: 500 }}>Open →</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
      }

      <style>{`
        @media (max-width: 768px) { .courses-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px) { .courses-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
