import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow API rewrites during development so the frontend can talk to the backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
