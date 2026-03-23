import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { openAuthUrl, closeAuthBrowser } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

const isCapacitor = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

const makeCode = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("bupulse_token");
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      localStorage.removeItem("bupulse_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((loginCode) => {
    stopPolling();
    const apiBase = import.meta.env.VITE_API_URL || "";
    let attempts = 0;

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 150) { stopPolling(); return; }

      try {
        const res = await fetch(`${apiBase}/api/auth/poll?code=${loginCode}`);
        const data = await res.json();

        if (data.ready && data.token) {
          stopPolling();

          // 1. Save token
          localStorage.setItem("bupulse_token", data.token);

          // 2. Close browser first
          await closeAuthBrowser();

          // 3. Small delay to let browser fully close
          await new Promise(r => setTimeout(r, 500));

          // 4. Fetch user — triggers re-render → App.jsx redirects to dashboard
          const userRes = await api.get("/auth/me");
          setUser(userRes.data.user);
          setLoading(false);
        }
      } catch {}
    }, 2000);
  }, [stopPolling]);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (isCapacitor()) {
      const loginCode = makeCode();
      startPolling(loginCode);
      await openAuthUrl(`${apiBase}/api/auth/google?role=${role}&platform=android&code=${loginCode}`);
    } else {
      window.location.href = `${apiBase}/api/auth/google?role=${role}`;
    }
  };

  const logout = async () => {
    stopPolling();
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("bupulse_token");
    setUser(null);
  };

  const setToken = (token) => {
    localStorage.setItem("bupulse_token", token);
    fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
