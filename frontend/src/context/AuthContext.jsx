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

  // Always read token from localStorage and fetch user
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

  // Called when app comes back to foreground — ALWAYS re-fetch user from localStorage
  const onAppResume = useCallback(async () => {
    // If token already in storage but user state is null, restore session
    const token = localStorage.getItem("bupulse_token");
    if (token && !user) {
      await fetchUser();
      return;
    }

    // Otherwise check if there's a pending login to complete
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
  }, [fetchUser, user]);

  // visibilitychange — fires when Chrome Custom Tab closes and app is visible again
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") onAppResume();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [onAppResume]);

  // Capacitor events
  useEffect(() => {
    if (!isCapacitor()) return;
    let h1, h2;
    (async () => {
      try {
        const { App }     = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");
        h1 = await Browser.addListener("browserFinished", onAppResume);
        h2 = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) onAppResume();
        });
      } catch {}
    })();
    return () => { h1?.remove?.(); h2?.remove?.(); };
  }, [onAppResume]);

  // Background poll while login code exists
  useEffect(() => {
    let count = 0;
    const interval = setInterval(async () => {
      const code = localStorage.getItem(POLL_KEY);
      if (!code) { clearInterval(interval); return; }
      count++;
      if (count > 150) { clearInterval(interval); localStorage.removeItem(POLL_KEY); return; }

      const apiBase = import.meta.env.VITE_API_URL || "";
      try {
        const res  = await fetch(`${apiBase}/api/auth/poll?code=${code}`);
        const data = await res.json();
        if (data.ready && data.token) {
          clearInterval(interval);
          localStorage.removeItem(POLL_KEY);
          localStorage.setItem("bupulse_token", data.token);
          // Token saved — onAppResume will pick it up when browser closes
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (isCapacitor()) {
      const code = makeCode();
      localStorage.setItem(POLL_KEY, code);
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
