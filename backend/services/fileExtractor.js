const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Lazy-load optional parsers ────────────────────────────────────
let pdfParse    = null;
let mammoth     = null;
let officeParser = null;

try { pdfParse    = require("pdf-parse");    } catch {}
try { mammoth     = require("mammoth");      } catch {}
try { officeParser = require("officeparser"); } catch {}

// ── PDF extraction ────────────────────────────────────────────────
const extractFromPdf = async (base64Data) => {
  if (!pdfParse) throw new Error("pdf-parse not installed. Run: npm install pdf-parse");

  const buffer = Buffer.from(base64Data, "base64");
  try {
    const data = await pdfParse(buffer);
    const text = data.text?.trim();
    if (text && text.length > 50) {
      console.log(`PDF: extracted ${text.length} chars via pdf-parse`);
      return { text, method: "text", pages: data.numpages };
    }
    throw new Error("PDF appears to be image-based or empty. Only text-based PDFs are supported.");
  } catch (e) {
    if (e.message.includes("image-based")) throw e;
    throw new Error(`Could not read PDF: ${e.message}`);
  }
};

// ── PPTX/PPT extraction ───────────────────────────────────────────
const extractFromPptx = async (base64Data, fileName) => {
  if (!officeParser) throw new Error("officeparser not installed. Run: npm install officeparser");

  const buffer = Buffer.from(base64Data, "base64");
  try {
    const text = await officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false });
    if (text?.trim()) {
      console.log(`PPTX: extracted ${text.length} chars`);
      return { text: text.trim(), method: "text" };
    }
    throw new Error("No text found in presentation. Make sure slides contain actual text.");
  } catch (e) {
    throw new Error(`Could not read PowerPoint file: ${e.message}`);
  }
};

// ── DOCX extraction ───────────────────────────────────────────────
const extractFromDocx = async (base64Data) => {
  if (!mammoth) throw new Error("mammoth not installed. Run: npm install mammoth");

  const buffer = Buffer.from(base64Data, "base64");
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.value?.trim()) {
      console.log(`DOCX: extracted ${result.value.length} chars`);
      return { text: result.value.trim(), method: "text" };
    }
    throw new Error("No text found in document.");
  } catch (e) {
    throw new Error(`Could not read Word document: ${e.message}`);
  }
};

// ── Main dispatcher ───────────────────────────────────────────────
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
    throw new Error("Image files are not supported yet. Please upload a PDF, PPTX, or DOCX file.");
  } else {
    throw new Error(`Unsupported file type: ${fileType}. Supported: PDF, PPTX, DOCX.`);
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
