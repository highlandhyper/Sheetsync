import type { NextConfig } from 'next';

/**
 * NEXTJS CONFIGURATION
 * Optimized: 2026-09-06T08:35:00Z
 * Note: Forced refresh for Registry Compilation.
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
  // Ensure development source maps are handled cleanly and resolve ENOENT errors
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer }) => {
    // Optimization to handle source map issues in restricted environments
    if (!isServer) {
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;
