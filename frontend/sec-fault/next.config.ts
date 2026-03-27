import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const normalizedBackendUrl = backendUrl.replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${normalizedBackendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
