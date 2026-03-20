import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { setToken, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    // setToken stores the token and triggers fetchUser in AuthContext.
    // We wait briefly for the user object to be populated, then redirect
    // based on their role so professors/parents land on the right dashboard.
    setToken(token);
  }, []);

  // Watch for user to be loaded after token is set
  useEffect(() => {
    if (!user) return;
    if (user.role === "professor") navigate("/professor", { replace: true });
    else if (user.role === "parent")    navigate("/parent",    { replace: true });
    else                                navigate("/dashboard", { replace: true });
  }, [user]);

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--green-900)", flexDirection: "column", gap: 16,
    }}>
      <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent-gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "var(--green-200)", fontSize: 14 }}>Signing you in…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
