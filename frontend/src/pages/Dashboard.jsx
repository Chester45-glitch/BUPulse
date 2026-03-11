import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const greeting = () => { const h = new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };

const tagStyle = (text="") => {
  const t = text.toLowerCase();
  if (t.includes("urgent")||t.includes("no class")) return { label:"URGENT", bg:"#fee2e2", color:"#dc2626", dot:"#dc2626" };
  if (t.includes("deadline")||t.includes("due")) return { label:"REMINDER", bg:"#ffedd5", color:"#d97706", dot:"#f97316" };
  return { label:"INFO", bg:"#dcfce7", color:"#16a34a", dot:"#22c55e" };
};

const daysLeft = (dueDate) => {
  const d = Math.ceil((new Date(dueDate)-new Date())/86400000);
  if (d<0) return { label:"OVERDUE", color:"#dc2626", bg:"#fee2e2" };
  if (d===0) return { label:"TODAY", color:"#dc2626", bg:"#fee2e2" };
  if (d===1) return { label:"TOMORROW", color:"#d97706", bg:"#ffedd5" };
  return { label:`${d} DAYS`, color:"#16a34a", bg:"#dcfce7" };
};

const StatCard = ({ icon, label, value, sub }) => (
  <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", border:"1px solid var(--gray-200)", padding:"20px 22px", flex:1, minWidth:0, boxShadow:"var(--shadow-sm)" }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
      <span style={{ fontSize:13, color:"var(--gray-500)", fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:18 }}>{icon}</span>
    </div>
    <div style={{ fontSize:36, fontWeight:700, lineHeight:1, marginBottom:4 }}>{value}</div>
    <div style={{ fontSize:12, color:"var(--gray-400)" }}>{sub}</div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/classroom/dashboard")
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"Asia/Manila" });

  if (loading) return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
      {[...Array(4)].map((_,i) => <div key={i} style={{ flex:1, minWidth:160, height:110, borderRadius:"var(--radius-lg)", background:"var(--gray-100)", animation:`pulse-dot 1.5s ease-in-out ${i*0.1}s infinite` }} />)}
    </div>
  );

  if (error) return <div style={{ background:"#fee2e2", borderRadius:"var(--radius-lg)", padding:"20px 24px", color:"#dc2626" }}>⚠️ {error}</div>;

  const { stats={}, recentAnnouncements=[], upcomingDeadlines=[] } = data || {};

  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>

      {/* Banner */}
      <div style={{ background:"var(--green-900)", borderRadius:"var(--radius-xl)", padding:"28px 36px", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h2 style={{ color:"var(--white)", fontFamily:"var(--font-display)", fontSize:26, marginBottom:6 }}>
            {greeting()}, {user?.name?.split(" ")[0] || "Student"}! 👋
          </h2>
          <p style={{ color:"var(--green-200)", fontSize:14 }}>Here's what's happening in your school today.</p>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"var(--accent-gold)", fontFamily:"var(--font-display)", fontSize:32, lineHeight:1 }}>
            {now.toLocaleDateString("en-PH",{month:"short",day:"numeric",timeZone:"Asia/Manila"})}
          </div>
          <div style={{ color:"var(--green-200)", fontSize:13, marginTop:4 }}>{dateStr.split(",")[0]}, {now.getFullYear()}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <StatCard icon="📢" label="New Announcements" value={stats.newAnnouncements??0} sub="Since yesterday" />
        <StatCard icon="📅" label="Upcoming Deadlines" value={stats.upcomingDeadlines??0} sub="Within 7 days" />
        <StatCard icon="🚨" label="Urgent Alerts" value={stats.urgentAlerts??0} sub="Requires attention" />
        <StatCard icon="📚" label="Active Courses" value={stats.totalCourses??0} sub="Google Classroom" />
      </div>

      {/* Content */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* Announcements */}
        <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", border:"1px solid var(--gray-200)", padding:"24px", boxShadow:"var(--shadow-sm)" }}>
          <h3 style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>Recent Announcements</h3>
          <p style={{ fontSize:13, color:"var(--gray-400)", marginBottom:20 }}>Latest messages for you</p>

          {recentAnnouncements.length===0
            ? <div style={{ textAlign:"center", padding:"24px 0", color:"var(--gray-400)" }}><div style={{ fontSize:32, marginBottom:8 }}>📭</div><p>No recent announcements</p></div>
            : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {recentAnnouncements.map((ann,i) => {
                  const tag = tagStyle(ann.text);
                  const h = Math.floor((Date.now()-new Date(ann.updateTime).getTime())/3600000);
                  const ago = h<24?`${h} hrs ago`:`${Math.floor(h/24)} days ago`;
                  return (
                    <div key={ann.id||i} style={{ display:"flex", gap:12 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", marginTop:6, flexShrink:0, background:tag.dot }} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>{ann.text?.substring(0,80)}{ann.text?.length>80?"...":""}</div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          <span style={{ background:tag.bg, color:tag.color, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4 }}>{tag.label}</span>
                          <span style={{ fontSize:12, color:"var(--gray-400)" }}>{ann.courseName} · {ago}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
          <a href="/announcements" style={{ display:"inline-block", marginTop:20, color:"var(--green-700)", fontSize:13, fontWeight:500 }}>View all announcements →</a>
        </div>

        {/* Deadlines */}
        <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", border:"1px solid var(--gray-200)", padding:"24px", boxShadow:"var(--shadow-sm)" }}>
          <h3 style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>Upcoming Deadlines</h3>
          <p style={{ fontSize:13, color:"var(--gray-400)", marginBottom:20 }}>Don't miss these dates</p>

          {upcomingDeadlines.length===0
            ? <div style={{ textAlign:"center", padding:"24px 0", color:"var(--gray-400)" }}><div style={{ fontSize:32, marginBottom:8 }}>🎉</div><p>You're all caught up!</p></div>
            : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {upcomingDeadlines.map((d,i) => {
                  const date = new Date(d.dueDate);
                  const status = daysLeft(d.dueDate);
                  return (
                    <div key={d.courseWorkId||i} style={{ display:"flex", gap:14, alignItems:"center" }}>
                      <div style={{ width:44, textAlign:"center", flexShrink:0, background:"var(--green-50)", borderRadius:"var(--radius-md)", padding:"6px 4px" }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"var(--green-700)" }}>{date.toLocaleDateString("en-PH",{month:"short"}).toUpperCase()}</div>
                        <div style={{ fontSize:20, fontWeight:800, color:"var(--green-900)", lineHeight:1.1 }}>{date.getDate()}</div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>{d.title}</div>
                        <div style={{ fontSize:12, color:"var(--gray-400)" }}>{d.courseName}</div>
                      </div>
                      <span style={{ background:status.bg, color:status.color, fontSize:11, fontWeight:700, borderRadius:6, padding:"3px 8px", flexShrink:0 }}>{status.label}</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
