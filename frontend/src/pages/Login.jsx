import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const features = [
  { icon:"📢", label:"Targeted Announcements" },
  { icon:"👨‍👩‍👧", label:"Parent Alerts" },
  { icon:"📅", label:"Student Deadlines" },
  { icon:"⚡", label:"Priority Messaging" },
];

export default function Login() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try { await login(); } catch { setLoading(false); }
  };

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"var(--font-body)" }}>

      {/* Left Panel */}
      <div style={{ flex:"0 0 52%", background:"var(--green-900)", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"36px 48px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, opacity:0.03, backgroundImage:"radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize:"40px 40px" }} />

        <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg, var(--accent-gold), var(--accent-amber))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📚</div>
          <span style={{ fontFamily:"var(--font-display)", fontSize:22, color:"var(--white)" }}>BUPulse</span>
        </div>

        <div style={{ position:"relative" }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:"clamp(36px,5vw,52px)", lineHeight:1.1, color:"var(--white)", marginBottom:24, letterSpacing:"-1px" }}>
            The right message,<br />
            to the <span style={{ color:"var(--accent-gold)" }}>right person</span>,<br />
            at the right time.
          </h1>
          <p style={{ color:"var(--green-200)", fontSize:15, lineHeight:1.7, maxWidth:380 }}>
            A smart school communication platform. Students see their deadlines. Parents get updates about their child. Nothing important gets missed.
          </p>
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", position:"relative" }}>
          {features.map(f => (
            <div key={f.label} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:99, padding:"7px 14px", color:"var(--green-100)", fontSize:13, fontWeight:500 }}>
              <span>{f.icon}</span>{f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex:1, background:"#f9faf7", display:"flex", alignItems:"center", justifyContent:"center", padding:"48px" }}>
        <div style={{ width:"100%", maxWidth:420, animation:"fadeIn 0.5s ease" }}>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:36, marginBottom:8, letterSpacing:"-0.5px" }}>Welcome back</h2>
          <p style={{ color:"var(--gray-500)", fontSize:15, marginBottom:36 }}>Sign in to your BUPulse account</p>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width:"100%", padding:"13px 20px", border:"1.5px solid var(--gray-200)", borderRadius:"var(--radius-md)", background:"var(--white)", color:"var(--gray-700)", fontSize:15, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", gap:12, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, boxShadow:"var(--shadow-sm)", transition:"all 0.2s" }}
          >
            {loading
              ? <div style={{ width:20, height:20, border:"2px solid var(--gray-300)", borderTopColor:"var(--green-700)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
              : <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            }
            {loading ? "Connecting..." : "Continue with Google (BU Email)"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:16, margin:"28px 0", color:"var(--gray-400)", fontSize:13 }}>
            <div style={{ flex:1, height:1, background:"var(--gray-200)" }} />or<div style={{ flex:1, height:1, background:"var(--gray-200)" }} />
          </div>

          <div style={{ background:"var(--green-50)", border:"1px solid var(--green-100)", borderRadius:"var(--radius-md)", padding:"16px 18px" }}>
            <p style={{ color:"var(--green-800)", fontSize:13, lineHeight:1.6 }}>
              <strong>🔒 Secure Sign-In</strong><br />
              Use your official school email (<code style={{ fontSize:12 }}>@bulsu.edu.ph</code>) to access BUPulse. No password needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
