import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "ui";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
