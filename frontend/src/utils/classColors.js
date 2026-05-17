/**
 * classColors.js
 *
 * Single source of truth for class colours.
 * Every page that needs to show a colour for a class MUST import from here.
 *
 * Assignment is deterministic: the same course name always maps to the same
 * palette slot, regardless of the order or page it is rendered on.
 */

// 18 entries — one per BANNER slot.  Colours are intentionally dark so they
// look good both as solid fills (headers, pill borders) and as gradient stops.
const CLASS_PALETTE = [
  // solid            gradient (start → end)                              text on gradient
  { solid: "#1d4ed8", g1: "#93c5fd", g2: "#3b82f6", text: "#fff" },   // blue
  { solid: "#b91c1c", g1: "#fca5a5", g2: "#ef4444", text: "#fff" },   // red
  { solid: "#15803d", g1: "#86efac", g2: "#22c55e", text: "#fff" },   // green
  { solid: "#c2410c", g1: "#fdba74", g2: "#f97316", text: "#fff" },   // orange
  { solid: "#334155", g1: "#cbd5e1", g2: "#64748b", text: "#fff" },   // slate
  { solid: "#5b21b6", g1: "#c4b5fd", g2: "#8b5cf6", text: "#fff" },   // violet
  { solid: "#0369a1", g1: "#7dd3fc", g2: "#0ea5e9", text: "#fff" },   // sky
  { solid: "#9d174d", g1: "#fbcfe8", g2: "#ec4899", text: "#fff" },   // rose
  { solid: "#065f46", g1: "#a7f3d0", g2: "#10b981", text: "#fff" },   // emerald
  { solid: "#ea580c", g1: "#fed7aa", g2: "#fb923c", text: "#fff" },   // apricot
  { solid: "#4c1d95", g1: "#ddd6fe", g2: "#a78bfa", text: "#fff" },   // purple
  { solid: "#134e4a", g1: "#99f6e4", g2: "#14b8a6", text: "#fff" },   // teal
  { solid: "#1e40af", g1: "#bfdbfe", g2: "#60a5fa", text: "#fff" },   // indigo
  { solid: "#7f1d1d", g1: "#fecaca", g2: "#f87171", text: "#fff" },   // crimson
  { solid: "#3f6212", g1: "#d9f99d", g2: "#84cc16", text: "#fff" },   // lime
  { solid: "#6b21a8", g1: "#e9d5ff", g2: "#c084fc", text: "#fff" },   // lilac
  { solid: "#075985", g1: "#bae6fd", g2: "#38bdf8", text: "#fff" },   // steel-blue
  { solid: "#b45309", g1: "#fef08a", g2: "#eab308", text: "#fff" },   // amber
];

/**
 * Deterministic hash: same name → same index, every time.
 * Uses a full string hash so "Math" and "Music" don't collide the way
 * charCodeAt(0) would.
 */
function hashName(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) >>> 0;
  }
  return h % CLASS_PALETTE.length;
}

/** Returns the full palette entry for a course name. */
export function getClassColor(name = "") {
  return CLASS_PALETTE[hashName(name)];
}

/** Solid colour string — for headers, pill borders, text accents. */
export function getClassSolid(name = "") {
  return CLASS_PALETTE[hashName(name)].solid;
}

/**
 * CSS gradient string + contrasting text colour — for card banners
 * (EnrolledClasses, etc.).
 */
export function getClassBanner(name = "") {
  const { g1, g2, text } = CLASS_PALETTE[hashName(name)];
  return {
    bg: `linear-gradient(135deg,${g1} 0%,${g2} 100%)`,
    text,
  };
}
