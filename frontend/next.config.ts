import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` is proxied to the Spring Boot backend, which keeps session
 * cookies first-party and removes the need for CORS (see docs/adr/0002-session-authentication.md).
 */
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
