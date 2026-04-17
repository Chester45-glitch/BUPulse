import { useState, useEffect, useRef } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// ── Helpers ──────────────────────────────────────────────────────
const PALETTE = ["#2563eb","#16a34a","#7c3aed","#b45309","#0f766e","#be123c","#0284c7","#65a30d"];
const courseColor = (name = "") => PALETTE[name.charCodeAt(0) % PALETTE.length];

const timeAgo = (iso) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso)) / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

// ── Type config ─────────────────────────────────────────────────
const TYPE_CFG = {
  ANNOUNCEMENT: {
    label: "Announcement",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.1)",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  MATERIAL: {
    label: "Material",
    color: "#0284c7",
    bg: "rgba(2,132,199,0.1)",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  QUIZ: {
    label: "Quiz / Form",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.1)",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
};

// ── Attachment icons ─────────────────────────────────────────────
const AttachmentIcon = ({ type }) => {
  const icons = {
    drive: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12 19.79 19.79 0 0 1 1.14 3.45 2 2 0 0 1 3.09 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    youtube: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
    link: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    form: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  };
  return icons[type] || icons.link;
};

// ── Search icon ──────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ── Stream item card ─────────────────────────────────────────────
function StreamCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CFG[item.type] || TYPE_CFG.ANNOUNCEMENT;
  const color = courseColor(item.courseName || "");
  const PREVIEW = 220;
  const text = item.text || "";
  const needsMore = text.length > PREVIEW;
  const displayText = expanded || !needsMore ? text : text.slice(0, PREVIEW) + "…";

  return (
    <article
      style={{
        background: "var(--card-bg)",
        borderRadius: 14,
        border: "1px solid var(--card-border)",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        animation: `fadeUp 0.3s ease ${index * 0.04}s both`,
        transition: "box-shadow 0.18s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.09)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)")}
    >
      <div style={{ background: color, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {(item.courseName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{item.courseName}</div>
            {item.teacherName && (
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{item.teacherName}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, position: "relative", flexShrink: 0 }}>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{timeAgo(item.updateTime)}</span>
          <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <cfg.Icon /> {cfg.label}
          </span>
        </div>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {item.title && (
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</div>
        )}
        {text && (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-primary)", whiteSpace: "pre-line", marginBottom: needsMore ? 6 : 10 }}>
              {displayText}
            </p>
            {needsMore && (
              <button onClick={() => setExpanded((e) => !e)} style={{ fontSize: 12.5, color, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "0 0 8px" }}>
                {expanded ? "Show less ↑" : "Read more ↓"}
              </button>
            )}
          </>
        )}

        {item.attachments?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {item.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                borderRadius: 6, background: "var(--bg-tertiary)", border: "1px solid var(--card-border)",
                fontSize: 12, color: "var(--text-secondary)", textDecoration: "none",
                transition: "all 0.14s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = color + "15"; e.currentTarget.style.borderColor = color + "40"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--card-border)"; }}
              >
                <AttachmentIcon type={att.type} />
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.title}</span>
              </a>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, marginTop: 6, borderTop: "1px solid var(--border-color)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {new Date(item.updateTime || item.creationTime).toLocaleDateString("en-PH", {
              weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {item.dueDate && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 4 }}>
              Due {new Date(item.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
            </span>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 12, color, fontWeight: 500, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
              Open ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Course pill filter ───────────────────────────────────────────
function CoursePills({ courses, selected, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
      {["ALL", ...courses].map((c) => {
        const active = selected === c;
        const col = c === "ALL" ? "#16a34a" : courseColor(c);
        return (
          <button key={c} onClick={() => onChange(c)} style={{
            flexShrink: 0, padding: "5px 12px", borderRadius: 99,
            fontSize: 12, fontWeight: active ? 600 : 400,
            border: `1.5px solid ${active ? col : "var(--border-color)"}`,
            background: active ? col + "14" : "transparent",
            color: active ? col : "var(--text-muted)",
            cursor: "pointer", transition: "all 0.13s", whiteSpace: "nowrap",
          }}>
            {c === "ALL" ? "All Classes" : c.length > 26 ? c.slice(0, 26) + "…" : c}
          </button>
        );
      })}
    </div>
  );
}

// ── Announcements page ───────────────────────────────────────────
export default function Announcements({ role }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");

  const [editModal, setEditModal]   = useState(null); 
  const [deleteModal, setDeleteModal] = useState(null); 
  const [actionLoading, setActionLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(true);
    try {
      await api.delete(`/professor/announcements/${deleteModal.courseId}/${deleteModal.annId}`);
      setItems(prev => prev.filter(i => i.id !== deleteModal.item.id));
      setDeleteModal(null);
    } catch (e) { alert("Delete failed: " + (e.response?.data?.error || e.message)); }
    finally { setActionLoading(false); }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setActionLoading(true);
    try {
      await api.patch(`/professor/announcements/${editModal.courseId}/${editModal.annId}`, { text: editModal.text });
      setItems(prev => prev.map(i => i.id === editModal.item.id ? { ...i, text: editModal.text } : i));
      setEditModal(null);
    } catch (e) { alert("Edit failed: " + (e.response?.data?.error || e.message)); }
    finally { setActionLoading(false); }
  };

  const isStudent = !role || role === "student";
  const streamEndpoint = isStudent ? "/classroom/stream" : "/professor/announcements";

  const fetchItems = async (force = false) => {
    const url = force ? `${streamEndpoint}?refresh=true` : streamEndpoint;
    if (force) setRefreshing(true); else setLoading(true);

    try {
      // Fetch both simultaneously
      const [gcRes, bulmsRes] = await Promise.allSettled([
        api.get(url),
        user?.id ? api.get(`/bulms/data?userId=${user.id}`) : Promise.resolve({ data: null })
      ]);

      let mergedItems = [];

      // Add Google Classroom Data
      if (gcRes.status === "fulfilled") {
        if (isStudent) {
          mergedItems = [...(gcRes.value.data.items || [])];
        } else {
          mergedItems = (gcRes.value.data.announcements || []).map((a) => ({
            ...a, id: `ann-${a.id}`, type: "ANNOUNCEMENT", title: null, attachments: a.attachments || []
          }));
        }
      }

      // Add BULMS Announcements (If future scraper version supports it)
      if (bulmsRes.status === "fulfilled" && bulmsRes.value.data?.data?.announcements) {
        const bulmsAnns = bulmsRes.value.data.data.announcements.map((ann, i) => ({
          id: `bulms-ann-${i}`,
          type: "ANNOUNCEMENT",
          courseName: "Bicol University LMS",
          text: ann.text || ann.title,
          updateTime: new Date().toISOString(),
          link: 'https://bulms.bicol-u.edu.ph/my/'
        }));
        mergedItems = [...mergedItems, ...bulmsAnns];
      }

      setItems(mergedItems);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { fetchItems(); }, [streamEndpoint, user]);

  const courses = [...new Set(items.map((i) => i.courseName).filter(Boolean))].sort();

  const filtered = items.filter((item) => {
    const typeOk = typeFilter === "ALL" || item.type === typeFilter;
    const courseOk = courseFilter === "ALL" || item.courseName === courseFilter;
    const q = search.toLowerCase();
    const searchOk =
      !q ||
      item.text?.toLowerCase().includes(q) ||
      item.title?.toLowerCase().includes(q) ||
      item.courseName?.toLowerCase().includes(q) ||
      item.teacherName?.toLowerCase().includes(q);
    return typeOk && courseOk && searchOk;
  });

  const counts = items.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ animation: "fadeIn 0.35s ease", maxWidth: 800, margin: "0 auto", width: "100%" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-primary)" }}>{items.length}</strong> post{items.length !== 1 ? "s" : ""} across{" "}
          <strong style={{ color: "var(--text-primary)" }}>{courses.length}</strong> class{courses.length !== 1 ? "es" : ""}
        </p>
        <button
          onClick={() => fetchItems(true)}
          disabled={refreshing}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, border: "1.5px solid var(--card-border)", background: "var(--card-bg)", color: refreshing ? "var(--text-muted)" : "var(--green-700)", cursor: refreshing ? "not-allowed" : "pointer" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {[
          { key: "ALL", label: "All" },
          { key: "ANNOUNCEMENT", label: "Announcements" },
          { key: "MATERIAL", label: "Materials" },
          { key: "QUIZ", label: "Quizzes" },
        ].map(({ key, label }) => {
          const cfg = TYPE_CFG[key];
          const active = typeFilter === key;
          const col = cfg ? cfg.color : "#16a34a";
          const cnt = key === "ALL" ? items.length : (counts[key] || 0);
          return (
            <button key={key} onClick={() => setTypeFilter(key)} style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              padding: "7px 13px", borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
              border: `1.5px solid ${active ? col : "var(--border-color)"}`,
              background: active ? col : "var(--card-bg)",
              color: active ? "#fff" : "var(--text-muted)",
              cursor: "pointer", transition: "all 0.13s",
            }}>
              {cfg && <cfg.Icon />}
              {label}
              <span style={{ fontSize: 11, opacity: 0.75, background: active ? "rgba(255,255,255,0.25)" : "var(--bg-tertiary)", borderRadius: 99, padding: "1px 6px" }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }}><SearchIcon /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            style={{ width: "100%", padding: "8px 12px 8px 30px", border: "1.5px solid var(--input-border)", borderRadius: 9, background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 13.5, outline: "none" }}
            onFocus={(e) => (e.target.style.borderColor = "#16a34a")}
            onBlur={(e) => (e.target.style.borderColor = "var(--input-border)")}
          />
        </div>
      </div>

      {courses.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <CoursePills courses={courses} selected={courseFilter} onChange={setCourseFilter} />
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 14, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No posts match your filters</p>
          <button onClick={() => { setSearch(""); setTypeFilter("ALL"); setCourseFilter("ALL"); }} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 9, background: "#16a34a", color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((item, i) => {
            const rawId = item.id?.startsWith("ann-") ? item.id.slice(4) : item.id;
            const itemCourseId = item.courseId || null;
            return (
              <div key={item.id || i} style={{ position: "relative" }}>
                <StreamCard item={item} index={i} />
                {!isStudent && item.type === "ANNOUNCEMENT" && (
                  <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6, zIndex: 2 }}>
                    <button
                      onClick={() => setEditModal({ item, courseId: itemCourseId, annId: rawId, text: item.text || "" })}
                      style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid var(--card-border)", background: "var(--card-bg)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setDeleteModal({ item, courseId: itemCourseId, annId: rawId })}
                      style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--card-bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-xl)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Edit Announcement</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
              {editModal.item.courseName}
            </p>
            <textarea
              value={editModal.text}
              onChange={e => setEditModal(m => ({ ...m, text: e.target.value }))}
              rows={6}
              style={{ width: "100%", border: "1.5px solid var(--card-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, resize: "vertical", outline: "none", lineHeight: 1.6, background: "var(--input-bg)", color: "var(--text-primary)", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditModal(null)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--card-border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleEdit} disabled={actionLoading || !editModal.text.trim()}
                style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "#16a34a", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--card-bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "var(--shadow-xl)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Delete Announcement?</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete the announcement from Google Classroom. This cannot be undone.
            </p>
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
              "{deleteModal.item.text?.slice(0, 120)}{deleteModal.item.text?.length > 120 ? "…" : ""}"
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteModal(null)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--card-border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={actionLoading}
                style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}