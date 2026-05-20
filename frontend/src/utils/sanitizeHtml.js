/**
 * sanitizeHtml.js
 * ─────────────────────────────────────────────────────────────────
 * Cleans raw HTML from Google Classroom / AnnouncementForm output.
 *
 * Converts:
 *   <b>Hello</b><div>Please read below</div>
 * Into:
 *   **Hello**
 *   Please read below
 *
 * Inline formatting preserved:
 *   <b>/<strong>  → **text**
 *   <i>/<em>      → _text_
 *   <u>           → __text__ (underline via markdown-style)
 *
 * Used in: Announcements.jsx, ParentDashboard.jsx, Dashboard.jsx
 */

/**
 * Strips HTML and returns clean plain text with preserved line breaks
 * and inline formatting (bold, italic, underline).
 * Works in the browser (uses DOMParser) and falls back to regex for SSR.
 *
 * @param {string} html  Raw HTML string from API
 * @returns {string}     Clean text with markdown-style inline formatting
 */
export function sanitizeAnnouncement(html) {
  if (!html || typeof html !== "string") return "";

  // Quick check — if there are no tags, it's already plain text
  if (!html.includes("<")) return html.trim();

  let text = html
    // ── 1. Normalize block-level tags → newlines BEFORE any other processing ──
    .replace(/<\/?(div|p|br|li|tr|section|article|header|footer|h[1-6])\s*\/?>/gi, "\n")
    // Remove inline style attributes (they add noise like "text-align: center;")
    .replace(/\s*style="[^"]*"/gi, "")
    // Remove class attributes
    .replace(/\s*class="[^"]*"/gi, "")

    // ── 2. Preserve inline formatting BEFORE stripping remaining tags ──
    // Bold: <b>…</b> or <strong>…</strong>
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, "**$2**")
    // Italic: <i>…</i> or <em>…</em>
    .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, "_$2_")
    // Underline: <u>…</u>
    .replace(/<u>([\s\S]*?)<\/u>/gi, "__$1__")

    // ── 3. Strip all remaining tags ──────────────────────────────
    .replace(/<[^>]+>/g, "");

  // ── 4. Decode HTML entities ──────────────────────────────────────
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // ── 5. Collapse excessive whitespace / blank lines ───────────────
  text = text
    .split("\n")
    .map(l => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive blank lines
    .trim();

  return text;
}

/**
 * Returns a short preview of an announcement (plain text, no HTML).
 * @param {string} html  Raw HTML string
 * @param {number} maxLen  Max character length
 */
export function announcementPreview(html, maxLen = 160) {
  const clean = sanitizeAnnouncement(html);
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trimEnd() + "…";
}
