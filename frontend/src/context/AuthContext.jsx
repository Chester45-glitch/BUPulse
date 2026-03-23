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

  // Check backend for token using loginCode
  const checkForToken = useCallback(async () => {
    const code = loginCodeRef.current;
    if (!code) return;
    const apiBase = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${apiBase}/api/auth/poll?code=${code}`);
      const data = await res.json();
      if (data.ready && data.token) {
        loginCodeRef.current = null;
        localStorage.setItem("bupulse_token", data.token);
        // Directly set user from the token response
        const userRes = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` }
        });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn("Poll check failed:", e);
    }
  }, []);

  // Listen for app coming back to foreground AND browser closing
  useEffect(() => {
    if (!isCapacitor()) return;

    let appHandle, browserHandle;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");

        // Fires when Chrome Custom Tab is closed (user taps back or it auto-closes)
        browserHandle = await Browser.addListener("browserFinished", async () => {
          console.log("Browser closed — checking for token...");
          await checkForToken();
        });

        // Fires when app comes back to foreground from any reason
        appHandle = await App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            console.log("App active — checking for token...");
            await checkForToken();
          }
        });
      } catch (e) {
        console.warn("Listener setup failed:", e);
      }
    })();

    return () => {
      appHandle?.remove?.();
      browserHandle?.remove?.();
    };
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
