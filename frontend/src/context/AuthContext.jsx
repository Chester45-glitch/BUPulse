import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { openAuthUrl, closeAuthBrowser } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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

  // ── Capacitor deep-link listener ─────────────────────────────────
  // Fires when Android intercepts edu.bicol.bupulse://auth/callback?token=xxx
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.Capacitor === "undefined") return;

    let appHandle, browserHandle;

    (async () => {
      try {
        // Listen for deep link (app URL open)
        const { App } = await import("@capacitor/app");
        appHandle = await App.addListener("appUrlOpen", async (data) => {
          const url = data.url || "";
          if (!url.includes("auth/callback")) return;

          const params = new URLSearchParams(url.split("?")[1] || "");
          const token = params.get("token");
          if (token) {
            // Close the Chrome Custom Tab first
            await closeAuthBrowser();
            localStorage.setItem("bupulse_token", token);
            fetchUser();
          }
        });

        // Also listen for browser finish (fallback)
        const { Browser } = await import("@capacitor/browser");
        browserHandle = await Browser.addListener("browserFinished", () => {
          // If browser closed, re-check if token was saved
          const token = localStorage.getItem("bupulse_token");
          if (token && !user) fetchUser();
        });
      } catch (e) {
        console.warn("Capacitor listener setup failed:", e);
      }
    })();

    return () => {
      appHandle?.remove?.();
      browserHandle?.remove?.();
    };
  }, [fetchUser]);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    const isCapacitor = typeof window !== "undefined" && typeof window.Capacitor !== "undefined";
    const url = isCapacitor
      ? `${apiBase}/api/auth/google?role=${role}&platform=android`
      : `${apiBase}/api/auth/google?role=${role}`;
    await openAuthUrl(url);
  };

  const logout = async () => {
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
