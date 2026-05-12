/**
 * Accent hexes for All Leads source chips (LeadManager) and matching dashboard charts.
 * Keep in sync with filter chip tints in `LeadManager`.
 */
export const LEAD_SOURCE_FILTER_TINTS: Record<string, string> = {
  all: "#4f46e5",
  chat: "#3b82f6",
  voice: "#06b6d4",
  email: "#10b981",
  sms: "#f59e0b",
  whatsapp: "#22c55e",
};

/** Funnel filter "All" chip tint (LeadManager). */
export const FUNNEL_ALL_CHIP_TINT = "#7c3aed";

/** Blue rotation for middle funnel stages (matches All Leads funnel pills). */
export const FUNNEL_STAGE_BAR_BLUES = [
  "#3b82f6",
  "#2563eb",
  "#60a5fa",
  "#1d4ed8",
] as const;

export const LEAD_SOURCE_CHART_FALLBACK = [
  "#4f46e5",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#22c55e",
] as const;

export const normalizeLeadSourceKey = (source: string): string =>
  String(source ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

export const leadSourceChartFill = (source: string, index: number): string => {
  const key = normalizeLeadSourceKey(source);
  if (LEAD_SOURCE_FILTER_TINTS[key]) return LEAD_SOURCE_FILTER_TINTS[key];
  return LEAD_SOURCE_CHART_FALLBACK[index % LEAD_SOURCE_CHART_FALLBACK.length];
};

/** Admin dashboard — Conversations vs Leads grouped bars (contrast on light blue card). */
export const TREND_CONVERSATIONS_BAR = LEAD_SOURCE_FILTER_TINTS.chat;
export const TREND_LEADS_BAR = "#166534";

export const TREND_PIPELINE_BAR = LEAD_SOURCE_FILTER_TINTS.sms;
export const TREND_CLOSED_BAR = "#22c55e";