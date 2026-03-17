import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const daysLeft = (dueDate) => {
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0) return { label: "OVERDUE", color: "#dc2626", bg: "#fee2e2" };
  if (d === 0) return { label: "TODAY", color: "#dc2626", bg: "#fee2e2" };
  if (d === 1) return { label: "TOMORROW", color: "#d97706", bg: "#ffedd5" };
  return { label: `${d}d left`, color: "#16a34a", bg: "#dcfce7" };
};

const getTag = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class")) return { label: "URGENT", dot: "#dc2626" };
  if (t.includes("deadline") || t.includes("due")) return { label: "REMINDER", dot: "#f97316" };
  return { label: "INFO", dot: "#22c55e" };
};

const StatCard = ({ icon, label, value, sub, color, onClick }) => (
  <div onClick={onClick} style={{
    background: "var(--card-bg)", borderRadius: "var(--radius-lg)",
    border: "1px solid var(--card-border)", padding: "18px 20px",
    flex: 1, minWidth: "calc(50% - 8px)", boxShadow: "var(--shadow-sm)",
    cursor: onClick ? "pointer" : "default", transition: "all 0.2s",
    position: "relative", overflow: "hidden",
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "var(--shadow-md)")}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
  >
    <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: color || "var(--green-50)", borderRadius: "0 var(--radius-lg) 0 40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: "var(--text-primary)", marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>
  </div>
);

const CACHE_KEY = "bupulse_dashboard";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null; // expired
    return data;
  } catch { return null; }
};

const setCache = (data) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(() => getCache()); // load cache instantly
  const [loading, setLoading] = useState(!getCache()); // skip skeleton if cached
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      // Already showing cached data — fetch fresh in background silently
      setRefreshing(true);
      api.get("/classroom/dashboard")
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(() => {}) // silently fail — cached data still shows
        .finally(() => setRefreshing(false));
      return;
    }

    // No cache — show skeleton and wait
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    api.get("/classroom/dashboard", { signal: controller.signal })
      .then(r => { setData(r.data); setCache(r.data); })
      .catch(e => {
        if (e.name !== "CanceledError") setError("Couldn't load dashboard. Try refreshing.");
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  const now = new Date();

  if (loading) return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ height: 100, borderRadius: "var(--radius-xl)", background: "var(--card-bg)", marginBottom: 16, animation: "pulse-dot 1.5s ease-in-out infinite" }} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => <div key={i} style={{ flex: 1, minWidth: "calc(50% - 8px)", height: 100, borderRadius: "var(--radius-lg)", background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.15}s infinite` }} />)}
      </div>
    </div>
  );

  if (error) return <div style={{ background: "#fee2e2", borderRadius: "var(--radius-lg)", padding: "16px 20px", color: "#dc2626" }}>⚠️ {error}</div>;

  const { stats = {}, recentAnnouncements = [], upcomingDeadlines = [], courses = [] } = data || {};
  const pendingCount = upcomingDeadlines.filter(d => new Date(d.dueDate) >= now).length;
  const overdueCount = (stats.urgentAlerts ?? 0);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Subtle refresh indicator */}
      {refreshing && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 12, color: "var(--text-muted)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green-500)", animation: "pulse-dot 1s ease-in-out infinite" }} />
          Updating...
        </div>
      )}

      {/* Hero Banner */}
      <div style={{
        background: "linear-gradient(135deg, var(--green-900) 0%, #1e4d1e 100%)",
        borderRadius: "var(--radius-xl)", padding: "24px 28px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ color: "var(--green-200)", fontSize: 13, marginBottom: 6 }}>{now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })}</p>
            <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,28px)", marginBottom: 8 }}>
              {greeting()}, {user?.name?.split(" ")[0] || "Student"}! 👋
            </h2>
            <p style={{ color: "var(--green-200)", fontSize: 13 }}>Here's what's happening in your classes today.</p>
          </div>
          {overdueCount > 0 && (
            <div onClick={() => navigate("/pending-activities")} style={{ background: "#dc2626", borderRadius: "var(--radius-lg)", padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{overdueCount} Overdue!</div>
                <div style={{ color: "#fca5a5", fontSize: 11 }}>Tap to view</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon="📚" label="Enrolled Classes" value={stats.totalCourses ?? 0} sub="Active courses" color="rgba(45,90,27,0.1)" onClick={() => navigate("/enrolled-classes")} />
        <StatCard icon="⏳" label="Pending Tasks" value={pendingCount} sub="Due soon" color="rgba(249,115,22,0.1)" onClick={() => navigate("/pending-activities")} />
        <StatCard icon="📢" label="New Announcements" value={stats.newAnnouncements ?? 0} sub="Last 48 hours" color="rgba(59,130,246,0.1)" onClick={() => navigate("/announcements")} />
        <StatCard icon="🚨" label="Overdue" value={overdueCount} sub="Needs attention" color="rgba(220,38,38,0.1)" onClick={() => navigate("/pending-activities")} />
      </div>

      {/* Courses + Content */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Recent Announcements */}
        <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-lg)", border: "1px solid var(--card-border)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Recent Announcements</h3>
            <button onClick={() => navigate("/announcements")} style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, cursor: "pointer" }}>View all →</button>
          </div>

          {recentAnnouncements.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><p style={{ fontSize: 13 }}>No recent announcements</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentAnnouncements.slice(0, 4).map((ann, i) => {
                const tag = getTag(ann.text);
                const h = Math.floor((Date.now() - new Date(ann.updateTime || ann.creationTime).getTime()) / 3600000);
                const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                return (
                  <div key={ann.id || i} style={{ display: "flex", gap: 10, padding: "10px", borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.dot, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green-700)", marginBottom: 2 }}>{ann.courseName}</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 4 }}>{ann.text?.substring(0, 80)}{ann.text?.length > 80 ? "..." : ""}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ago}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>

        {/* Upcoming Deadlines */}
        <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-lg)", border: "1px solid var(--card-border)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Upcoming Deadlines</h3>
            <button onClick={() => navigate("/pending-activities")} style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, cursor: "pointer" }}>View all →</button>
          </div>

          {upcomingDeadlines.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div><p style={{ fontSize: 13 }}>You're all caught up!</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingDeadlines.slice(0, 5).map((d, i) => {
                const date = new Date(d.dueDate);
                const status = daysLeft(d.dueDate);
                return (
                  <div key={d.courseWorkId || i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px", borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ width: 38, textAlign: "center", flexShrink: 0, background: "var(--green-50)", borderRadius: "var(--radius-md)", padding: "4px 2px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--green-700)" }}>{date.toLocaleDateString("en-PH", { month: "short" }).toUpperCase()}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green-900)", lineHeight: 1 }}>{date.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.courseName}</div>
                    </div>
                    <span style={{ background: status.bg, color: status.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          }
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
