import { useState, useEffect } from "react";
import api from "../utils/api";

const getTag = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class") || t.includes("cancelled")) return { label: "URGENT", bg: "#fee2e2", color: "#dc2626", dot: "#dc2626" };
  if (t.includes("deadline") || t.includes("due") || t.includes("reminder")) return { label: "REMINDER", bg: "#ffedd5", color: "#d97706", dot: "#f97316" };
  return { label: "INFO", bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" };
};

const COURSE_COLORS = ["#2563eb","#16a34a","#7c3aed","#b45309","#0d9488","#be123c","#0284c7","#65a30d"];
const getCourseColor = (name = "") => COURSE_COLORS[name.charCodeAt(0) % COURSE_COLORS.length];

export default function Announcements({ role }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | grouped

  const endpoint = role === "professor" ? "/professor/announcements" : "/classroom/announcements";

  useEffect(() => {
    api.get(endpoint)
      .then(r => setAnnouncements(r.data.announcements || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint]);

  // Get unique course names
  const courses = [...new Set(announcements.map(a => a.courseName).filter(Boolean))].sort();

  const filtered = announcements.filter(a => {
    const tag = getTag(a.text);
    const tagOk = tagFilter === "ALL" || tag.label === tagFilter;
    const courseOk = courseFilter === "ALL" || a.courseName === courseFilter;
    const searchOk = !search || a.text?.toLowerCase().includes(search.toLowerCase()) || a.courseName?.toLowerCase().includes(search.toLowerCase());
    return tagOk && courseOk && searchOk;
  });

  // Group by course
  const grouped = filtered.reduce((acc, ann) => {
    const key = ann.courseName || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ann);
    return acc;
  }, {});

  const AnnouncementCard = ({ ann, hideCourse }) => {
    const tag = getTag(ann.text);
    const h = ann.updateTime ? Math.floor((Date.now() - new Date(ann.updateTime)) / 3600000) : 0;
    const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;

    return (
      <div style={{
        background: "var(--card-bg)", borderRadius: 12,
        border: "1px solid var(--card-border)", padding: "16px",
        boxShadow: "var(--shadow-sm)", display: "flex", gap: 12,
      }}>
        <div style={{ width: 3, borderRadius: 2, background: tag.dot, flexShrink: 0, minHeight: 20, alignSelf: "stretch" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {!hideCourse && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: getCourseColor(ann.courseName), flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{ann.courseName}</span>
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", marginBottom: 10 }}>{ann.text}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: tag.bg, color: tag.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>{tag.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ago}</span>
            {ann.link && <a href={ann.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, marginLeft: "auto" }}>View in Classroom →</a>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        {announcements.length} announcement{announcements.length !== 1 ? "s" : ""} from {courses.length} course{courses.length !== 1 ? "s" : ""}
      </p>

      {/* Search bar */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search announcements..."
          style={{
            width: "100%", padding: "10px 14px", border: "1.5px solid var(--input-border)",
            borderRadius: 10, fontSize: 14, outline: "none",
            background: "var(--input-bg)", color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Tag filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["ALL", "URGENT", "REMINDER", "INFO"].map(f => (
            <button key={f} onClick={() => setTagFilter(f)} style={{
              padding: "6px 12px", borderRadius: 99, flexShrink: 0, whiteSpace: "nowrap",
              border: `1.5px solid ${tagFilter === f ? "var(--green-600)" : "var(--border-color)"}`,
              background: tagFilter === f ? "var(--green-800)" : "var(--card-bg)",
              color: tagFilter === f ? "#fff" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>{f}</button>
          ))}
        </div>

        <div style={{ height: 20, width: 1, background: "var(--border-color)" }} />

        {/* Course filter */}
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{
          padding: "6px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)",
          background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", maxWidth: 220,
        }}>
          <option value="ALL">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c.length > 35 ? c.slice(0, 35) + "…" : c}</option>)}
        </select>

        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "var(--bg-tertiary)", borderRadius: 8, padding: 3 }}>
          {[["list", "☰"], ["grouped", "⊞"]].map(([v, icon]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              width: 32, height: 28, borderRadius: 6, fontSize: 14, cursor: "pointer",
              background: viewMode === v ? "var(--card-bg)" : "transparent",
              color: viewMode === v ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* Course pills (quick filter) */}
      {courses.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setCourseFilter("ALL")} style={{
            padding: "5px 12px", borderRadius: 99, flexShrink: 0, fontSize: 12, fontWeight: 500, cursor: "pointer",
            border: `1.5px solid ${courseFilter === "ALL" ? "var(--green-600)" : "var(--border-color)"}`,
            background: courseFilter === "ALL" ? "var(--green-50)" : "var(--card-bg)",
            color: courseFilter === "ALL" ? "var(--green-800)" : "var(--text-secondary)",
          }}>All</button>
          {courses.map(c => (
            <button key={c} onClick={() => setCourseFilter(c)} style={{
              padding: "5px 12px", borderRadius: 99, flexShrink: 0, fontSize: 12, fontWeight: 500,
              cursor: "pointer", whiteSpace: "nowrap",
              border: `1.5px solid ${courseFilter === c ? getCourseColor(c) : "var(--border-color)"}`,
              background: courseFilter === c ? `${getCourseColor(c)}18` : "var(--card-bg)",
              color: courseFilter === c ? getCourseColor(c) : "var(--text-secondary)",
            }}>
              {c.length > 25 ? c.slice(0, 25) + "…" : c}
            </button>
          ))}
        </div>
      )}

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 100, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>No announcements found</p>
          </div>
          : viewMode === "grouped"
            ? Object.entries(grouped).map(([course, anns]) => (
              <div key={course} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: getCourseColor(course) }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{course}</h3>
                  <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{anns.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {anns.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} hideCourse />)}
                </div>
              </div>
            ))
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} />)}
            </div>
      }
    </div>
  );
}
