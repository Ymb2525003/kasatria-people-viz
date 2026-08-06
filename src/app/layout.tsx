import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

/**
 * Fonts via next/font: self-hosted at build time, so there is no render-blocking
 * request to Google Fonts and no layout shift when they swap in.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui-loaded",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kasatria - 200 people, four arrangements",
  description:
    "A CSS3D visualisation of 200 people read live from Google Sheets, arranged as a table, sphere, double helix, or grid.",
  // This page holds personal data behind a login; it should never be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
