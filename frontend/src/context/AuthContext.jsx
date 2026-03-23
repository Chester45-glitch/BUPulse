import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { openAuthUrl } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

const isCapacitor = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

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

  // ── Deep link listener ────────────────────────────────────────────
  useEffect(() => {
    if (!isCapacitor()) return;

    let appHandle;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");

        appHandle = await App.addListener("appUrlOpen", async (data) => {
          const url = data.url || "";
          console.log("appUrlOpen fired:", url);

          if (!url.includes("auth/callback")) return;

          // Extract token from deep link
          const parts = url.split("?");
          const params = new URLSearchParams(parts[1] || "");
          const token = params.get("token");

          if (token) {
            console.log("Token received, logging in...");
            localStorage.setItem("bupulse_token", token);

            // Close the in-app browser FIRST
            try { await Browser.close(); } catch {}

            // Then fetch user — this triggers re-render and navigation
            await fetchUser();
          }
        });
      } catch (e) {
        console.warn("Deep link listener error:", e);
      }
    })();

    return () => { appHandle?.remove?.(); };
  }, [fetchUser]);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    const url = isCapacitor()
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
