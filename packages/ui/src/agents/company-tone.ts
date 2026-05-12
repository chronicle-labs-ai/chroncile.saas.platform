/*
 * Company logo tone — static + runtime helpers for picking a tile
 * background that keeps a logo readable.
 *
 * Logo.dev returns the brand's *primary* mark. For brands like
 * OpenAI, Vercel, Anthropic, GitHub, X, Apple, Cursor, Linear, etc.
 * that mark is monochrome black and disappears on the dark
 * `data-chrome="product"` canvas. The mirror problem (white-only
 * marks on a light theme) is rarer but exists.
 *
 * Two layers of tone detection:
 *
 *   - `getCompanyLogoTone(name)` — instant, zero-cost lookup against
 *     a curated set of known dark/light brands. Use this for SSR-safe
 *     decisions and for hydrating the tile color synchronously.
 *
 *   - `useDetectedLogoTone(url)` — runtime probe that draws the image
 *     to a 1×1 hidden canvas, computes mean luminance, and returns
 *     `"dark" | "light" | "neutral"`. Cached per URL across the
 *     module so each brand costs at most one decode + 1×1 paint.
 *
 * Components combine the two: the static lookup paints the right
 * tile immediately; the runtime probe upgrades the answer after
 * first paint when the brand isn't in the curated set.
 */

import * as React from "react";

import { normalizeBrandIconName } from "../icons/brand-icons";

export type CompanyLogoTone = "dark" | "light" | "neutral";

/* ── Static curation ───────────────────────────────────────── */

/**
 * Brands whose default logo.dev mark is dark/black. Render with a
 * light tile (e.g. `bg-white/95`) so the mark stays visible on the
 * dark Linear/product canvas.
 *
 * Add new entries by lowercasing the brand name and stripping any
 * domain. Match keys are produced by `normalizeBrandIconName`.
 */
const DARK_TONE_BRANDS: ReadonlySet<string> = new Set([
  // Companies whose primary wordmark is black / very dark.
  "openai",
  "anthropic",
  "vercel",
  "github",
  "apple",
  "x",
  "twitter",
  "linear",
  "notion",
  "cursor",
  "ramp",
  "perplexity",
  "huggingface",
  "pydantic",
  "next",
  "next.js",
  "nextjs",
  "shadcn",
  "tailwind",
  "figma",
  "groq",
  "mistral",
  "langchain",
  "llamaindex",
  "crewai",
  "supabase",
  "deepmind",
]);

/**
 * Brands whose default logo.dev mark is white / very light. Render
 * with a dark tile when the active chrome is light. Empty by default
 * — most "white" brand marks also exist in a colored variant that
 * logo.dev returns; add only the brands that come back stark white.
 */
const LIGHT_TONE_BRANDS: ReadonlySet<string> = new Set([]);

export function getCompanyLogoTone(name: string): CompanyLogoTone {
  const key = normalizeBrandIconName(name);
  if (DARK_TONE_BRANDS.has(key)) return "dark";
  if (LIGHT_TONE_BRANDS.has(key)) return "light";
  return "neutral";
}

/* ── Runtime probe ─────────────────────────────────────────── */

/**
 * Module-level cache for measured tones. Keyed by the resolved
 * logo.dev URL so re-renders never re-probe the same brand.
 */
const RUNTIME_TONE_CACHE = new Map<string, CompanyLogoTone>();

/**
 * Subscribers fired when a URL's tone resolves. We don't expose this
 * in the public API; it's an implementation detail of
 * `useDetectedLogoTone` so multiple callers waiting on the same URL
 * all get the answer.
 */
const RUNTIME_TONE_SUBSCRIBERS = new Map<string, Set<(tone: CompanyLogoTone) => void>>();

function notifyTone(url: string, tone: CompanyLogoTone) {
  RUNTIME_TONE_CACHE.set(url, tone);
  const subs = RUNTIME_TONE_SUBSCRIBERS.get(url);
  if (subs) {
    for (const cb of subs) cb(tone);
    RUNTIME_TONE_SUBSCRIBERS.delete(url);
  }
}

/**
 * Loads the image with `crossOrigin="anonymous"`, draws it to a
 * tiny offscreen canvas, samples the average luminance, and returns
 * a tone. Logo.dev serves with `Access-Control-Allow-Origin: *`
 * so the canvas does not become tainted.
 *
 * Pixels with alpha 0 are skipped so transparent padding around the
 * mark doesn't bias the mean. Pixels with alpha < 0.4 are weighted
 * by their alpha so anti-aliased edges count partially.
 */
async function probeLogoTone(url: string): Promise<CompanyLogoTone> {
  if (typeof window === "undefined") return "neutral";
  const cached = RUNTIME_TONE_CACHE.get(url);
  if (cached) return cached;

  return new Promise<CompanyLogoTone>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";

    const finish = (tone: CompanyLogoTone) => {
      notifyTone(url, tone);
      resolve(tone);
    };

    img.onload = () => {
      try {
        const SAMPLE = 24;
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish("neutral");

        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;

        let lumSum = 0;
        let alphaSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]! / 255;
          if (a < 0.05) continue;
          const r = data[i]! / 255;
          const g = data[i + 1]! / 255;
          const b = data[i + 2]! / 255;
          // Rec. 709 luminance.
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumSum += lum * a;
          alphaSum += a;
        }

        if (alphaSum === 0) return finish("neutral");
        const meanLum = lumSum / alphaSum;

        if (meanLum < 0.32) return finish("dark");
        if (meanLum > 0.78) return finish("light");
        return finish("neutral");
      } catch {
        // Canvas tainted (CORS) or other read failure — give up and
        // let the caller fall back to the static tone.
        finish("neutral");
      }
    };

    img.onerror = () => finish("neutral");
    img.src = url;
  });
}

export interface UseDetectedLogoToneOptions {
  /**
   * Tone to return until the runtime probe resolves (and forever if
   * the runtime probe is disabled). Defaults to `"neutral"`.
   */
  fallback?: CompanyLogoTone;
  /**
   * Disable the runtime probe. Useful when you want a SSR-safe,
   * hydration-safe rendering and you trust the static curation.
   */
  disabled?: boolean;
}

/**
 * Hydration-safe tone hook. Returns `fallback` on the server and on
 * the very first client paint, then upgrades to the cached runtime
 * tone (or the freshly-probed one) on the next tick.
 *
 * Pass `null` for `url` to skip probing entirely.
 */
export function useDetectedLogoTone(
  url: string | null | undefined,
  options: UseDetectedLogoToneOptions = {},
): CompanyLogoTone {
  const { fallback = "neutral", disabled = false } = options;

  const cached =
    typeof url === "string" && RUNTIME_TONE_CACHE.has(url)
      ? RUNTIME_TONE_CACHE.get(url)!
      : null;

  const [tone, setTone] = React.useState<CompanyLogoTone>(
    cached ?? fallback,
  );

  React.useEffect(() => {
    if (disabled || typeof url !== "string" || url.length === 0) return;
    const cachedNow = RUNTIME_TONE_CACHE.get(url);
    if (cachedNow) {
      setTone(cachedNow);
      return;
    }

    let cancelled = false;
    const subscribers =
      RUNTIME_TONE_SUBSCRIBERS.get(url) ?? new Set<(t: CompanyLogoTone) => void>();
    const handler = (next: CompanyLogoTone) => {
      if (!cancelled) setTone(next);
    };
    subscribers.add(handler);
    RUNTIME_TONE_SUBSCRIBERS.set(url, subscribers);

    void probeLogoTone(url);

    return () => {
      cancelled = true;
      subscribers.delete(handler);
      if (subscribers.size === 0) RUNTIME_TONE_SUBSCRIBERS.delete(url);
    };
  }, [url, disabled]);

  return tone;
}

/* ── Test seam ─────────────────────────────────────────────── */

/**
 * Internal helper for stories / tests that need to seed the runtime
 * cache deterministically. Not exported from the package barrel.
 */
export function _setRuntimeLogoToneForTesting(
  url: string,
  tone: CompanyLogoTone,
) {
  RUNTIME_TONE_CACHE.set(url, tone);
}
