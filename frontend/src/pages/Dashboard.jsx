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

  // ── BULMS States ──
  const [bulmsStatus, setBulmsStatus] = useState("Disconnected");
  const [bulmsData, setBulmsData] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // 1. Fetch Dashboard Data
    const cached = getCache();
    if (cached) {
      setRefreshing(true);
      api.get("/classroom/dashboard")
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(() => {})
        .finally(() => setRefreshing(false));
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      api.get("/classroom/dashboard", { signal: controller.signal })
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(e => { if (e.name !== "CanceledError") setError("Couldn't load dashboard. Try refreshing."); })
        .finally(() => { clearTimeout(timeout); setLoading(false); });
    }

    // 2. Fetch Initial BULMS Data
    if (user?.id) {
      loadBulmsData();
    }
  }, [user]);

  // ── BULMS Functions ──
  const loadBulmsData = async () => {
    try {
      const statusRes = await api.get(`/bulms/status?userId=${user.id}`);
      
      if (statusRes.data && statusRes.data.status === 'connected') {
        setBulmsStatus("Connected!");
        const r = await api.get(`/bulms/data?userId=${user.id}`);
        if (r.data && r.data.data) {
          setBulmsData(r.data.data);
        } else {
          setBulmsData({ subjects: [], activities: [] });
        }
      } else {
        setBulmsStatus("Disconnected");
        setBulmsData(null);
      }
    } catch (err) {
      console.log("BULMS not connected yet.");
      setBulmsStatus("Disconnected");
    }
  };

  const handleLinkBulms = async () => {
    setIsLinking(true);
    setBulmsStatus("Opening browser...");
    try {
      const r = await api.post("/bulms/link", { userId: user.id });
      if (r.data && r.data.success) {
        setBulmsStatus("Connected!");
        await loadBulmsData();
      } else {
        setBulmsStatus(`Error: ${r.data?.message || "Failed to link"}`);
      }
    } catch (err) {
      setBulmsStatus("Server disconnected.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleSyncBulms = async () => {
    setIsSyncing(true);
    try {
      await api.post("/bulms/sync-now", { userId: user.id });
      await loadBulmsData();
    } finally {
      setIsSyncing(false);
    }
  };

  const now = new Date();
  const { stats = {}, recentAnnouncements = [], upcomingDeadlines = [], courses = [] } = data || {};
  const firstName = user?.name?.split(" ")[0] || "Student";
  const bulmsConnected = bulmsStatus === "Connected!";

  // ==========================================
  // ── DATA MERGING LOGIC (Google + BULMS) ──
  // ==========================================
  let mergedCourses = [...courses];
  let mergedDeadlines = [...upcomingDeadlines];

  if (bulmsData) {
    if (bulmsData.subjects) {
      const formattedSubjects = bulmsData.subjects.map((sub, i) => ({
        id: `bulms-course-${i}`,
        name: sub,
        alternateLink: 'https://bulms.bicol-u.edu.ph/my/'
      }));
      mergedCourses = [...mergedCourses, ...formattedSubjects];
    }

    if (bulmsData.activities) {
      const formattedActivities = bulmsData.activities
        .filter(act => !act.dueDate.toLowerCase().includes("no due date"))
        .map((act, i) => {
          let parsedDate = new Date(act.dueDate);
          if (isNaN(parsedDate)) parsedDate = new Date();
          return {
            courseWorkId: `bulms-act-${i}`,
            title: act.title,
            courseName: 'BULMS',
            dueDate: parsedDate.toISOString()
          };
        });
      mergedDeadlines = [...mergedDeadlines, ...formattedActivities];
    }
  }

  const pendingCount = mergedDeadlines.filter(d => new Date(d.dueDate) >= now).length;
  const overdueCount = stats.urgentAlerts ?? 0; 
  const totalCoursesCount = mergedCourses.length;

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
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 20, padding: "24px 28px", marginBottom: 14,
        position: "relative", overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: overdueCount > 0 ? "#dc2626" : "var(--border-color)", borderRadius:"20px 20px 0 0" }}/>

        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <p style={{ color:"var(--text-muted)", fontSize:12, marginBottom:6 }}>
              {now.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",timeZone:"Asia/Manila"})}
            </p>
            <h2 style={{ color:"var(--text-primary)", fontSize:"clamp(20px,4vw,26px)", fontFamily:"var(--font-display)", fontWeight:700, marginBottom:4, lineHeight:1.2 }}>
              {greeting()}, {firstName}! 👋
            </h2>
            <p style={{ color:"var(--text-muted)", fontSize:13 }}>
              Here's what's happening in your classes today.
            </p>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {overdueCount > 0 && (
              <div onClick={() => navigate("/pending-activities")} style={{ background:"#dc2626", borderRadius:12, padding:"10px 14px", cursor:"pointer" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)", fontWeight:700, marginBottom:2 }}>⚠ OVERDUE</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#fff", lineHeight:1 }}>{overdueCount}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.65)", marginTop:2 }}>Tap to view</div>
              </div>
            )}
            {pendingCount > 0 && (
              <div onClick={() => navigate("/pending-activities")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--border-color)" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700, marginBottom:2 }}>PENDING</div>
                <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", lineHeight:1 }}>{pendingCount}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>Due soon</div>
              </div>
            )}
            <div onClick={() => navigate("/announcements")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--border-color)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700, marginBottom:2 }}>NEW</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", lineHeight:1 }}>{stats.newAnnouncements ?? 0}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>Announcements</div>
            </div>
          </div>
        </div>

        {mergedCourses.length > 0 && (
          <div style={{ marginTop:16, display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
            {mergedCourses.slice(0,6).map((c,i) => (
              <a key={c.id} href={c.alternateLink} target="_blank" rel="noopener noreferrer"
                style={{ flexShrink:0, display:"inline-flex", alignItems:"center", padding:"5px 12px", borderRadius:99, background:"var(--bg-tertiary)", border:"1px solid var(--border-color)", textDecoration:"none", transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="var(--border-color)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="var(--bg-tertiary)";}}>
                <span style={{ fontSize:11.5, color:"var(--text-secondary)", fontWeight:500, whiteSpace:"nowrap" }}>{c.name.length>22?c.name.slice(0,21)+"…":c.name}</span>
              </a>
            ))}
            {mergedCourses.length > 6 && (
              <button onClick={() => navigate("/enrolled-classes")} style={{ flexShrink:0, padding:"5px 12px", borderRadius:99, background:"var(--bg-tertiary)", color:"var(--text-muted)", fontSize:11.5, cursor:"pointer", border:"none" }}>
                +{mergedCourses.length-6} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── UPGRADED BULMS INTEGRATION WIDGET ── */}
      <div style={{
        background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        borderRadius: 20,
        border: "1px solid var(--card-border)",
        overflow: "hidden",
        boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
        marginBottom: 20,
        position: "relative"
      }}>
        {/* Decorative Top Accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2563eb, #3b82f6)", opacity: bulmsConnected ? 1 : 0.4 }} />

        <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: 14, 
              background: bulmsConnected ? "#eff6ff" : "var(--bg-tertiary)", 
              display: "flex", alignItems: "center", justifyContent: "center", 
              color: bulmsConnected ? "#2563eb" : "var(--text-muted)",
              boxShadow: bulmsConnected ? "inset 0 0 0 1px #bfdbfe" : "none"
            }}>
              <Ico path='<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' size={24}/>
            </div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Bicol University LMS</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: bulmsStatus.includes("Error") ? "#ef4444" : bulmsConnected ? "#10b981" : "#94a3b8", boxShadow: `0 0 8px ${bulmsConnected ? "#10b981" : "transparent"}` }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: bulmsStatus.includes("Error") ? "#ef4444" : "var(--text-muted)" }}>
                  {bulmsStatus}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            {!bulmsConnected ? (
              <button 
                onClick={handleLinkBulms} disabled={isLinking}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: isLinking ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
              >
                {isLinking ? "Connecting..." : "Connect Account"}
              </button>
            ) : (
              <button 
                onClick={handleSyncBulms} disabled={isSyncing}
                style={{ background: "#fff", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "10px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: isSyncing ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                {isSyncing ? "Syncing..." : "Force Sync"}
              </button>
            )}
          </div>
        </div>

        {bulmsConnected && bulmsData && (
          <div style={{ borderTop: "1px solid var(--border-color)", background: "#fff", padding: "0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 0 }}>
              <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border-color)" }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Synced Subjects</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {bulmsData.subjects.length > 0 ? bulmsData.subjects.map((sub, i) => (
                    <span key={i} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: 8, fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500 }}>{sub}</span>
                  )) : <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No subjects found.</p>}
                </div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Recent Activities</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bulmsData.activities.length > 0 ? bulmsData.activities.slice(0, 3).map((act, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{act.title}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#d97706", background: "#ffedd5", padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>{act.dueDate}</span>
                    </div>
                  )) : <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No upcoming activities.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }} className="stats-grid">
        {[
          { label:"Classes",       value:totalCoursesCount,          sub:"Enrolled",        path:"/enrolled-classes",   color:"#16a34a", icon:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',  red:false },
          { label:"Pending",       value:pendingCount,               sub:"Due soon",        path:"/pending-activities", color:"#d97706", icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',                                               red:false },
          { label:"Announcements", value:stats.newAnnouncements??0,  sub:"Last 48h",        path:"/announcements",      color:"#2563eb", icon:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',                             red:false },
          { label:"Overdue",       value:overdueCount,               sub:"Needs attention", path:"/pending-activities", color:"#dc2626", icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',        red:true  },
        ].map(s => (
          <div key={s.label} onClick={() => navigate(s.path)} style={{
            background:"var(--card-bg)", borderRadius:14,
            border: s.red && s.value > 0 ? "1px solid #fecaca" : "1px solid var(--card-border)",
            padding:"14px 16px", cursor:"pointer",
            transition:"all 0.18s", position:"relative", overflow:"hidden",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="var(--shadow-md)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: (s.red && s.value > 0) ? "#dc2626" : s.color, borderRadius:"14px 14px 0 0", opacity: s.red && s.value === 0 ? 0.25 : 0.9 }}/>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10, marginTop:4 }}>
              <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</span>
              <div style={{ width:28, height:28, borderRadius:8, background: s.color + "15", display:"flex", alignItems:"center", justifyContent:"center", color: s.red && s.value > 0 ? "#dc2626" : s.color }}>
                <Ico path={s.icon} size={15}/>
              </div>
            </div>
            <div style={{ fontSize:30, fontWeight:800, color: s.red && s.value > 0 ? "#dc2626" : "var(--text-primary)", lineHeight:1, marginBottom:2 }}>{s.value}</div>
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
              <div style={{ width:28, height:28, borderRadius:8, background:"var(--bg-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-muted)" }}>
                <Ico path='<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' size={14}/>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Announcements</span>
            </div>
            <button onClick={() => navigate("/announcements")} style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:500, cursor:"pointer", padding:"4px 10px", borderRadius:6, border:"1px solid var(--border-color)", background:"transparent" }}>View all →</button>
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
              return (
                <div key={ann.id||i} style={{ padding:"10px 16px", borderBottom: i<recentAnnouncements.length-1?"1px solid var(--border-color)":"none", display:"flex", gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:"var(--bg-tertiary)", border:"1px solid var(--border-color)", color:"var(--text-muted)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0, marginTop:1 }}>
                    {(ann.courseName||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-secondary)", marginBottom:2 }}>{ann.courseName}</div>
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
              <div style={{ width:28, height:28, borderRadius:8, background:"var(--bg-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-muted)" }}>
                <Ico path='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' size={14}/>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Deadlines</span>
            </div>
            <button onClick={() => navigate("/pending-activities")} style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:500, cursor:"pointer", padding:"4px 10px", borderRadius:6, border:"1px solid var(--border-color)", background:"transparent" }}>View all →</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {mergedDeadlines.length === 0 ? (
              <div style={{ textAlign:"center", padding:"28px 0", color:"var(--text-muted)" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
                <p style={{ fontSize:13 }}>You're all caught up!</p>
              </div>
            ) : mergedDeadlines.slice(0,5).map((d,i) => {
              const date = new Date(d.dueDate);
              const diff = Math.ceil((date - now) / 86400000);
              const isOverdue = diff < 0;
              const badgeColor = isOverdue ? "#dc2626" : "var(--text-muted)";
              const badgeBg    = isOverdue ? "#fee2e2"  : "var(--bg-tertiary)";
              const badgeLabel = isOverdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff}d left`;
              return (
                <div key={d.courseWorkId||i} style={{ padding:"10px 16px", borderBottom:i<mergedDeadlines.length-1?"1px solid var(--border-color)":"none", display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:40, textAlign:"center", flexShrink:0, background:"var(--bg-tertiary)", borderRadius:10, padding:"5px 4px", border:"1px solid var(--border-color)" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase" }}>{date.toLocaleDateString("en-PH",{month:"short"})}</div>
                    <div style={{ fontSize:20, fontWeight:800, color: isOverdue ? "#dc2626" : "var(--text-primary)", lineHeight:1 }}>{date.getDate()}</div>
                    <div style={{ fontSize:8.5, color:"var(--text-muted)" }}>{date.toLocaleDateString("en-PH",{weekday:"short"})}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>{d.title}</div>
                    <div style={{ fontSize:11.5, color:"var(--text-muted)" }}>{d.courseName}</div>
                  </div>
                  <span style={{ flexShrink:0, background:badgeBg, color:badgeColor, fontSize:10.5, fontWeight:700, borderRadius:6, padding:"3px 8px", border: isOverdue ? "1px solid #fecaca" : "1px solid var(--border-color)" }}>{badgeLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
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