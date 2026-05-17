import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const [params]              = useSearchParams();
  const { setToken, user }    = useAuth();
  const navigate              = useNavigate();
  const [errMsg, setErrMsg]   = useState("");
  const calledRef             = useRef(false);    // prevent double-call in StrictMode

  // ── Step 1: Process the token from the URL ───────────────────────
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = params.get("token");
    const error = params.get("error");

    // Backend sent an error
    if (error) {
      setErrMsg(
        error === "account_deleted"
          ? "This account has been deleted."
          : "Sign-in failed. Please try again."
      );
      setTimeout(() => navigate("/", { replace: true }), 3000);
      return;
    }

    // No token at all
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    // Store token — this triggers fetchUser(true) in AuthContext
    setToken(token);

    // Safety net: if user isn't set within 15 seconds (Render cold start,
    // network error, etc.), redirect back to login with a friendly message.
    const timeout = setTimeout(() => {
      console.warn("[AuthCallback] Timed out waiting for user — redirecting to login");
      navigate("/?error=timeout", { replace: true });
    }, 15000);

    // Cleanup timeout when component unmounts (navigation happened)
    return () => clearTimeout(timeout);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: Navigate once user is loaded ────────────────────────
  useEffect(() => {
    if (!user) return;
    if      (user.role === "professor") navigate("/professor", { replace: true });
    else if (user.role === "parent")    navigate("/parent",    { replace: true });
    else                                navigate("/dashboard", { replace: true });
  }, [user]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Error screen ─────────────────────────────────────────────────
  if (errMsg) {
    return (
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"var(--bg-primary, #f5f7f5)", flexDirection:"column", gap:12, padding:24 }}>
        <div style={{ fontSize:36 }}>⚠️</div>
        <p style={{ fontSize:15, fontWeight:600, color:"var(--text-primary, #111)" }}>{errMsg}</p>
        <p style={{ fontSize:13, color:"var(--text-muted, #6b7280)" }}>Redirecting you back…</p>
      </div>
    );
  }

  // ── Loading screen ───────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"#0f1f0f", flexDirection:"column", gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.15)",
        borderTopColor:"#4ade80", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ color:"rgba(255,255,255,0.6)", fontSize:14, fontWeight:500 }}>
        Signing you in…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
