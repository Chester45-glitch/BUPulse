import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── useSharedChat ─────────────────────────────────────────────────
// Single source of truth for chat state shared between
// FloatingChatbot and AskPulsBot page.
export function useSharedChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Greeting message based on role
  const greeting = (u) => ({
    role: "assistant",
    content: `Hi ${u?.name?.split(" ")[0] || "there"}! 👋 I'm PulsBot.\n\nAsk me anything about your ${
      u?.role === "professor"
        ? "classes and students. I can even post announcements for you!"
        : u?.role === "parent"
        ? "child's academic progress"
        : "assignments, deadlines, and class announcements"
    }`,
  });

  // Load history from Supabase once on mount
  useEffect(() => {
    if (!user || historyLoaded) return;

    api.get("/chatbot/history")
      .then((r) => {
        const hist = r.data.history || [];
        setMessages(
          hist.length > 0
            ? hist.map((m) => ({
                role: m.role,
                content: m.content,
                fileUrl: m.file_url,
                fileName: m.file_name,
                id: m.id,
              }))
            : [greeting(user)]
        );
      })
      .catch(() => setMessages([greeting(user)]))
      .finally(() => setHistoryLoaded(true));
  }, [user]); // only depends on user, not historyLoaded — avoids double-fetch

  const send = useCallback(
    async ({ text, fileUrl, fileName, fileType, driveFileId } = {}) => {
      const trimmed = text?.trim();
      if (!trimmed && !fileUrl) return;
      if (loading) return;

      const userMsg = {
        role: "user",
        content: trimmed || `[Attached: ${fileName}]`,
        fileUrl,
        fileName,
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await api.post("/chatbot/message", {
          message: trimmed || userMsg.content,
          fileUrl,
          fileName,
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.data.message }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again! 😅" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  const clearChat = useCallback(async () => {
    try { await api.delete("/chatbot/history"); } catch {}
    // Reset to greeting — don't touch historyLoaded so no refetch triggers
    setMessages(user ? [greeting(user)] : []);
  }, [user]);

  return { messages, loading, send, clearChat, historyLoaded };
}
