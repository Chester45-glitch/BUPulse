import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const daysLeft = (dueDate) => {
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0) return { label: "Overdue", color: "#dc2626", bg: "#fee2e2" };
  if (d === 0) return { label: "Today", color: "#dc2626", bg: "#fee2e2" };
  if (d === 1) return { label: "Tomorrow", color: "#d97706", bg: "#ffedd5" };
  return { label: `${d}d left`, color: "#16a34a", bg: "#dcfce7" };
};

const CACHE_KEY = "bupulse_dashboard";
const CACHE_TTL = 5 * 60 * 1000;
const getCache = () => { try { const r = localStorage.getItem(CACHE_KEY); if (!r) return null; const {data,ts} = JSON.parse(r); if (Date.now()-ts > CACHE_TTL) return null; return data; } catch { return null; } };
const setCache = (d) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({data:d,ts:Date.now()})); } catch {} };

// ── Icons ──────────────────────────────────────────────────────
const Ico = ({path,size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:path}}/>;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData]         = useState(() => getCache());
  const [loading, setLoading]   = useState(!getCache());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setRefreshing(true);
      api.get("/classroom/dashboard")
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(() => {})
        .finally(() => setRefreshing(false));
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    api.get("/classroom/dashboard", { signal: controller.signal })
      .then(r => { setData(r.data); setCache(r.data); })
      .catch(e => { if (e.name !== "CanceledError") setError("Couldn't load dashboard. Try refreshing."); })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  const now = new Date();
  const { stats = {}, recentAnnouncements = [], upcomingDeadlines = [], courses = [] } = data || {};
  const pendingCount = upcomingDeadlines.filter(d => new Date(d.dueDate) >= now).length;
  const overdueCount = stats.urgentAlerts ?? 0;
  const firstName = user?.name?.split(" ")[0] || "Student";

  if (loading) return (
    <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ height: 120, borderRadius: 18, background: "var(--card-bg)", marginBottom: 16, animation: "pulse 1.5s ease infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[...Array(4)].map((_,i) => <div key={i} style={{ height: 90, borderRadius: 14, background: "var(--card-bg)", animation: `pulse 1.5s ease ${i*0.1}s infinite` }}/>)}
      </div>
    </div>
  );

  if (error) return <div style={{ background: "#fee2e2", borderRadius: 12, padding: "16px 20px", color: "#dc2626", maxWidth: 900, margin: "0 auto" }}>⚠️ {error}</div>;

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 900, margin: "0 auto", width: "100%" }}>

      {refreshing && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, fontSize:11.5, color:"var(--text-muted)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--green-500)", animation:"pulse 1s ease infinite" }}/>
          Updating…
        </div>
      )}

      {/* ── Hero ── */}
      <div style={{
        background: "linear-gradient(135deg, #0d1f0d 0%, #1a3a1a 60%, #0f3320 100%)",
        borderRadius: 20, padding: "28px 28px 24px", marginBottom: 16,
        position: "relative", overflow: "hidden",
      }}>
        {/* Dot pattern */}
        <div style={{ position:"absolute", inset:0, opacity:0.05, backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize:"24px 24px", pointerEvents:"none" }}/>
        {/* Glow orb */}
        <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,rgba(74,222,128,0.12) 0%,transparent 70%)", pointerEvents:"none" }}/>

        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginBottom:6 }}>
              {now.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",timeZone:"Asia/Manila"})}
            </p>
            <h2 style={{ color:"#fff", fontSize:"clamp(20px,4vw,28px)", fontFamily:"var(--font-display)", fontWeight:700, marginBottom:6, lineHeight:1.2 }}>
              {greeting()}, {firstName}! 👋
            </h2>
            <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13.5 }}>
              Here's what's happening in your classes today.
            </p>
          </div>

          {/* Quick badges */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {overdueCount > 0 && (
              <div onClick={() => navigate("/pending-activities")} style={{ background:"rgba(220,38,38,0.85)", backdropFilter:"blur(8px)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid rgba(255,100,100,0.3)" }}>
                <div style={{ fontSize:10, color:"#fca5a5", fontWeight:700, marginBottom:2 }}>⚠️ OVERDUE</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#fff", lineHeight:1 }}>{overdueCount}</div>
                <div style={{ fontSize:10, color:"#fca5a5", marginTop:2 }}>Tap to view</div>
              </div>
            )}
            {pendingCount > 0 && (
              <div onClick={() => navigate("/pending-activities")} style={{ background:"rgba(255,255,255,0.07)", backdropFilter:"blur(8px)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700, marginBottom:2 }}>📋 PENDING</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#fff", lineHeight:1 }}>{pendingCount}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>Due soon</div>
              </div>
            )}
            <div onClick={() => navigate("/announcements")} style={{ background:"rgba(255,255,255,0.07)", backdropFilter:"blur(8px)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700, marginBottom:2 }}>🔔 NEW</div>
              <div style={{ fontSize:22, fontWeight:800, color:"#fff", lineHeight:1 }}>{stats.newAnnouncements ?? 0}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>Announcements</div>
            </div>
          </div>
        </div>

        {/* Course pill strip */}
        {courses.length > 0 && (
          <div style={{ position:"relative", marginTop:20, display:"flex", gap:8, overflowX:"auto", paddingBottom:2 }}>
            {courses.slice(0,6).map((c,i) => {
              const colors = ["#16a34a","#2563eb","#7c3aed","#d97706","#0891b2","#db2777"];
              const col = colors[i % colors.length];
              return (
                <a key={c.id} href={c.alternateLink} target="_blank" rel="noopener noreferrer"
                  style={{ flexShrink:0, display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:99, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", textDecoration:"none", transition:"all 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:col, flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:500, whiteSpace:"nowrap" }}>{c.name.length>22?c.name.slice(0,21)+"…":c.name}</span>
                </a>
              );
            })}
            {courses.length > 6 && (
              <button onClick={() => navigate("/enrolled-classes")} style={{ flexShrink:0, padding:"6px 12px", borderRadius:99, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" }}>
                +{courses.length-6} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }} className="stats-grid">
        {[
          { label:"Classes", value:stats.totalCourses??0, sub:"Enrolled", color:"#16a34a", bg:"rgba(22,163,74,0.08)", path:"/enrolled-classes", icon:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
          { label:"Pending", value:pendingCount, sub:"Due soon", color:"#d97706", bg:"rgba(217,119,6,0.08)", path:"/pending-activities", icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
          { label:"Announcements", value:stats.newAnnouncements??0, sub:"Last 48h", color:"#2563eb", bg:"rgba(37,99,235,0.08)", path:"/announcements", icon:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
          { label:"Overdue", value:overdueCount, sub:"Needs attention", color:"#dc2626", bg:"rgba(220,38,38,0.08)", path:"/pending-activities", icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
        ].map(s => (
          <div key={s.label} onClick={() => navigate(s.path)} style={{
            background:"var(--card-bg)", borderRadius:14,
            border:`1px solid var(--card-border)`,
            padding:"14px 16px", cursor:"pointer",
            transition:"all 0.18s", position:"relative", overflow:"hidden",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
            {/* Color accent bar */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:s.color, borderRadius:"14px 14px 0 0" }}/>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10, marginTop:4 }}>
              <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</span>
              <div style={{ width:30, height:30, borderRadius:8, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", color:s.color }}>
                <Ico path={s.icon} size={16}/>
              </div>
            </div>
            <div style={{ fontSize:30, fontWeight:800, color:s.color, lineHeight:1, marginBottom:2 }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:"var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Bottom two columns ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }} className="dashboard-grid">

        {/* Recent Announcements */}
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden", boxShadow:"var(--shadow-sm)" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:"rgba(37,99,235,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#2563eb" }}>
                <Ico path='<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' size={14}/>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Announcements</span>
            </div>
            <button onClick={() => navigate("/announcements")} style={{ fontSize:12, color:"var(--green-700)", fontWeight:600, cursor:"pointer", padding:"4px 10px", borderRadius:6, border:"1px solid var(--green-200)", background:"var(--green-50)" }}>View all →</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {recentAnnouncements.length === 0 ? (
              <div style={{ textAlign:"center", padding:"28px 0", color:"var(--text-muted)" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
                <p style={{ fontSize:13 }}>No recent announcements</p>
              </div>
            ) : recentAnnouncements.slice(0,4).map((ann,i) => {
              const h = Math.floor((Date.now() - new Date(ann.updateTime||ann.creationTime)) / 3600000);
              const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
              const PALETTE = ["#2563eb","#16a34a","#7c3aed","#d97706","#0891b2","#db2777","#dc2626"];
              const col = PALETTE[(ann.courseName||"").charCodeAt(0) % PALETTE.length];
              return (
                <div key={ann.id||i} style={{ padding:"10px 16px", borderBottom: i<recentAnnouncements.length-1?"1px solid var(--border-color)":"none", display:"flex", gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:col, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0, marginTop:1 }}>
                    {(ann.courseName||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11.5, fontWeight:700, color:col, marginBottom:2 }}>{ann.courseName}</div>
                    <div style={{ fontSize:13, color:"var(--text-primary)", lineHeight:1.45, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ann.text?.substring(0,70)}{ann.text?.length>70?"…":""}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>{ago}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden", boxShadow:"var(--shadow-sm)" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:"rgba(217,119,6,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#d97706" }}>
                <Ico path='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' size={14}/>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Deadlines</span>
            </div>
            <button onClick={() => navigate("/pending-activities")} style={{ fontSize:12, color:"var(--green-700)", fontWeight:600, cursor:"pointer", padding:"4px 10px", borderRadius:6, border:"1px solid var(--green-200)", background:"var(--green-50)" }}>View all →</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ textAlign:"center", padding:"28px 0", color:"var(--text-muted)" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
                <p style={{ fontSize:13 }}>You're all caught up!</p>
              </div>
            ) : upcomingDeadlines.slice(0,5).map((d,i) => {
              const date = new Date(d.dueDate);
              const status = daysLeft(d.dueDate);
              return (
                <div key={d.courseWorkId||i} style={{ padding:"10px 16px", borderBottom:i<upcomingDeadlines.length-1?"1px solid var(--border-color)":"none", display:"flex", gap:10, alignItems:"center" }}>
                  {/* Date block */}
                  <div style={{ width:40, textAlign:"center", flexShrink:0, background:"var(--bg-tertiary)", borderRadius:10, padding:"5px 4px", border:"1px solid var(--border-color)" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase" }}>{date.toLocaleDateString("en-PH",{month:"short"})}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:"var(--text-primary)", lineHeight:1 }}>{date.getDate()}</div>
                    <div style={{ fontSize:8.5, color:"var(--text-muted)" }}>{date.toLocaleDateString("en-PH",{weekday:"short"})}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>{d.title}</div>
                    <div style={{ fontSize:11.5, color:"var(--text-muted)" }}>{d.courseName}</div>
                  </div>
                  <span style={{ flexShrink:0, background:status.bg, color:status.color, fontSize:10.5, fontWeight:700, borderRadius:6, padding:"3px 8px" }}>{status.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .stats-grid { grid-template-columns: repeat(4,1fr); }
        .dashboard-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 700px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 400px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
