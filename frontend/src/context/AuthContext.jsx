import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { openAuthUrl } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

const isCapacitor = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

const makeCode = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const POLL_KEY = "bupulse_login_code";

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Poll backend for token — called on every app resume / visibility change
  const checkForToken = useCallback(async () => {
    const code = localStorage.getItem(POLL_KEY);
    if (!code) return;

    const apiBase = import.meta.env.VITE_API_URL || "";
    try {
      const res  = await fetch(`${apiBase}/api/auth/poll?code=${code}`);
      const data = await res.json();
      if (data.ready && data.token) {
        localStorage.removeItem(POLL_KEY);
        localStorage.setItem("bupulse_token", data.token);
        await fetchUser();
      }
    } catch {}
  }, [fetchUser]);

  // Poll every second for 30s after the component mounts or code is set
  // This runs independently of Capacitor events
  useEffect(() => {
    let interval = null;
    let count = 0;

    const tick = async () => {
      const code = localStorage.getItem(POLL_KEY);
      if (!code) { clearInterval(interval); return; }
      count++;
      if (count > 30) { clearInterval(interval); localStorage.removeItem(POLL_KEY); return; }
      await checkForToken();
    };

    interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [checkForToken]);

  // visibilitychange — works when Chrome Custom Tab closes
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") checkForToken();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [checkForToken]);

  // Capacitor events as backup
  useEffect(() => {
    if (!isCapacitor()) return;
    let h1, h2;
    (async () => {
      try {
        const { App }     = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");
        h1 = await Browser.addListener("browserFinished", checkForToken);
        h2 = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) checkForToken();
        });
      } catch {}
    })();
    return () => { h1?.remove?.(); h2?.remove?.(); };
  }, [checkForToken]);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (isCapacitor()) {
      const code = makeCode();
      localStorage.setItem(POLL_KEY, code);   // persist in localStorage!
      await openAuthUrl(`${apiBase}/api/auth/google?role=${role}&platform=android&code=${code}`);
    } else {
      window.location.href = `${apiBase}/api/auth/google?role=${role}`;
    }
  };

  const logout = async () => {
    localStorage.removeItem(POLL_KEY);
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
