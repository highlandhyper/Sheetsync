
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Your existing Next.js configuration
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  turbopack: {},
};

export default nextConfig;
