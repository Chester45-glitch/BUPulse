import { useState, useEffect } from "react";
import api from "../utils/api";

// ── Banner gradients — soft, distinct palette ─────────────────────
// 18 entries so even large class lists stay visually unique.
// Order: light blue, light red, light green, peach, light gray-blue,
//        light violet, sky, rose, sage, apricot, lavender, mint,
//        dusty blue, blush, olive, lilac, powder blue, warm sand.
const BANNERS = [
  { bg: "linear-gradient(135deg,#bfdbfe 0%,#93c5fd 100%)", text: "#1e3a5f" },  // light blue
  { bg: "linear-gradient(135deg,#fecaca 0%,#fca5a5 100%)", text: "#7f1d1d" },  // light red
  { bg: "linear-gradient(135deg,#bbf7d0 0%,#86efac 100%)", text: "#14532d" },  // light green
  { bg: "linear-gradient(135deg,#fed7aa 0%,#fdba74 100%)", text: "#7c2d12" },  // peach
  { bg: "linear-gradient(135deg,#e2e8f0 0%,#cbd5e1 100%)", text: "#334155" },  // light gray-blue
  { bg: "linear-gradient(135deg,#ddd6fe 0%,#c4b5fd 100%)", text: "#4c1d95" },  // light violet
  { bg: "linear-gradient(135deg,#bae6fd 0%,#7dd3fc 100%)", text: "#0c4a6e" },  // sky
  { bg: "linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%)", text: "#831843" },  // rose
  { bg: "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%)", text: "#064e3b" },  // sage/mint
  { bg: "linear-gradient(135deg,#ffedd5 0%,#fed7aa 100%)", text: "#7c2d12" },  // apricot
  { bg: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)", text: "#5b21b6" },  // lavender
  { bg: "linear-gradient(135deg,#ccfbf1 0%,#99f6e4 100%)", text: "#134e4a" },  // teal-mint
  { bg: "linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%)", text: "#1e40af" },  // powder blue
  { bg: "linear-gradient(135deg,#fde8e8 0%,#fecaca 100%)", text: "#991b1b" },  // blush
  { bg: "linear-gradient(135deg,#ecfccb 0%,#d9f99d 100%)", text: "#3f6212" },  // lime-sage
  { bg: "linear-gradient(135deg,#f3e8ff 0%,#e9d5ff 100%)", text: "#6b21a8" },  // lilac
  { bg: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)", text: "#075985" },  // soft sky
  { bg: "linear-gradient(135deg,#fef9c3 0%,#fef08a 100%)", text: "#713f12" },  // warm sand/yellow
];

const getBanner = (name = "", index = 0) => {
  // Use index first for sequential uniqueness, fall back to char code
  return BANNERS[index % BANNERS.length];
};

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
  const banner = getBanner(course.name, index);
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
        {/* Banner */}
        <div style={{ height: 96, background: banner.bg, position: "relative", padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
          <div style={{ position: "relative" }}>
            <div style={{ color: banner.text, fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
              {course.name?.length > 40 ? course.name.slice(0, 40) + "…" : course.name}
            </div>
            {course.section && (
              <div style={{ color: banner.text, opacity: 0.7, fontSize: 11.5, marginTop: 2 }}>
                {course.section}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px", flex: 1, position: "relative" }}>
          {/* Instructor avatar */}
          <div style={{ position: "absolute", top: -22, right: 16, width: 44, height: 44, borderRadius: "50%", background: "var(--card-bg)", border: "3px solid var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: banner.bg, display: "flex", alignItems: "center", justifyContent: "center", color: banner.text, fontSize: 13, fontWeight: 700 }}>
              {getInitials(course.name)}
            </div>
          </div>

          {/* Instructor name — FIX: now shown via teacherName field */}
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

          {/* Footer */}
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
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show cached data immediately
    const cached = localStorage.getItem("bupulse_courses");
    if (cached) {
      try { setCourses(JSON.parse(cached)); } catch {}
    }

    api.get("/classroom/courses")
      .then((r) => {
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
