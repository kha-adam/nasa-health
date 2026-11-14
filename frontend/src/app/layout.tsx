import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project BLUE — Astronaut Health",
  description: "Astronaut physical & psychological health monitoring with BLUE, an adaptive AI psychologist.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
