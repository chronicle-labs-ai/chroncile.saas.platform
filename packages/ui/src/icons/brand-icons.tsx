import * as React from "react";
import { Building2, Globe, Webhook, type LucideIcon } from "lucide-react";

export const BRAND_ICON_DOMAINS = {
  intercom: "intercom.com",
  zendesk: "zendesk.com",
  shopify: "shopify.com",
  stripe: "stripe.com",
  salesforce: "salesforce.com",
  hubspot: "hubspot.com",
  slack: "slack.com",
  segment: "segment.com",
  snowflake: "snowflake.com",
  postgres: "postgresql.org",
  kafka: "kafka.apache.org",
  gmail: "gmail.com",
  linear: "linear.app",
  notion: "notion.so",
} as const;

export type BrandIconId = keyof typeof BRAND_ICON_DOMAINS;

export const BRAND_ICON_IDS = Object.keys(BRAND_ICON_DOMAINS) as BrandIconId[];

export const BRAND_ICON_ALIASES: Record<string, BrandIconId> = {
  "apache kafka": "kafka",
  googlemail: "gmail",
  "google mail": "gmail",
  postgresql: "postgres",
  sf: "salesforce",
};

export function normalizeBrandIconName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBrandIconId(name: string): BrandIconId | null {
  const normalized = normalizeBrandIconName(name);

  if (normalized in BRAND_ICON_DOMAINS) return normalized as BrandIconId;
  return BRAND_ICON_ALIASES[normalized] ?? null;
}

export function getBrandIconDomain(name: string) {
  const normalized = normalizeBrandIconName(name);
  const knownId = getBrandIconId(normalized);

  if (knownId) return BRAND_ICON_DOMAINS[knownId];
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(normalized)) {
    return normalized.replace(/\s+/g, "");
  }

  const bestGuess = normalized
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return bestGuess ? `${bestGuess}.com` : null;
}

const GENERIC_COMPANY_LOGO_NAMES = new Set([
  "api",
  "http",
  "http api",
  "http rest",
  "rest",
  "rest api",
  "webhook",
  "webhooks",
]);

const GENERIC_COMPANY_LOGO_ICONS: Record<string, LucideIcon> = {
  api: Globe,
  http: Globe,
  "http api": Globe,
  "http rest": Globe,
  rest: Globe,
  "rest api": Globe,
  webhook: Webhook,
  webhooks: Webhook,
};

function getCompanyLogoFallbackIcon(name: string, fallbackIcon?: LucideIcon) {
  if (fallbackIcon) return fallbackIcon;

  const normalized = normalizeBrandIconName(name);
  return GENERIC_COMPANY_LOGO_ICONS[normalized] ?? Building2;
}

function getCompanyLogoDomain(name: string, domain: string | null | undefined) {
  if (domain !== undefined) return domain;

  const normalized = normalizeBrandIconName(name);
  if (GENERIC_COMPANY_LOGO_NAMES.has(normalized)) return null;

  return getBrandIconDomain(name);
}

/**
 * Brands whose default logo.dev mark is essentially monochrome black
 * (pure or near-pure black silhouette on a transparent background).
 * Rendered straight onto our dark product canvas the mark disappears.
 *
 * For these brands the rendered `<img>` is tagged with
 * `data-brand-tone="dark-mark"`; a single CSS rule in `globals.css`
 * applies `filter: invert(1) hue-rotate(180deg)` under
 * `[data-theme="dark"]` so the silhouette flips to white. The
 * `hue-rotate(180deg)` is a no-op for pure black/white but preserves
 * subtle tint for near-monochrome marks (e.g. Pydantic's red accent).
 *
 * Keep this set TIGHT — only include brands whose logo.dev response
 * is unambiguously monochrome-dark. Inverting a multi-color logo
 * (Slack, Figma, Stripe, Linear's purple gradient) distorts brand
 * color and is worse than the original. Brands that need help but
 * don't invert cleanly should use `<AgentCompanyMark>` (tile-based
 * contrast) or wrap the logo in their own contrasting surface.
 */
export const MONOCHROME_DARK_MARK_BRANDS: ReadonlySet<string> = new Set([
  "anthropic",
  "apple",
  "cursor",
  "github",
  "langchain",
  "llamaindex",
  "next",
  "next.js",
  "nextjs",
  "notion",
  "openai",
  "pydantic",
  "shadcn",
  "twitter",
  "vercel",
  "x",
]);

export function isMonochromeDarkMarkBrand(name: string): boolean {
  return MONOCHROME_DARK_MARK_BRANDS.has(normalizeBrandIconName(name));
}

export type BrandIconFormat = "svg" | "png" | "webp" | "jpg";

export interface LogoDevUrlOptions {
  token?: string;
  size?: number;
  requestSize?: number;
  format?: BrandIconFormat | null;
  retina?: boolean;
}

export const LOGO_DEV_PUBLISHABLE_KEY_ENV =
  "NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY";

const FALLBACK_LOGO_DEV_PUBLISHABLE_KEY = "pk_KUdn1PMmSYCZmOzzW8W04A";

export function getLogoDevPublishableKey() {
  if (typeof process === "undefined") return FALLBACK_LOGO_DEV_PUBLISHABLE_KEY;
  return (
    process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY ??
    FALLBACK_LOGO_DEV_PUBLISHABLE_KEY
  );
}

export function getLogoDevUrl(
  domain: string,
  {
    token = getLogoDevPublishableKey(),
    size,
    requestSize,
    format,
    retina,
  }: LogoDevUrlOptions = {}
) {
  const params = new URLSearchParams();

  if (token) params.set("token", token);
  if (requestSize ?? size) params.set("size", String(requestSize ?? size));
  if (format) params.set("format", format);
  if (retina) params.set("retina", "true");

  const query = params.toString();
  return `https://img.logo.dev/${domain}${query ? `?${query}` : ""}`;
}

export interface BrandIconProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "alt" | "height" | "src" | "width"
  > {
  id: BrandIconId;
  /** Logo.dev publishable token. Defaults to NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY. */
  token?: string;
  /** Accessible label. Defaults to an empty alt because logos are usually decorative. */
  alt?: string;
  size?: number;
  /** Logo.dev source size to request. Defaults to 2x rendered size for crisp display. */
  requestSize?: number;
  format?: BrandIconFormat;
  fallbackColor?: string;
  fallbackBackground?: string;
  fallbackIcon?: LucideIcon;
  /** Round the remote logo image. Fallback badges are rounded by default. */
  rounded?: boolean;
  /** Custom border radius for the logo or fallback badge. Overrides `rounded`. */
  radius?: React.CSSProperties["borderRadius"];
  /**
   * When `true` (default), the rendered `<img>` is tagged with
   * `data-brand-tone="dark-mark"` for monochrome-dark brands so a
   * single CSS rule (`globals.css`) can invert the mark under
   * `[data-theme="dark"]`. Set to `false` when the icon is already
   * paired with a contrasting tile (e.g. inside `<AgentCompanyMark>`)
   * — otherwise the inversion would flip a black mark to white on a
   * white tile and re-hide it.
   */
  themeAware?: boolean;
}

export function BrandIcon({
  id,
  token,
  alt = "",
  size = 20,
  requestSize = size * 2,
  format = "webp",
  fallbackColor = "currentColor",
  fallbackBackground = "var(--c-surface-02, rgba(128, 128, 128, 0.16))",
  fallbackIcon: FallbackIcon = Building2,
  rounded = false,
  radius,
  themeAware = true,
  className,
  onError,
  style,
  ...rest
}: BrandIconProps) {
  const [failed, setFailed] = React.useState(false);
  const logoDevToken = token ?? getLogoDevPublishableKey();
  const imageBorderRadius = radius ?? (rounded ? "999px" : undefined);
  const imageStyle = imageBorderRadius
    ? { ...style, borderRadius: imageBorderRadius }
    : style;
  const fallbackBorderRadius =
    radius ?? (rounded ? "999px" : style?.borderRadius ?? "999px");

  React.useEffect(() => {
    setFailed(false);
  }, [id, token, format]);

  if (!logoDevToken || failed) {
    return (
      <span
        aria-label={alt || `${id} logo`}
        className={className}
        role="img"
        style={{
          alignItems: "center",
          background: fallbackBackground,
          color: fallbackColor,
          display: "inline-flex",
          height: size,
          justifyContent: "center",
          width: size,
          ...style,
          borderRadius: fallbackBorderRadius,
        }}
      >
        <FallbackIcon aria-hidden size={size / 2} strokeWidth={1.75} />
      </span>
    );
  }

  const isDarkMark = themeAware && MONOCHROME_DARK_MARK_BRANDS.has(id);

  return (
    <img
      alt={alt}
      className={className}
      data-brand-tone={isDarkMark ? "dark-mark" : undefined}
      height={size}
      loading="lazy"
      src={getLogoDevUrl(BRAND_ICON_DOMAINS[id], {
        token: logoDevToken,
        size,
        requestSize,
        format,
      })}
      style={imageStyle}
      width={size}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}

export interface CompanyLogoProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "alt" | "height" | "src" | "width"
  > {
  name: string;
  domain?: string | null;
  token?: string;
  alt?: string;
  size?: number;
  /** Logo.dev source size to request. Defaults to 2x rendered size for crisp display. */
  requestSize?: number;
  format?: BrandIconFormat;
  fallbackColor?: string;
  fallbackBackground?: string;
  fallbackIcon?: LucideIcon;
  rounded?: boolean;
  radius?: React.CSSProperties["borderRadius"];
  /**
   * When `true` (default), monochrome-dark brand marks (GitHub,
   * OpenAI, Vercel, Cursor, …) invert to white under
   * `[data-theme="dark"]` so they stay readable on the dark product
   * canvas. Set to `false` when the logo is already rendered inside
   * a contrasting tile (e.g. `<AgentCompanyMark>`).
   */
  themeAware?: boolean;
}

export function CompanyLogo({
  name,
  domain,
  token,
  alt = `${name} logo`,
  size = 20,
  requestSize = size * 2,
  format = "webp",
  fallbackColor = "currentColor",
  fallbackBackground = "var(--c-surface-02, rgba(128, 128, 128, 0.16))",
  fallbackIcon,
  rounded = false,
  radius,
  themeAware = true,
  className,
  onError,
  style,
  ...rest
}: CompanyLogoProps) {
  const [failed, setFailed] = React.useState(false);
  const logoDevToken = token ?? getLogoDevPublishableKey();
  const resolvedDomain = getCompanyLogoDomain(name, domain);
  const FallbackIcon = getCompanyLogoFallbackIcon(name, fallbackIcon);
  const imageBorderRadius = radius ?? (rounded ? "999px" : undefined);
  const imageStyle = imageBorderRadius
    ? { ...style, borderRadius: imageBorderRadius }
    : style;
  const fallbackBorderRadius =
    radius ?? (rounded ? "999px" : style?.borderRadius ?? "999px");

  React.useEffect(() => {
    setFailed(false);
  }, [name, domain, token, format]);

  if (!logoDevToken || !resolvedDomain || failed) {
    return (
      <span
        aria-label={alt}
        className={className}
        role="img"
        style={{
          alignItems: "center",
          background: fallbackBackground,
          color: fallbackColor,
          display: "inline-flex",
          height: size,
          justifyContent: "center",
          width: size,
          ...style,
          borderRadius: fallbackBorderRadius,
        }}
      >
        <FallbackIcon aria-hidden size={size / 2} strokeWidth={1.75} />
      </span>
    );
  }

  const isDarkMark = themeAware && isMonochromeDarkMarkBrand(name);

  return (
    <img
      alt={alt}
      className={className}
      data-brand-tone={isDarkMark ? "dark-mark" : undefined}
      height={size}
      loading="lazy"
      src={getLogoDevUrl(resolvedDomain, {
        token: logoDevToken,
        size,
        requestSize,
        format,
      })}
      style={imageStyle}
      width={size}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
