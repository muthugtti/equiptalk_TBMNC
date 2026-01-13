import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'fonts.gstatic.com',
      }
    ]
  },
  serverExternalPackages: ['firebase-admin'],
  output: 'standalone',
};

export default nextConfig;
