import { useState, useEffect } from "react";
import api from "../utils/api";

const getTag = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class") || t.includes("cancelled")) return { label: "URGENT", bg: "#fee2e2", color: "#dc2626", dot: "#dc2626" };
  if (t.includes("deadline") || t.includes("due") || t.includes("reminder")) return { label: "REMINDER", bg: "#ffedd5", color: "#d97706", dot: "#f97316" };
  return { label: "INFO", bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" };
};

const COURSE_COLORS = ["#2d5a1b","#1d4ed8","#7c3aed","#b45309","#0f766e","#be123c","#0369a1","#4d7c0f"];
const getCourseColor = (name = "") => COURSE_COLORS[name.charCodeAt(0) % COURSE_COLORS.length];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState(false);

  useEffect(() => {
    api.get("/classroom/announcements")
      .then(r => setAnnouncements(r.data.announcements || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = announcements.filter(a => {
    const tag = getTag(a.text);
    return (filter === "ALL" || tag.label === filter) &&
      (!search || a.text?.toLowerCase().includes(search.toLowerCase()) || a.courseName?.toLowerCase().includes(search.toLowerCase()));
  });

  // Group by course
  const grouped = filtered.reduce((acc, ann) => {
    const key = ann.courseName || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ann);
    return acc;
  }, {});

  const AnnouncementCard = ({ ann, i }) => {
    const tag = getTag(ann.text);
    const dateStr = ann.updateTime ? new Date(ann.updateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const h = ann.updateTime ? Math.floor((Date.now() - new Date(ann.updateTime).getTime()) / 3600000) : 0;
    const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;

    return (
      <div style={{
        background: "var(--card-bg)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--card-border)", padding: "16px",
        boxShadow: "var(--shadow-sm)", display: "flex", gap: 12,
        animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.dot, marginTop: 5, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {!groupBy && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: getCourseColor(ann.courseName) }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{ann.courseName}</span>
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", marginBottom: 10 }}>{ann.text}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: tag.bg, color: tag.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>{tag.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ago} · {dateStr}</span>
            {ann.link && <a href={ann.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, marginLeft: "auto" }}>View in Classroom →</a>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        {announcements.length} announcement{announcements.length !== 1 ? "s" : ""} from all your courses
      </p>

      {/* Search + Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search announcements..." style={{
          flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid var(--input-border)",
          borderRadius: "var(--radius-md)", fontSize: 14, outline: "none",
          background: "var(--input-bg)", color: "var(--text-primary)",
        }} />
        <button onClick={() => setGroupBy(p => !p)} style={{
          padding: "9px 16px", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 500,
          border: `1.5px solid ${groupBy ? "var(--green-600)" : "var(--border-color)"}`,
          background: groupBy ? "var(--green-50)" : "var(--card-bg)",
          color: groupBy ? "var(--green-800)" : "var(--text-secondary)", cursor: "pointer",
        }}>
          {groupBy ? "📂 Grouped" : "📋 All"}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {["ALL", "URGENT", "REMINDER", "INFO"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 99, flexShrink: 0, whiteSpace: "nowrap",
            border: `1.5px solid ${filter === f ? "var(--green-600)" : "var(--border-color)"}`,
            background: filter === f ? "var(--green-800)" : "var(--card-bg)",
            color: filter === f ? "#fff" : "var(--text-secondary)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>{f}</button>
        ))}
      </div>

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 100, borderRadius: "var(--radius-lg)", background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>No announcements found</p>
          </div>
          : groupBy
            ? Object.entries(grouped).map(([course, anns]) => (
              <div key={course} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: getCourseColor(course), flexShrink: 0 }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{course}</h3>
                  <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{anns.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {anns.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} i={i} />)}
                </div>
              </div>
            ))
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} i={i} />)}
            </div>
      }
    </div>
  );
}
