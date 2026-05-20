/**
 * sanitizeHtml.js
 * ─────────────────────────────────────────────────────────────────
 * Cleans raw HTML from Google Classroom / AnnouncementForm output.
 *
 * Preserves safe inline formatting tags: <b>, <strong>, <i>, <em>, <u>
 * Converts block-level tags to line breaks.
 * Strips all other tags and dangerous attributes.
 *
 * Used in: Announcements.jsx, ParentDashboard.jsx, Dashboard.jsx
 */

// Tags we allow through as-is (safe inline formatting only)
const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u"]);

/**
 * Sanitizes raw HTML and returns safe HTML with inline formatting preserved.
 * Block tags become <br>, all other tags are stripped.
 * Safe to use with dangerouslySetInnerHTML.
 *
 * @param {string} html  Raw HTML string from API
 * @returns {string}     Safe HTML string
 */
export function sanitizeAnnouncement(html) {
  if (!html || typeof html !== "string") return "";

  // Quick check — if there are no tags, it's already plain text
  if (!html.includes("<")) return html.trim();

  let text = html
    // ── 1. Block-level tags → <br> BEFORE anything else ─────────
    .replace(/<\/?(div|p|li|tr|section|article|header|footer|h[1-6])\s*\/?>/gi, "<br>")
    // Self-closing <br> variants → <br>
    .replace(/<br\s*\/?>/gi, "<br>")
    // ── 2. Remove style/class attributes everywhere ───────────────
    .replace(/\s*style="[^"]*"/gi, "")
    .replace(/\s*class="[^"]*"/gi, "")
    // ── 3. Strip all tags EXCEPT the allowed inline ones ─────────
    // Replace disallowed opening tags (keep allowed ones)
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
      if (ALLOWED_TAGS.has(tag.toLowerCase())) return match;
      return ""; // strip the tag
    });

  // ── 4. Decode HTML entities ──────────────────────────────────────
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // ── 5. Collapse excessive <br> tags ─────────────────────────────
  text = text
    .replace(/(<br>\s*){3,}/gi, "<br><br>") // max 2 consecutive breaks
    .trim();

  return text;
}

/**
 * Returns a short plain-text preview of an announcement (strips all HTML).
 * @param {string} html  Raw HTML string
 * @param {number} maxLen  Max character length
 */
export function announcementPreview(html, maxLen = 160) {
  if (!html || typeof html !== "string") return "";
  // Strip all tags for plain-text preview
  const plain = html.replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).trimEnd() + "…";
}
