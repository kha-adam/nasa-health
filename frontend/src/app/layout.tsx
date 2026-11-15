import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

// Same families as the SphereAI reference (Manrope headings, Inter interface), both
// SIL Open Font License, self-hosted at build time by next/font.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BLUE / Crew Health",
  description: "Astronaut physical & psychological health monitoring with BLUE, an adaptive AI psychologist.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
