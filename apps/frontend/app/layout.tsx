import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Warmup Platform",
  description: "Agent Warmup Platform - MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
