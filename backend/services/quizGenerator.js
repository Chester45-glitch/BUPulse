const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BATCH_SIZE = 25; // Max questions per Groq call (safe within 8000 token limit)

// ── Generate a single batch of questions ──────────────────────────
const generateBatch = async (text, count, startIndex, options) => {
  const { questionTypes = ["RADIO"], difficulty = "medium", topic = "" } = options;

  const hasMultipleChoice = questionTypes.includes("RADIO");
  const hasShortAnswer    = questionTypes.includes("SHORT_ANSWER");

  const typeInstruction = hasMultipleChoice && hasShortAnswer
    ? `Mix: ~70% multiple choice (type "RADIO"), ~30% short answer (type "SHORT_ANSWER").`
    : hasMultipleChoice
    ? `All multiple choice (type "RADIO") with exactly 4 options each.`
    : `All short answer (type "SHORT_ANSWER").`;

  const prompt = `You are creating quiz questions ${startIndex + 1}–${startIndex + count} (out of a larger set) based on this document.
${topic ? `Topic: ${topic}` : ""}
Difficulty: ${difficulty}
Generate exactly ${count} questions.
Types: ${typeInstruction}
${startIndex > 0 ? `Important: Do NOT repeat questions from the first ${startIndex} questions — cover DIFFERENT aspects of the content.` : ""}

DOCUMENT CONTENT:
${text}

Respond with ONLY a valid JSON array. No explanation, no markdown.

RADIO format: {"question":"...","type":"RADIO","options":["A","B","C","D"],"correct":0,"points":1}
SHORT_ANSWER format: {"question":"...","type":"SHORT_ANSWER","points":2}

Rules:
- Questions must come directly from the document
- All 4 options must be plausible
- Cover different sections of the document
- Output ONLY the JSON array.`;

  const result = await groq.chat.completions.create({
    model:       "llama-3.3-70b-versatile",
    messages:    [{ role: "user", content: prompt }],
    max_tokens:  8000,
    temperature: 0.6,
  });

  const raw = result.choices[0]?.message?.content?.trim() || "";
  const cleaned = raw
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  let questions;
  try {
    questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) throw new Error("Not an array");
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      questions = JSON.parse(arrMatch[0]);
    } else {
      throw new Error("Could not parse questions from AI response");
    }
  }

  return questions.slice(0, count).map((q, i) => ({
    question: String(q.question || `Question ${startIndex + i + 1}`),
    type:     q.type === "SHORT_ANSWER" ? "SHORT_ANSWER" : "RADIO",
    options:  Array.isArray(q.options) ? q.options.map(String) : undefined,
    correct:  typeof q.correct === "number" ? q.correct : 0,
    points:   typeof q.points  === "number" ? q.points  : 1,
  }));
};

// ── Generate questions in batches (handles any count up to ~100) ──
const generateQuestionsFromText = async (text, options = {}) => {
  const { questionCount = 10 } = options;
  const capped = Math.min(questionCount, 100); // hard cap at 100

  if (capped <= BATCH_SIZE) {
    // Single call — fast path
    return generateBatch(text, capped, 0, options);
  }

  // Multi-batch — split into chunks of BATCH_SIZE
  const batches = [];
  let remaining = capped;
  let startIndex = 0;

  while (remaining > 0) {
    const batchCount = Math.min(remaining, BATCH_SIZE);
    batches.push({ count: batchCount, startIndex });
    remaining  -= batchCount;
    startIndex += batchCount;
  }

  console.log(`Generating ${capped} questions in ${batches.length} batches of up to ${BATCH_SIZE}`);

  // Run batches sequentially to avoid rate limiting
  const allQuestions = [];
  for (const batch of batches) {
    const questions = await generateBatch(text, batch.count, batch.startIndex, options);
    allQuestions.push(...questions);
    // Small delay between batches to stay within Groq rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return allQuestions.slice(0, capped);
};

// ── Format questions for chat preview ─────────────────────────────
const formatQuestionsPreview = (questions) => {
  const letters = ["A", "B", "C", "D", "E"];
  // For large counts, show first 5 + summary
  const MAX_PREVIEW = 5;
  const preview = questions.slice(0, MAX_PREVIEW);
  const rest    = questions.length - MAX_PREVIEW;

  const lines = preview.map((q, i) => {
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

  if (rest > 0) {
    return lines + `\n\n... and ${rest} more question${rest !== 1 ? "s" : ""} (all generated)`;
  }
  return lines;
};

module.exports = { generateQuestionsFromText, formatQuestionsPreview };
