import type { NextConfig } from 'next';

/**
 * NEXTJS CONFIGURATION
 * Optimized: 2026-09-06T08:30:00Z
 * Note: Incremental timestamp to force clear webpack cache during Studio boot.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Ensure development source maps are handled cleanly
  productionBrowserSourceMaps: false,
};

export default nextConfig;
