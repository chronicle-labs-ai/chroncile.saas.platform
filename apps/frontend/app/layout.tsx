import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeScript } from "ui";
import "./globals.css";
// Boneyard bone registry — populated at design time by
// `yarn workspace ui bones:build`. Importing here makes every
// `<Skeleton name="...">` in the tree resolve its pre-captured layout
// without each consumer wiring it up. Empty stub when no bones have
// been captured yet, so this is a safe no-op import.
import "ui/bones/registry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Chronicle Labs",
    template: "%s · Chronicle Labs",
  },
  description: "Multi-tenant event capture and replay for AI ops.",
  applicationName: "Chronicle Labs",
  icons: {
    /*
     * The SVG itself flips fill via `prefers-color-scheme`, so a
     * single asset covers both light and dark browser chrome.
     */
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  /*
   * `opengraph-image.png` + `opengraph-image.alt.txt` (and the
   * matching twitter pair) colocated in this directory are
   * auto-discovered by Next.js — the framework injects matching
   * `<meta property="og:image">` / `<meta name="twitter:image">`
   * tags + alt text from those static files. Source artwork lives
   * in the Chronicle design-system Figma file (frame 2004:34).
   */
  openGraph: {
    type: "website",
    siteName: "Chronicle Labs",
    title: "Chronicle Labs",
    description: "Multi-tenant event capture and replay for AI ops.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chronicle Labs",
    description: "Multi-tenant event capture and replay for AI ops.",
  },
};

/*
 * `themeColor` reads from the surface token via the inline
 * theme script writing `data-theme` before paint, so iOS Safari's
 * status bar matches the active theme on first frame.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * `data-theme="dark"` matches the ThemeProvider's `defaultTheme`
     * so SSR markup and the inline `themeScript` agree. The script
     * (rendered before <body>) flips this to the user's stored
     * preference before first paint — no theme flash on refresh.
     * `suppressHydrationWarning` is required because the script
     * mutates `data-theme` before React hydrates.
     */
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
