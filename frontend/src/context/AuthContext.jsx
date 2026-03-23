import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { openAuthUrl } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

const isCapacitor = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

const makeCode = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loginCodeRef = useRef(null);
  const checkingRef = useRef(false);

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

  const checkForToken = useCallback(async () => {
    // Prevent concurrent checks
    if (checkingRef.current) return;
    checkingRef.current = true;

    const code = loginCodeRef.current;
    if (!code) { checkingRef.current = false; return; }

    const apiBase = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${apiBase}/api/auth/poll?code=${code}`);
      const data = await res.json();
      if (data.ready && data.token) {
        loginCodeRef.current = null;
        localStorage.setItem("bupulse_token", data.token);
        await fetchUser();
      }
    } catch (e) {
      console.warn("Poll failed:", e);
    } finally {
      checkingRef.current = false;
    }
  }, [fetchUser]);

  // Use visibilitychange — most reliable cross-platform event
  // Fires when Chrome Custom Tab closes and WebView becomes visible again
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        checkForToken();
      }
    };
    const handleFocus = () => checkForToken();

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkForToken]);

  // Also use Capacitor events as backup
  useEffect(() => {
    if (!isCapacitor()) return;
    let appHandle, browserHandle;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");
        browserHandle = await Browser.addListener("browserFinished", checkForToken);
        appHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) checkForToken();
        });
      } catch {}
    })();
    return () => { appHandle?.remove?.(); browserHandle?.remove?.(); };
  }, [checkForToken]);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (isCapacitor()) {
      const loginCode = makeCode();
      loginCodeRef.current = loginCode;
      await openAuthUrl(`${apiBase}/api/auth/google?role=${role}&platform=android&code=${loginCode}`);
    } else {
      window.location.href = `${apiBase}/api/auth/google?role=${role}`;
    }
  };

  const logout = async () => {
    loginCodeRef.current = null;
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
