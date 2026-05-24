/**
 * services/aiRotation.js
 * ══════════════════════════════════════════════════════════════════
 * Shared AI key/model rotation helpers for Groq and Gemini.
 *
 * HOW TO ADD KEYS
 *   Set these environment variables in Render (or .env locally):
 *
 *   Groq  (free-tier accounts — one key per account)
 *     GROQ_API_KEY_1   or  GROQ_API_KEY   ← legacy alias
 *     GROQ_API_KEY_2
 *     GROQ_API_KEY_3
 *
 *   Gemini  (free-tier Google AI Studio keys — one key per Google account)
 *     GEMINI_API_KEY_1   or  GEMINI_API_KEY / GOOGLE_AI_KEY   ← legacy aliases
 *     GEMINI_API_KEY_2
 *     GEMINI_API_KEY_3
 *     GEMINI_API_KEY_4
 *     GEMINI_API_KEY_5
 *
 * ROTATION LOGIC
 *   Groq  : key 1 → 2 → 3   (rotates on 429 / 401 / 403 / quota errors)
 *   Gemini: key 1 → 2 → … for each key, tries every model in
 *           GEMINI_MODELS until one succeeds.  Model-not-found (404)
 *           moves to the next model on the same key; rate-limit error
 *           moves to the next key entirely.
 * ══════════════════════════════════════════════════════════════════
 */

const Groq                = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Key pools ────────────────────────────────────────────────────
const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean);

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);

// ── Gemini model priority list ───────────────────────────────────
// Ordered best → fastest → most-available.
// Text-only models that are free-tier (RPD > 0) are included.
// Vision/multimodal models are listed first since most callers need image support.
const GEMINI_MODELS = [
  // Best multimodal — try newest first
  "gemini-2.5-flash",                    // Gemini 2.5 Flash (5 RPM free)
  "gemini-2.5-flash-preview-05-20",      // Latest 2.5 Flash preview
  "gemini-2.5-flash-preview-04-17",      // Older 2.5 Flash preview
  "gemini-2.5-flash-lite-preview-06-17", // 2.5 Flash Lite (10 RPM free)
  "gemini-2.0-flash",                    // Gemini 2 Flash
  "gemini-2.0-flash-lite",               // Gemini 2 Flash Lite
  // Next-gen text models (include vision too)
  "gemini-3.5-flash",                    // Gemini 3.5 Flash (5 RPM free)
  "gemini-3.1-flash-lite",               // Gemini 3.1 Flash Lite (15 RPM free)
  "gemini-3-flash",                      // Gemini 3 Flash (5 RPM free)
  // Fallback
  "gemini-1.5-flash-001",                // Stable GA fallback
  "gemini-1.5-flash",
];

// ── Error classifier ─────────────────────────────────────────────
const isRotatableError = (err) => {
  const msg    = (err?.message || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.error?.code || 0;
  return (
    status === 429 || status === 401 || status === 403 ||
    msg.includes("429") || msg.includes("rate limit") ||
    msg.includes("quota") || msg.includes("exceeded") ||
    msg.includes("resource has been exhausted") ||
    msg.includes("api key not valid") ||
    msg.includes("invalid api key") ||
    msg.includes("api_key_invalid") ||
    msg.includes("permission_denied")
  );
};

const isModelNotFound = (err) => {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.status === 404 ||
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("unknown model") ||
    msg.includes("model not found") ||
    msg.includes("is not supported")
  );
};

// ══════════════════════════════════════════════════════════════════
// groqChatWithRotation(messages, options?)
//   Wraps groq.chat.completions.create() with automatic key rotation.
//   options merges into the create() call (model, max_tokens, etc.).
// ══════════════════════════════════════════════════════════════════
const groqChatWithRotation = async (messages, options = {}) => {
  if (GROQ_KEYS.length === 0) throw new Error("No Groq API keys configured.");

  let lastErr;
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    try {
      const client = new Groq({ apiKey: GROQ_KEYS[i] });
      const result = await client.chat.completions.create({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  8000,
        temperature: 0.7,
        ...options,
        messages,
      });
      if (i > 0) console.log(`[AI] Groq key ${i + 1} succeeded`);
      return result;
    } catch (err) {
      lastErr = err;
      if (isRotatableError(err)) {
        console.warn(`[AI] Groq key ${i + 1} exhausted/invalid, rotating…`);
        continue;
      }
      throw err; // non-rotatable — bubble up immediately
    }
  }
  throw lastErr || new Error("All Groq keys exhausted.");
};

// ══════════════════════════════════════════════════════════════════
// geminiGenerateWithRotation(parts, modelFilter?)
//   Calls model.generateContent(parts) with key + model rotation.
//   modelFilter(modelName) → bool  lets callers restrict to vision-
//   capable models (all models in GEMINI_MODELS support vision).
//   Returns the response text string.
// ══════════════════════════════════════════════════════════════════
const geminiGenerateWithRotation = async (parts, modelFilter = null) => {
  if (GEMINI_KEYS.length === 0) throw new Error("No Gemini API keys configured.");

  const models = modelFilter ? GEMINI_MODELS.filter(modelFilter) : GEMINI_MODELS;
  if (models.length === 0) throw new Error("Model filter excluded all Gemini models.");

  let lastErr;

  for (let ki = 0; ki < GEMINI_KEYS.length; ki++) {
    const genAI = new GoogleGenerativeAI(GEMINI_KEYS[ki]);

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion: "v1beta" }
        );
        const result = await model.generateContent(parts);
        const text   = result.response.text() || "";
        if (ki > 0 || modelName !== models[0]) {
          console.log(`[AI] Gemini key ${ki + 1} / model ${modelName} succeeded`);
        }
        return text;
      } catch (err) {
        lastErr = err;

        if (isModelNotFound(err)) {
          // This model doesn't exist on this key's tier — try next model
          console.warn(`[AI] Gemini model ${modelName} not found, trying next model…`);
          continue;
        }

        if (isRotatableError(err)) {
          // Key quota hit — skip remaining models on this key, try next key
          console.warn(`[AI] Gemini key ${ki + 1} / model ${modelName} quota hit, rotating key…`);
          break; // breaks inner loop → next ki
        }

        // Unknown error — surface it
        throw err;
      }
    }
  }

  throw lastErr || new Error("All Gemini keys and models exhausted.");
};

// ══════════════════════════════════════════════════════════════════
// Convenience: build a Gemini client for a specific key index
// (useful if you need raw model object access)
// ══════════════════════════════════════════════════════════════════
const getGeminiClient = (keyIndex = 0) => {
  if (GEMINI_KEYS.length === 0) throw new Error("No Gemini API keys configured.");
  return new GoogleGenerativeAI(GEMINI_KEYS[keyIndex % GEMINI_KEYS.length]);
};

module.exports = {
  GROQ_KEYS,
  GEMINI_KEYS,
  GEMINI_MODELS,
  isRotatableError,
  isModelNotFound,
  groqChatWithRotation,
  geminiGenerateWithRotation,
  getGeminiClient,
};
