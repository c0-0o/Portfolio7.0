/**
 * hero-config.ts  -  everything you are likely to tune, in one place.
 * Pass a partial override:  <Hero config={{ scroll: { range: 1.2 } }} />
 */

/** One letter per tile, row by row. Each tone varies the opacity of one shared ink color. */
const gridInk = "49,51,47";
export const TONES: Record<string, string> = {
  w: "transparent",
  G: `rgba(${gridInk},0.23)`,
  a: `linear-gradient(135deg,rgba(${gridInk},0.11),rgba(${gridInk},0.34))`,
  b: `rgba(${gridInk},0.42)`,
  c: `linear-gradient(135deg,rgba(${gridInk},0.10),rgba(${gridInk},0.30))`,
  d: `linear-gradient(135deg,rgba(${gridInk},0.17),rgba(${gridInk},0.42))`,
  e: `linear-gradient(135deg,rgba(${gridInk},0.07),rgba(${gridInk},0.26))`,
  f: `rgba(${gridInk},0.30)`,
  g: `rgba(${gridInk},0.42)`,
  h: `rgba(${gridInk},0.26)`,
  i: `rgba(${gridInk},0.23)`,
  j: `rgba(${gridInk},0.34)`,
  k: `linear-gradient(135deg,rgba(${gridInk},0.30),rgba(${gridInk},0.07))`,
  l: `linear-gradient(135deg,rgba(${gridInk},0.13),rgba(${gridInk},0))`,
  m: `rgba(${gridInk},0.30)`,
  n: `linear-gradient(135deg,rgba(${gridInk},0.21),rgba(${gridInk},0))`,
};

export interface HeroConfig {
  /** Viewport width (px) at or below which the 4x4 phone layout is used. Keep in sync with the 760px media query in hero.css. */
  mobileBreakpoint: number;
  layout: {
    desktop: { cols: number; rows: number; tones: string };
    mobile: { cols: number; rows: number; tones: string };
  };
  /** How the single portrait image is placed under the tile grid (shared coordinate system). */
  portrait: {
    /** natural size of public/portfolio/hero-portrait-smooth.webp */
    width: number;
    height: number;
    desktop: {
      /** image height as a multiple of the grid height */
      heightScale: number;
      /** x (in source pixels) of the point of the photo that should sit at `anchor` */
      faceX: number;
      /** where `faceX` lands horizontally, as a fraction of the grid width */
      anchor: number;
      /** top offset as a fraction of grid height */
      top: number;
    };
    mobile: { widthScale: number; left: number; top: number };
  };
  entrance: {
    /** ms between diagonal neighbours (top-left -> bottom-right) */
    stagger: number;
    /** ms before the first tile */
    base: number;
    /** deterministic per-tile variation in ms (no randomness) */
    jitter: number;
  };
  /** Scroll exit (hero -> next section). */
  scroll: {
    /** scroll distance (in viewport heights) over which the exit plays */
    range: number;
    /** smoothing time constant in ms (higher = softer / more inertia) */
    smoothing: number;
    /** portion of the exit where tiles start / spread their flip-back along the diagonal (0..1) */
    flipSpread: number;
    /** how much of the exit a single tile's flip takes (0..1) */
    flipLength: number;
  };
  /** Optional faint curved lines behind the tiles. Off for now. */
  lines: { enabled: boolean };
}

export const defaultHeroConfig: HeroConfig = {
  mobileBreakpoint: 760,
  layout: {
    desktop: { cols: 6, rows: 4, tones: "awbcde" + "wfgGfw" + "whfGij" + "wwklmn" },
    mobile: { cols: 4, rows: 4, tones: "abcd" + "fgGi" + "hfij" + "wkln" },
  },
  portrait: {
    width: 1198,
    height: 817,
    desktop: { heightScale: 1.02, faceX: 400, anchor: 0.5, top: 0.1 },
    mobile: { widthScale: 1.76, left: -0.25, top: -0.01 },
  },
  entrance: { stagger: 85, base: 40, jitter: 9 },
  scroll: { range: 1.0, smoothing: 110, flipSpread: 0.5, flipLength: 0.42 },
  lines: { enabled: false },
};

export function mergeConfig(over?: DeepPartial<HeroConfig>): HeroConfig {
  return deepMerge<HeroConfig>(defaultHeroConfig, over ?? {});
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function deepMerge<T extends object>(base: T, over: DeepPartial<T>): T {
  return mergeRecords(base, over) as T;
}

function mergeRecords(base: unknown, over: unknown): unknown {
  if (!isRecord(base) || !isRecord(over)) return over;

  const result = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) result[key] = mergeRecords(base[key], value);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
