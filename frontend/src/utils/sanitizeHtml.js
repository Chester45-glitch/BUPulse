/**
 * sanitizeHtml.js
 * ─────────────────────────────────────────────────────────────────
 * Cleans raw HTML from Google Classroom / AnnouncementForm output.
 *
 * Converts:
 *   <b>Hello</b><div>Please read below</div>
 * Into:
 *   Hello
 *   Please read below
 *
 * Used in: Announcements.jsx, ParentDashboard.jsx, Dashboard.jsx
 */

/**
 * Strips all HTML and returns clean plain text with preserved line breaks.
 *
 * @param {string} html  Raw HTML string from API
 * @returns {string}     Clean plain text
 */
export function sanitizeAnnouncement(html) {
  if (!html || typeof html !== "string") return "";

  // Quick check — if there are no tags, it's already plain text
  if (!html.includes("<")) return html.trim();

  let text = html
    // Block elements → newlines
    .replace(/<\/?(div|p|br|li|tr|section|article|header|footer|h[1-6])\s*\/?>/gi, "\n")
    // Remove style and class attributes
    .replace(/\s*style="[^"]*"/gi, "")
    .replace(/\s*class="[^"]*"/gi, "")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // Collapse excessive whitespace / blank lines
  text = text
    .split("\n")
    .map(l => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
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
