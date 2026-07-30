/**
 * Shared constants for schedule board and course dialog.
 *
 * Only colour tokens live here — they're presentation-only and don't have a
 * natural source in the DB. All option lists (teachers, course types, grades,
 * classrooms, time periods) are fetched live from the 排课总台账 field
 * definitions via fetchSelectOptions() in app/actions.ts.
 */

// ── Course-type colour tokens ──────────────────────────────────────────────
// Only types that actually exist in the DB. Remove an entry here if a type
// is retired — it will then render with FALLBACK_STYLE.
export const TYPE_STYLE: Record<
  string,
  { bg: string; border: string; accent: string; text: string; badgeBg: string }
> = {
  诊断课: { bg: "#fff5f5", border: "#fecaca", accent: "#f87171", text: "#b91c1c", badgeBg: "#fee2e2" },
  小灶课: { bg: "#f0fdf4", border: "#bbf7d0", accent: "#4ade80", text: "#15803d", badgeBg: "#dcfce7" },
  长期班: { bg: "#eff6ff", border: "#bfdbfe", accent: "#60a5fa", text: "#1d4ed8", badgeBg: "#dbeafe" },
  短期班: { bg: "#fff7ed", border: "#fed7aa", accent: "#f97316", text: "#c2410c", badgeBg: "#ffedd5" },
  个人事项: { bg: "#eef2ff", border: "#c7d2fe", accent: "#6366f1", text: "#3730a3", badgeBg: "#e0e7ff" },
};

export const FALLBACK_STYLE = {
  bg: "#f9fafb", border: "#e5e7eb", accent: "#9ca3af", text: "#374151", badgeBg: "#f3f4f6",
};

// Style for 全体事项 banners (slate/charcoal — visually distinct from courses)
export const EVENT_STYLE = {
  bg: "#f1f5f9", border: "#94a3b8", accent: "#475569", text: "#1e293b", badgeBg: "#e2e8f0",
};
