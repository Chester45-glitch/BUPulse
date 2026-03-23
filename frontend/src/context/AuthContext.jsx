import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { openAuthUrl, closeAuthBrowser } from "../utils/capacitorUtils";

const AuthContext = createContext(null);

const isCapacitor = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

// Generate random login code
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

  // Stop polling helper
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Start polling backend for token after opening browser
  const startPolling = useCallback((loginCode) => {
    stopPolling();
    const apiBase = import.meta.env.VITE_API_URL || "";
    let attempts = 0;
    const maxAttempts = 150; // poll for up to 5 minutes

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/auth/poll?code=${loginCode}`);
        const data = await res.json();
        if (data.ready && data.token) {
          stopPolling();
          localStorage.setItem("bupulse_token", data.token);
          // Close the in-app browser
          await closeAuthBrowser();
          // Fetch user and update state
          await fetchUser();
        }
      } catch {}
    }, 2000); // every 2 seconds
  }, [fetchUser]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  const login = async (role = "student") => {
    const apiBase = import.meta.env.VITE_API_URL || "";

    if (isCapacitor()) {
      // Generate unique code for this login attempt
      const loginCode = makeCode();
      const url = `${apiBase}/api/auth/google?role=${role}&platform=android&code=${loginCode}`;
      // Start polling BEFORE opening browser
      startPolling(loginCode);
      await openAuthUrl(url);
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
