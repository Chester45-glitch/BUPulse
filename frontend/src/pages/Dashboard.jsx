import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const greeting = () => { 
  const h = new Date().getHours(); 
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; 
};

const Ico = ({path,size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:path}}/>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulmsStatus, setBulmsStatus] = useState("Disconnected");
  const [bulmsData, setBulmsData] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Production UI States for Cookie Linking
  const [showInput, setShowInput] = useState(false);
  const [sessionKey, setSessionKey] = useState("");

  useEffect(() => {
    loadDashboard();
    if (user?.id) loadBulmsData();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const r = await api.get("/classroom/dashboard");
      setData(r.data);
    } catch (err) { console.error("Dashboard load failed"); }
    finally { setLoading(false); }
  };

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
    setBulmsStatus("Syncing...");
    try {
      const r = await api.post("/bulms/link", { userId: user.id, sessionCookie: sessionKey });
      if (r.data?.success) {
        setBulmsStatus("Connected!");
        setShowInput(false);
        setSessionKey("");
        await loadBulmsData();
      } else {
        alert("Session Key expired or invalid. Please refresh BULMS and try again.");
      }
    } catch { setBulmsStatus("Link failed."); }
    finally { setIsLinking(false); }
  };

  const { stats = {}, recentAnnouncements = [], upcomingDeadlines = [], courses = [] } = data || {};
  const bulmsConnected = bulmsStatus === "Connected!";

  // Merge GC and BU Data
  let mergedDeadlines = [...upcomingDeadlines];
  if (bulmsData?.activities) {
    const buDls = bulmsData.activities
      .filter(act => act.dueDate && !act.dueDate.toLowerCase().includes("no due date"))
      .map((act, i) => ({
        courseWorkId: `bu-${i}`, title: act.title, courseName: 'BULMS', dueDate: new Date(act.dueDate).toISOString()
      }));
    mergedDeadlines = [...mergedDeadlines, ...buDls];
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Loading BUPulse...</div>;

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      
      {/* ── 1. Hero & Quick Badges ── */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 20, padding: "24px 28px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: stats.urgentAlerts > 0 ? "#dc2626" : "var(--border-color)" }}/>
        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <p style={{ color:"var(--text-muted)", fontSize:12, marginBottom:6 }}>{new Date().toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric"})}</p>
            <h2 style={{ color:"var(--text-primary)", fontSize:"24px", fontWeight:700, marginBottom:4 }}>{greeting()}, {user?.name?.split(" ")[0]}! 👋</h2>
            <p style={{ color:"var(--text-muted)", fontSize:13 }}>Here is your academic overview.</p>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <div onClick={() => navigate("/pending-activities")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--card-border)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700 }}>PENDING</div>
              <div style={{ fontSize:20, fontWeight:800, color:"var(--text-primary)" }}>{mergedDeadlines.length}</div>
            </div>
            <div onClick={() => navigate("/announcements")} style={{ background:"var(--bg-tertiary)", borderRadius:12, padding:"10px 14px", cursor:"pointer", border:"1px solid var(--card-border)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700 }}>NEW</div>
              <div style={{ fontSize:20, fontWeight:800, color:"var(--text-primary)" }}>{stats.newAnnouncements || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Stats Grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }} className="stats-grid">
        {[
          { label:"Classes", value:courses.length + (bulmsData?.subjects?.length || 0), sub:"Enrolled", color:"#16a34a" },
          { label:"Pending", value:mergedDeadlines.length, sub:"Due soon", color:"#d97706" },
          { label:"Alerts", value:stats.urgentAlerts || 0, sub:"Attention", color:"#dc2626" },
          { label:"New Posts", value:stats.newAnnouncements || 0, sub:"Last 48h", color:"#2563eb" },
        ].map(s => (
          <div key={s.label} style={{ background:"var(--card-bg)", borderRadius:14, border: "1px solid var(--card-border)", padding:"14px 16px", position:"relative" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: s.color }}/>
            <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600 }}>{s.label}</span>
            <div style={{ fontSize:28, fontWeight:800 }}>{s.value}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3. Announcements & Deadlines ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom: 20 }} className="dashboard-grid">
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", fontWeight:700 }}>Announcements</div>
          <div style={{ padding:"8px 0" }}>
            {recentAnnouncements.slice(0,3).map((ann, i) => (
              <div key={i} style={{ padding:"10px 16px", borderBottom: "1px solid var(--border-color)" }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{ann.courseName}</div>
                <div style={{ fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ann.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--card-border)", fontWeight:700 }}>Upcoming Deadlines</div>
          <div style={{ padding:"8px 0" }}>
            {mergedDeadlines.slice(0,3).map((d,i) => (
              <div key={i} style={{ padding:"10px 16px", borderBottom: "1px solid var(--border-color)", display:"flex", justifyContent:"space-between" }}>
                <div style={{ minWidth:0 }}><div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.title}</div><div style={{ fontSize:11 }}>{d.courseName}</div></div>
                <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", background:"var(--bg-tertiary)", borderRadius:6 }}>{new Date(d.dueDate).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. BULMS Sync Widget (Production Method) ── */}
      <div style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 20, border: "1px solid var(--card-border)", overflow: "hidden", position: "relative", marginBottom: 40 }}>
        <div style={{ position:"absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2563eb, #3b82f6)", opacity: bulmsConnected ? 1 : 0.4 }} />
        <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: bulmsConnected ? "#eff6ff" : "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <Ico path='<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' size={24}/>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bicol University LMS</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: bulmsConnected ? "#10b981" : "#94a3b8" }} /><span style={{ fontSize: 13 }}>{bulmsStatus}</span></div>
            </div>
          </div>
          
          {!bulmsConnected ? (
            <button onClick={() => { window.open("https://bulms.bicol-u.edu.ph/login/index.php", "_blank"); setShowInput(true); }} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Connect Account</button>
          ) : (
            <button onClick={async () => { setIsSyncing(true); await api.post("/bulms/sync-now", { userId: user.id }); await loadBulmsData(); setIsSyncing(false); }} disabled={isSyncing} style={{ background: "#fff", border: "1px solid var(--border-color)", padding: "10px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>{isSyncing ? "Syncing..." : "Force Sync"}</button>
          )}
        </div>

        {showInput && !bulmsConnected && (
          <div style={{ padding: "0 24px 24px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ background: "rgba(37,99,235,0.05)", border: "1px dashed #2563eb", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#1e40af" }}>Paste your MoodleSession cookie value below:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} placeholder="Enter key..." style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid var(--card-border)" }} />
                <button onClick={handleLinkBulms} disabled={isLinking || !sessionKey} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0 20px", borderRadius: 8, fontWeight: 700 }}>{isLinking ? "Wait..." : "Sync"}</button>
              </div>
              <button onClick={() => setShowCookieInput(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, marginTop: 10, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
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