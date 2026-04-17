import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const greeting = () => { 
  const h = new Date().getHours(); 
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; 
};

const CACHE_KEY = "bupulse_dashboard";
const CACHE_TTL = 5 * 60 * 1000;
const getCache = () => { 
  try { 
    const r = localStorage.getItem(CACHE_KEY); 
    if (!r) return null; 
    const {data,ts} = JSON.parse(r); 
    if (Date.now()-ts > CACHE_TTL) return null; 
    return data; 
  } catch { return null; } 
};
const setCache = (d) => { 
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({data:d,ts:Date.now()})); } catch {} 
};

const Ico = ({path,size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:path}}/>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData]         = useState(() => getCache());
  const [loading, setLoading]   = useState(!getCache());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  const [bulmsStatus, setBulmsStatus] = useState("Disconnected");
  const [bulmsData, setBulmsData] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // NEW: UI State for the input field
  const [showInput, setShowInput] = useState(false);
  const [sessionKey, setSessionKey] = useState("");

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setRefreshing(true);
      api.get("/classroom/dashboard")
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(() => {})
        .finally(() => setRefreshing(false));
    } else {
      api.get("/classroom/dashboard")
        .then(r => { setData(r.data); setCache(r.data); })
        .catch(() => setError("Couldn't load dashboard."))
        .finally(() => setLoading(false));
    }
    if (user?.id) loadBulmsData();
  }, [user]);

  const loadBulmsData = async () => {
    try {
      const statusRes = await api.get(`/bulms/status?userId=${user.id}`);
      if (statusRes.data?.status === 'connected') {
        setBulmsStatus("Connected!");
        const r = await api.get(`/bulms/data?userId=${user.id}`);
        if (r.data?.data) setBulmsData(r.data.data);
      } else {
        setBulmsStatus("Disconnected");
        setBulmsData(null);
      }
    } catch { setBulmsStatus("Disconnected"); }
  };

  const handleLinkBulms = async () => {
    if (!sessionKey) return alert("Please paste your MoodleSession key first.");

    setIsLinking(true);
    setBulmsStatus("Connecting...");
    try {
      const r = await api.post("/bulms/link", { userId: user.id, sessionCookie: sessionKey });
      if (r.data?.success) {
        setBulmsStatus("Connected!");
        setShowInput(false);
        setSessionKey("");
        await loadBulmsData();
      } else {
        alert("Session Key expired. Please refresh BULMS and try again.");
      }
    } catch { setBulmsStatus("Link failed."); }
    finally { setIsLinking(false); }
  };

  const openBulms = () => {
    window.open("https://bulms.bicol-u.edu.ph/login/index.php", "_blank");
    setShowInput(true);
  };

  const now = new Date();
  const { stats = {}, recentAnnouncements = [], upcomingDeadlines = [], courses = [] } = data || {};
  const firstName = user?.name?.split(" ")[0] || "Student";
  const bulmsConnected = bulmsStatus === "Connected!";

  let mergedCourses = [...courses];
  let mergedDeadlines = [...upcomingDeadlines];

  if (bulmsData) {
    if (bulmsData.subjects) {
      mergedCourses = [...mergedCourses, ...bulmsData.subjects.map((sub, i) => ({
        id: `bulms-course-${i}`, name: sub, alternateLink: 'https://bulms.bicol-u.edu.ph/my/'
      }))];
    }
    if (bulmsData.activities) {
      mergedDeadlines = [...mergedDeadlines, ...bulmsData.activities
        .filter(act => act.dueDate && !act.dueDate.toLowerCase().includes("no due date"))
        .map((act, i) => ({
          courseWorkId: `bulms-act-${i}`, title: act.title, courseName: 'BULMS', dueDate: new Date(act.dueDate).toISOString()
        }))];
    }
  }

  const pendingCount = mergedDeadlines.filter(d => new Date(d.dueDate) >= now).length;
  const overdueCount = stats.urgentAlerts ?? 0;
  const totalCoursesCount = mergedCourses.length;

  if (loading) return <div style={{ padding: 60, textAlign: "center" }}>Generating your dashboard...</div>;

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      
      {/* ── 1. Hero ── */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 20, padding: "24px 28px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: overdueCount > 0 ? "#dc2626" : "var(--border-color)" }}/>
        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <p style={{ color:"var(--text-muted)", fontSize:12, marginBottom:6 }}>{now.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric"})}</p>
            <h2 style={{ color:"var(--text-primary)", fontSize:"24px", fontWeight:700, marginBottom:4 }}>{greeting()}, {firstName}! 👋</h2>
            <p style={{ color:"var(--text-muted)", fontSize:13 }}>Here's the summary of your academic activity.</p>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {overdueCount > 0 && (
              <div onClick={() => navigate("/pending-activities")} style={{ background:"#dc2626", borderRadius:12, padding:"10px 14px", cursor:"pointer" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)", fontWeight:700 }}>⚠ OVERDUE</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>{overdueCount}</div>
              </div>
            )}
            <div onClick={() => navigate("/pending-activities")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--border-color)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700 }}>PENDING</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)" }}>{pendingCount}</div>
            </div>
            <div onClick={() => navigate("/announcements")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--border-color)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700 }}>NEW</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)" }}>{stats.newAnnouncements ?? 0}</div>
            </div>
          </div>
        </div>

        {mergedCourses.length > 0 && (
          <div style={{ marginTop:16, display:"flex", gap:6, overflowX:"auto" }}>
            {mergedCourses.slice(0,6).map((c) => (
              <a key={c.id} href={c.alternateLink} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0, padding:"5px 12px", borderRadius:99, background:"var(--bg-tertiary)", border:"1px solid var(--card-border)", textDecoration:"none", fontSize:11.5, color:"var(--text-secondary)", fontWeight:500 }}>{c.name.slice(0,22)}</a>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Stats Row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }} className="stats-grid">
        {[
          { label:"Classes", value:totalCoursesCount, sub:"Enrolled", path:"/enrolled-classes", color:"#16a34a", icon:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
          { label:"Pending", value:pendingCount, sub:"Due soon", path:"/pending-activities", color:"#d97706", icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
          { label:"Announcements", value:stats.newAnnouncements??0, sub:"Last 48h", path:"/announcements", color:"#2563eb", icon:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
          { label:"Overdue", value:overdueCount, sub:"Attention", path:"/pending-activities", color:"#dc2626", icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', red:true },
        ].map(s => (
          <div key={s.label} onClick={() => navigate(s.path)} style={{ background:"var(--card-bg)", borderRadius:14, border: "1px solid var(--card-border)", padding:"14px 16px", cursor:"pointer", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: (s.red && s.value > 0) ? "#dc2626" : s.color }}/>
            <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600 }}>{s.label}</span>
            <div style={{ fontSize:30, fontWeight:800, color: s.red && s.value > 0 ? "#dc2626" : "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:"var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3. Grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom: 20 }} className="dashboard-grid">
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", fontWeight:700 }}>Announcements</div>
          <div style={{ padding:"8px 0" }}>
            {recentAnnouncements.length === 0 ? <p style={{ textAlign:"center", padding:20, color:"var(--text-muted)" }}>No new posts</p> : recentAnnouncements.slice(0,3).map((ann, i) => (
              <div key={i} style={{ padding:"10px 16px", borderBottom: "1px solid var(--border-color)", display:"flex", gap:10 }}>
                <div style={{ minWidth:0 }}><div style={{ fontSize:11.5, fontWeight:700 }}>{ann.courseName}</div><div style={{ fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ann.text}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", fontWeight:700 }}>Deadlines</div>
          <div style={{ padding:"8px 0" }}>
            {mergedDeadlines.length === 0 ? <p style={{ textAlign:"center", padding:20, color:"var(--text-muted)" }}>All caught up! 🎉</p> : mergedDeadlines.slice(0,3).map((d,i) => (
              <div key={i} style={{ padding:"10px 16px", borderBottom: "1px solid var(--border-color)", display:"flex", justifyContent:"space-between" }}>
                <div style={{ minWidth:0 }}><div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.title}</div><div style={{ fontSize:11.5 }}>{d.courseName}</div></div>
                <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 8px", background:"var(--bg-tertiary)", borderRadius:6 }}>{new Date(d.dueDate).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. BULMS Widget ── */}
      <div style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 20, border: "1px solid var(--card-border)", overflow: "hidden", position: "relative", marginBottom: 40 }}>
        <div style={{ position:"absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2563eb, #3b82f6)", opacity: bulmsConnected ? 1 : 0.4 }} />
        <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: bulmsConnected ? "#eff6ff" : "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: bulmsConnected ? "#2563eb" : "var(--text-muted)" }}>
              <Ico path='<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' size={24}/>
            </div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700 }}>Bicol University LMS</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: bulmsConnected ? "#10b981" : "#94a3b8" }} /><span style={{ fontSize: 13 }}>{bulmsStatus}</span></div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            {!bulmsConnected ? (
              <button onClick={openBulms} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
                Connect Account
              </button>
            ) : (
              <button onClick={handleSyncBulms} disabled={isSyncing} style={{ background: "#fff", color: "#000", border: "1px solid var(--border-color)", padding: "10px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
                {isSyncing ? "Syncing..." : "Force Sync"}
              </button>
            )}
          </div>
        </div>

        {/* INTEGRATED INPUT AREA: Appears only when linking */}
        {showInput && !bulmsConnected && (
          <div style={{ padding: "0 24px 24px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ background: "rgba(37,99,235,0.05)", border: "1px dashed #2563eb", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#1e40af" }}>Paste your Session Key below to finish linking:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input 
                  type="text" 
                  value={sessionKey} 
                  onChange={(e) => setSessionKey(e.target.value)}
                  placeholder="e.g. j7h2k9..." 
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--card-border)", outline: "none", fontSize: 14 }}
                />
                <button 
                  onClick={handleLinkBulms} 
                  disabled={isLinking || !sessionKey}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: isLinking ? 0.6 : 1 }}
                >
                  {isLinking ? "Wait..." : "Sync Now"}
                </button>
              </div>
              <button onClick={() => setShowInput(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, marginTop: 10, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
            </div>
          </div>
        )}

        {bulmsConnected && bulmsData && (
          <div style={{ borderTop: "1px solid var(--border-color)", background: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border-color)" }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Subjects</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {bulmsData.subjects.map((sub, i) => <span key={i} style={{ background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: 8, fontSize: 12 }}>{sub}</span>)}
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Next Activities</h4>
              {bulmsData.activities.slice(0, 3).map((act, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{act.title}</span>
                  <span style={{ fontSize: 11.5, color: "#d97706" }}>{act.dueDate}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @media (max-width: 700px) { .stats-grid { grid-template-columns: 1fr 1fr !important; } .dashboard-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}