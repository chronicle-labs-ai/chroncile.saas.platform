import type { Metadata } from "next";
import "./globals.css";
// Boneyard bone registry — populated at design time by
// `yarn workspace ui bones:build`. Importing here makes every
// `<Skeleton name="...">` resolve its captured layout. Empty stub when
// no bones have been captured yet, so this is a safe no-op import.
import "ui/bones/registry";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Chronicle Labs | Environment Manager",
  description:
    "Manage production, staging, development, and ephemeral environments",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-base text-primary font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
