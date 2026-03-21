const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Generate quiz questions from extracted text using Groq ─────────
const generateQuestionsFromText = async (text, options = {}) => {
  const {
    questionCount = 10,
    questionTypes = ["RADIO"],
    difficulty    = "medium",
    topic         = "",
  } = options;

  const hasMultipleChoice = questionTypes.includes("RADIO");
  const hasShortAnswer    = questionTypes.includes("SHORT_ANSWER");

  const typeInstruction = hasMultipleChoice && hasShortAnswer
    ? `Mix: ~70% multiple choice (type "RADIO"), ~30% short answer (type "SHORT_ANSWER").`
    : hasMultipleChoice
    ? `All multiple choice (type "RADIO") with exactly 4 options each.`
    : `All short answer (type "SHORT_ANSWER").`;

  const prompt = `You are creating a quiz based on this document content.
${topic ? `Topic: ${topic}` : ""}
Difficulty: ${difficulty}
Number of questions: ${questionCount}
Types: ${typeInstruction}

DOCUMENT CONTENT:
${text}

Generate exactly ${questionCount} quiz questions based ONLY on the content above.
Respond with ONLY a valid JSON array. No explanation, no markdown, no extra text.

RADIO format:
{"question":"...","type":"RADIO","options":["A","B","C","D"],"correct":0,"points":1}
(correct = 0-based index of correct answer)

SHORT_ANSWER format:
{"question":"...","type":"SHORT_ANSWER","points":2}

Rules:
- Questions must come directly from the document
- All 4 options must be plausible (no obviously wrong answers)
- Cover different parts of the document
- Output ONLY the JSON array, nothing else.`;

  const result = await groq.chat.completions.create({
    model:       "llama-3.3-70b-versatile",
    messages:    [{ role: "user", content: prompt }],
    max_tokens:  4000,
    temperature: 0.5,
  });

  const raw = result.choices[0]?.message?.content?.trim() || "";

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let questions;
  try {
    questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) throw new Error("Not an array");
  } catch (e) {
    // Try to extract just the array portion if there's surrounding text
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      questions = JSON.parse(arrMatch[0]);
    } else {
      throw new Error(`Could not parse questions from AI response: ${e.message}`);
    }
  }

  // Validate and sanitize
  return questions.slice(0, questionCount).map((q, i) => ({
    question: String(q.question || `Question ${i + 1}`),
    type:     q.type === "SHORT_ANSWER" ? "SHORT_ANSWER" : "RADIO",
    options:  Array.isArray(q.options) ? q.options.map(String) : undefined,
    correct:  typeof q.correct === "number" ? q.correct : 0,
    points:   typeof q.points  === "number" ? q.points  : 1,
  }));
};

// ── Format questions for chat preview ─────────────────────────────
const formatQuestionsPreview = (questions) => {
  const letters = ["A", "B", "C", "D", "E"];
  return questions.map((q, i) => {
    let line = `${i + 1}. ${q.question}`;
    if (q.type === "RADIO" && q.options) {
      line += "\n" + q.options.map((opt, j) => {
        const marker = j === q.correct ? "✓" : " ";
        return `   ${marker} ${letters[j]}) ${opt}`;
      }).join("\n");
    } else {
      line += "\n   (Short answer)";
    }
    return line;
  }).join("\n\n");
};

module.exports = { generateQuestionsFromText, formatQuestionsPreview };
