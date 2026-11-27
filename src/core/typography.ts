/** Reader typography settings: validated here so client and server agree. */
export interface Typography {
  font: "serif" | "sans" | "system";
  /** px */
  size: number;
  lineHeight: "compact" | "normal" | "relaxed";
  /** ch */
  width: number;
}

export const DEFAULT_TYPOGRAPHY: Typography = {
  font: "serif",
  size: 18,
  lineHeight: "normal",
  width: 70,
};

export const SIZE_RANGE = { min: 14, max: 26, step: 1 } as const;
export const WIDTH_RANGE = { min: 50, max: 100, step: 5 } as const;

const FONTS = ["serif", "sans", "system"] as const;
const LINE_HEIGHTS = ["compact", "normal", "relaxed"] as const;
export const LINE_HEIGHT_VALUE: Record<Typography["lineHeight"], number> = {
  compact: 1.45,
  normal: 1.65,
  relaxed: 1.85,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Coerce anything (stored JSON, a request body) into valid settings, filling defaults. */
export function parseTypography(v: unknown): Typography {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  return {
    font: FONTS.includes(o.font as Typography["font"])
      ? (o.font as Typography["font"])
      : DEFAULT_TYPOGRAPHY.font,
    size: Math.round(clamp(num(o.size, DEFAULT_TYPOGRAPHY.size), SIZE_RANGE.min, SIZE_RANGE.max)),
    lineHeight: LINE_HEIGHTS.includes(o.lineHeight as Typography["lineHeight"])
      ? (o.lineHeight as Typography["lineHeight"])
      : DEFAULT_TYPOGRAPHY.lineHeight,
    width: Math.round(
      clamp(num(o.width, DEFAULT_TYPOGRAPHY.width), WIDTH_RANGE.min, WIDTH_RANGE.max),
    ),
  };
}
