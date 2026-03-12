import { useState, useEffect } from "react";
import api from "../utils/api";

const getTag = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class") || t.includes("cancelled")) return { label: "URGENT", bg: "#fee2e2", color: "#dc2626", dot: "#dc2626" };
  if (t.includes("deadline") || t.includes("due") || t.includes("reminder")) return { label: "REMINDER", bg: "#ffedd5", color: "#d97706", dot: "#f97316" };
  return { label: "INFO", bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" };
};

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

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

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ color: "var(--gray-500)", fontSize: 13, marginBottom: 16 }}>{announcements.length} announcement{announcements.length !== 1 ? "s" : ""} from your courses</p>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search announcements..."
        style={{ width: "100%", padding: "9px 14px", border: "1.5px solid var(--gray-200)", borderRadius: "var(--radius-md)", fontSize: 14, outline: "none", marginBottom: 10 }}
      />

      {/* Filters - scrollable on mobile */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {["ALL", "URGENT", "REMINDER", "INFO"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${filter === f ? "var(--green-600)" : "var(--gray-200)"}`, background: filter === f ? "var(--green-800)" : "var(--white)", color: filter === f ? "var(--white)" : "var(--gray-600)", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{f}</button>
        ))}
      </div>

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: "var(--radius-lg)", background: "var(--gray-100)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", color: "var(--gray-400)" }}><div style={{ fontSize: 36, marginBottom: 10 }}>📭</div><p>No announcements found</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((ann, i) => {
              const tag = getTag(ann.text);
              const dateStr = ann.updateTime ? new Date(ann.updateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "";
              return (
                <div key={ann.id || i} style={{ background: "var(--white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "16px", boxShadow: "var(--shadow-sm)", display: "flex", gap: 12, animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.dot, marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>{ann.text}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: tag.bg, color: tag.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>{tag.label}</span>
                      <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4 }}>{ann.courseName}</span>
                      <span style={{ fontSize: 11, color: "var(--gray-400)" }}>{dateStr}</span>
                      {ann.link && <a href={ann.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500 }}>View →</a>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}
