
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Your existing Next.js configuration
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Add the allowedDevOrigins configuration below
  experimental: {
    allowedDevOrigins: [
        "https://*.cluster-c3a7z3wnwzapkx3rfr5kz62dac.cloudworkstations.dev"
    ]
  },
};

export default nextConfig;
