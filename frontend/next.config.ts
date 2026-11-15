import type { NextConfig } from "next";

// FastAPI backend. The browser only ever talks to this Next.js origin; /api/* is
// proxied server-side so the session cookie is first-party (SameSite=Lax, httpOnly).
const BACKEND_URL = process.env.BLUE_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the "N" development indicator in the bottom-left corner (dev only; build and
  // runtime errors are still shown).
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
