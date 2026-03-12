import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) { setToken(token); navigate("/dashboard", { replace:true }); }
    else navigate("/", { replace:true });
  }, []);

  return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--green-900)", flexDirection:"column", gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.2)", borderTopColor:"var(--accent-gold)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ color:"var(--green-200)" }}>Signing you in...</p>
    </div>
  );
}
