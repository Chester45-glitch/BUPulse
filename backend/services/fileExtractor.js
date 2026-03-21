const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "");

// ── Lazy-load optional parsers ─────────────────────────────────────
let pdfParse     = null;
let mammoth      = null;
let officeParser = null;

try { pdfParse     = require("pdf-parse");    } catch {}
try { mammoth      = require("mammoth");      } catch {}
try { officeParser = require("officeparser"); } catch {}

// ── Gemini Vision — reads images and scanned PDFs ─────────────────
const extractWithGemini = async (base64Data, mimeType, hint = "") => {
  if (!genAI._options?.apiKey && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Add it to your Render environment variables.");
  }

  const model = genAI.getGenerativeModel(
    { model: "gemini-1.5-flash" },
    { apiVersion: "v1" }
  );

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
        data: base64Data,
      },
    },
    `Extract ALL readable text from this ${hint || "file"} exactly as it appears. Include every heading, paragraph, bullet point, table cell, caption, and label. Do not summarize — output the complete raw text content only.`,
  ]);

  return result.response.text() || "";
};

// ── PDF extraction ─────────────────────────────────────────────────
const extractFromPdf = async (base64Data) => {
  const buffer = Buffer.from(base64Data, "base64");

  // Try text extraction first (fast, works for text-based PDFs)
  if (pdfParse) {
    try {
      const data = await pdfParse(buffer);
      const text = data.text?.trim();
      if (text && text.length > 100) {
        console.log(`PDF: extracted ${text.length} chars via pdf-parse (text-based)`);
        return { text, method: "text", pages: data.numpages };
      }
    } catch (e) {
      console.warn("pdf-parse failed, trying Gemini vision:", e.message);
    }
  }

  // Fallback: Gemini Vision for scanned/image-based PDFs
  console.log("PDF: using Gemini Vision (scanned or image-based PDF)");
  try {
    // Send as image/jpeg — Gemini handles PDF bytes well this way
    const text = await extractWithGemini(base64Data, "application/pdf", "PDF document");
    return { text, method: "vision-gemini" };
  } catch (e) {
    throw new Error(`Could not read PDF: ${e.message}. Make sure GEMINI_API_KEY is set in Render.`);
  }
};

// ── PPTX/PPT extraction ────────────────────────────────────────────
const extractFromPptx = async (base64Data, fileName) => {
  const buffer = Buffer.from(base64Data, "base64");

  if (officeParser) {
    try {
      const text = await officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false });
      if (text?.trim()) {
        console.log(`PPTX: extracted ${text.length} chars via officeparser`);
        return { text: text.trim(), method: "text" };
      }
    } catch (e) {
      console.warn("officeparser failed:", e.message);
    }
  }

  // Fallback: ask Gemini to read the PPTX as an image
  console.log("PPTX: using Gemini Vision fallback");
  try {
    const text = await extractWithGemini(base64Data, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "PowerPoint file");
    return { text, method: "vision-gemini" };
  } catch {
    throw new Error(`Could not read PowerPoint file. Try installing officeparser: npm install officeparser`);
  }
};

// ── DOCX extraction ────────────────────────────────────────────────
const extractFromDocx = async (base64Data) => {
  const buffer = Buffer.from(base64Data, "base64");

  if (mammoth) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value?.trim()) {
        console.log(`DOCX: extracted ${result.value.length} chars via mammoth`);
        return { text: result.value.trim(), method: "text" };
      }
    } catch (e) {
      console.warn("mammoth failed:", e.message);
    }
  }

  throw new Error("Could not read Word document. Try installing mammoth: npm install mammoth");
};

// ── Image extraction (JPG, PNG, WEBP, GIF) ────────────────────────
const extractFromImage = async (base64Data, mimeType) => {
  console.log(`Image: using Gemini Vision for ${mimeType}`);
  try {
    const text = await extractWithGemini(base64Data, mimeType, "image");
    if (!text?.trim()) {
      return { text: "[No readable text found in image]", method: "vision-gemini" };
    }
    return { text, method: "vision-gemini" };
  } catch (e) {
    throw new Error(`Could not read image: ${e.message}`);
  }
};

// ── Main dispatcher ────────────────────────────────────────────────
// fileData: base64 string
// fileType: MIME type
// fileName: original file name
// Returns: { text, method, truncated, originalLength }
const extractFileContent = async (fileData, fileType, fileName) => {
  if (!fileData) throw new Error("No file data provided.");

  const type = (fileType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  let result;

  if (type === "application/pdf") {
    result = await extractFromPdf(fileData);
  } else if (
    type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    type === "application/vnd.ms-powerpoint" ||
    name.endsWith(".pptx") || name.endsWith(".ppt")
  ) {
    result = await extractFromPptx(fileData, fileName);
  } else if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    name.endsWith(".docx") || name.endsWith(".doc")
  ) {
    result = await extractFromDocx(fileData);
  } else if (type.startsWith("image/")) {
    result = await extractFromImage(fileData, type);
  } else {
    throw new Error(`Unsupported file type: ${fileType}. Supported: PDF, PPTX, DOCX, JPG, PNG, WEBP.`);
  }

  if (!result.text?.trim()) {
    throw new Error("Could not extract readable text from this file.");
  }

  // Truncate to ~12000 chars to fit in Groq context window safely
  const MAX_CHARS = 12000;
  const truncated = result.text.length > MAX_CHARS;
  const text = truncated
    ? result.text.slice(0, MAX_CHARS) + "\n\n[Content truncated — showing first portion only]"
    : result.text;

  return { text, method: result.method, truncated, originalLength: result.text.length };
};

module.exports = { extractFileContent };
