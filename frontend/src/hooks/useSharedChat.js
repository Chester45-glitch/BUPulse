import { useState, useEffect, useCallback, useRef } from "react";
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
  // Remember last uploaded file so text-only follow-up messages can reference it
  const lastFileRef = useRef(null);

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
      // If this message has a file, remember it for follow-up messages
      if (driveFileId) {
        lastFileRef.current = { fileUrl, fileName, fileType, driveFileId };
      }
      // If no file in this message but there's a remembered file and quiz intent,
      // attach the remembered file automatically
      const hasQuizIntent = /quiz|form|question|generate|create.*from|based on|convert|make.*from|read.*file|use.*file|from.*file|from.*pdf|from.*ppt|from.*doc/i.test(text || "");
      const effectiveFileId   = driveFileId   || (hasQuizIntent && lastFileRef.current?.driveFileId) || undefined;
      const effectiveFileUrl  = fileUrl       || (hasQuizIntent && lastFileRef.current?.fileUrl)     || undefined;
      const effectiveFileName = fileName      || (hasQuizIntent && lastFileRef.current?.fileName)    || undefined;
      const effectiveFileType = fileType      || (hasQuizIntent && lastFileRef.current?.fileType)    || undefined;
      const trimmed = text?.trim();
      if (!trimmed && !fileUrl) return;
      if (loading) return;

      const userMsg = {
        role: "user",
        content: trimmed || `[Attached: ${effectiveFileName || fileName}]`,
        fileUrl:  effectiveFileUrl  || fileUrl,
        fileName: effectiveFileName || fileName,
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await api.post("/chatbot/message", {
          message: trimmed || userMsg.content,
          fileUrl:     effectiveFileUrl,
          fileName:    effectiveFileName,
          fileType:    effectiveFileType,
          driveFileId: effectiveFileId,
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
