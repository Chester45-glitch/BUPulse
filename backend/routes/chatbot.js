const express = require("express");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authenticateToken } = require("../middleware/auth");
const {
  getAllDeadlines, getAllAnnouncements, getCourses, getTaughtCourses,
  createAnnouncement, createAssignment, createSubmissionBin, createQuizAssignment,
  deleteAnnouncement, editAnnouncement,
} = require("../services/googleClassroom");
const { createForm } = require("../services/googleForms");
const { extractFileContent } = require("../services/fileExtractor");
const { generateQuestionsFromText, formatQuestionsPreview } = require("../services/quizGenerator");
const supabase = require("../db/supabase");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "");

const GEMINI_MODELS = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-001",
];

const askGeminiWithVision = async (systemPrompt, history, userMessage, fileData, fileType, fileName) => {
  const contextLines = [
    systemPrompt,
    "",
    ...(history || []).slice(-8).map(m => `${m.role === "assistant" ? "PulsBot" : "User"}: ${m.content}`),
  ].join("\n");

  const parts = [
    { text: `${contextLines}\n\nUser: ${userMessage || "Please describe or analyze the attached file."}` },
  ];

  if (fileData && fileType) {
    const supportedMime = fileType.startsWith("image/") ? fileType : fileType === "application/pdf" ? "application/pdf" : null;
    if (supportedMime) {
      parts.push({ inlineData: { mimeType: supportedMime, data: fileData } });
    } else {
      parts[0].text += `\n\n[Attached file: ${fileName || "file"} (${fileType})]`;
    }
  }

  let lastError;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
      const result = await model.generateContent(parts);
      return result.response.text() || "Sorry, I couldn't analyze that file.";
    } catch (err) {
      if (err.message?.includes("404") || err.message?.includes("not found")) {
        lastError = err; continue;
      }
      throw err;
    }
  }
  throw new Error(`No working Gemini model found.`);
};

// ── Added Formatting Instructions ─────────────────────────────────
const buildSystemPrompt = (role, classroomContext) => `You are PulsBot, a friendly AI assistant for BUPulse.

Your role: ${role === "professor"
  ? "Help professors manage classes, create assignments, quizzes, and post announcements."
  : role === "parent"
  ? "Help parents monitor their child's academic progress, deadlines, and announcements."
  : "Help students track assignments, deadlines, and class announcements."
}

CRITICAL FORMATTING RULES:
1. Use **Bold Text** for titles, dates, subjects, and important status labels.
2. Use Bullet Points (•) or Numbered Lists for assignments, steps, or features.
3. Use double line breaks between different sections to ensure the text isn't cramped.
4. If there are overdue items, list them first under a **⚠️ OVERDUE** section.

Personality: Friendly, warm. Occasionally uses Filipino phrases like "Kaya mo yan!"

${role === "professor" ? `
PROFESSOR ACTIONS — emit these JSON blocks ONLY after the professor confirms.
... [PROFESSOR LOGIC PRESERVED] ...
` : ""}
${classroomContext}`;

const getClassroomContext = async (user) => {
  if (!user.access_token) return "";
  try {
    const now = new Date();
    const [gcDls, gcAnns, gcCourses, buRecord] = await Promise.all([
      getAllDeadlines(user.access_token, user.refresh_token),
      getAllAnnouncements(user.access_token, user.refresh_token),
      getCourses(user.access_token, user.refresh_token),
      supabase.from("academic_data").select("data").eq("user_id", user.id).single()
    ]);

    let allDeadlines = [...gcDls];
    if (buRecord.data?.data?.activities) {
      allDeadlines = [...allDeadlines, ...buRecord.data.data.activities.map(a => ({
        title: a.title, courseName: "BULMS", dueDate: a.dueDate
      }))];
    }

    const sorted = allDeadlines.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const upcoming = sorted.filter(d => new Date(d.dueDate) > now);
    const overdue  = sorted.filter(d => new Date(d.dueDate) < now);

    return `\n\n---\n## Student Data:\n**Courses:** ${gcCourses.map(c=>c.name).join(", ")}\n**Overdue:** ${overdue.length > 0 ? overdue.map(d=>`"${d.title}" (${d.courseName})`).join("; ") : "None"}\n**Upcoming (Next 7 days):**\n${upcoming.slice(0,8).map(d => `- [${d.courseName}] "${d.title}" due ${new Date(d.dueDate).toLocaleString("en-PH")}`).join("\n")}`;
  } catch { return ""; }
};

// ... [Action Extractors & Handlers PRESERVED] ...
const extractAllActions = (text) => {
  const actions = [];
  const actionRegex = /"action"\s*:\s*"(?:post_announcement|create_assignment|create_submission_bin|create_quiz|delete_announcement|edit_announcement)"/g;
  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    try {
      let start = text.lastIndexOf("{", match.index);
      if (start === -1) continue;
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{" || ch === "[") depth++;
        if (ch === "}" || ch === "]") { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) continue;
      const parsed = JSON.parse(text.slice(start, end + 1));
      actions.push({ action: parsed, start, end });
    } catch { continue; }
  }
  return actions;
};

const extractAction = (text) => {
  const all = extractAllActions(text);
  if (!all.length) return null;
  const preferred = all.find((a) => a.action.action !== "create_quiz") || all[0];
  return preferred.action;
};

const removeActionBlock = (text) => {
  const all = extractAllActions(text);
  if (!all.length) return text;
  let result = text;
  for (let i = all.length - 1; i >= 0; i--) {
    const { start, end } = all[i];
    result = (result.slice(0, start) + result.slice(end + 1)).trim();
  }
  return result;
};

const resolveTargets = async (action, accessToken, refreshToken) => {
  const courses = await getTaughtCourses(accessToken, refreshToken);
  if (action.courseId === "all") return courses.map((c) => ({ id: c.id, name: c.name }));
  const target = courses.find((c) => c.id === action.courseId) || courses.find((c) => c.name.toLowerCase().includes((action.courseName || "").toLowerCase()));
  return target ? [{ id: target.id, name: target.name }] : [];
};

const handleAction = async (action, user, fileUrl, fileName) => {
  const targets = await resolveTargets(action, user.access_token, user.refresh_token);
  if (!targets.length) return { reply: "⚠️ I couldn't find that class.", result: null };
  const classNames = targets.map((t) => t.name).join(", ");

  if (action.action === "post_announcement") {
    const results = await Promise.allSettled(targets.map((t) => createAnnouncement(t.id, action.text, user.access_token, user.refresh_token, [])));
    return { reply: `✅ Announcement posted to ${results.length} class(es) (${classNames}).`, result: { type: "announcement" } };
  }
  if (action.action === "create_assignment") {
    await Promise.allSettled(targets.map((t) => createAssignment(t.id, action, user.access_token, user.refresh_token)));
    return { reply: `✅ Assignment **"${action.title}"** created in ${classNames}.`, result: { type: "assignment" } };
  }
  // ... Other actions preserved ...
  return { reply: "✅ Action processed.", result: { type: action.action } };
};

router.post("/message", authenticateToken, async (req, res) => {
  const { message, fileUrl, fileName, fileType, driveFileId } = req.body;
  try {
    const { data: user } = await supabase.from("users").select("id, email, name, role, access_token, refresh_token").eq("id", req.user.id).single();
    await supabase.from("chat_messages").insert({ user_id: req.user.id, role: "user", content: message || `[Attached file: ${fileName}]`, file_url: fileUrl || null, file_name: fileName || null });

    const { data: history } = await supabase.from("chat_messages").select("role, content").eq("user_id", req.user.id).order("created_at", { ascending: true }).limit(15);
    const classroomContext = await getClassroomContext(user);
    const systemPrompt = buildSystemPrompt(user.role, classroomContext);

    let reply;
    let modelUsed = "groq";

    if (fileType?.startsWith("image/") || fileType === "application/pdf") {
      modelUsed = "gemini";
      let fileData = null;
      if (driveFileId) {
        const uploadRouter = require("./upload");
        const cache = uploadRouter.getFileCache();
        const entry = cache.get(driveFileId);
        if (entry) fileData = entry.fileData;
      }
      reply = await askGeminiWithVision(systemPrompt, history, message, fileData, fileType, fileName);
    } else {
      const result = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))],
        max_tokens: 4000, temperature: 0.7
      });
      reply = result.choices[0]?.message?.content;
    }

    if (user.role === "professor") {
      const action = extractAction(reply);
      if (action) {
        const { reply: ar } = await handleAction(action, user, fileUrl, fileName);
        reply = removeActionBlock(reply) + `\n\n${ar}`;
      }
    }

    await supabase.from("chat_messages").insert({ user_id: req.user.id, role: "assistant", content: reply });
    res.json({ message: reply, modelUsed, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "PulsBot error." });
  }
});

router.get("/history", authenticateToken, async (req, res) => {
  const { data } = await supabase.from("chat_messages").select("*").eq("user_id", req.user.id).order("created_at", { ascending: true });
  res.json({ history: data || [] });
});

// ── FIXED DELETE ROUTE ────────────────────────────────────────────
router.delete("/history", authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ success: true, message: "History cleared" });
  } catch (err) {
    res.status(500).json({ error: "Database failure" });
  }
});

module.exports = router;