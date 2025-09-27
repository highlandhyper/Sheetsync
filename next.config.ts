require('dotenv').config();
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  compiler: {
    // Remove React strict mode to prevent double rendering in development
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Remove devIndicators as it's deprecated
  // The development badge is automatically hidden in production builds
  // No need to configure it explicitly
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        net: false,
        tls: false,
        fs: false,
        child_process: false,
        http2: false,
        'node:util': false,
      };
      
      // Only force NODE_ENV to production when NOT in development.
      // This fixes the 'Conflicting values for process.env.NODE_ENV' error.
      if (!dev) {
        config.plugins.push(
          new (require('webpack').DefinePlugin)({
            'process.env.NODE_ENV': JSON.stringify('production')
          })
        );
      }
    }
    return config;
  },
};

export default nextConfig;
