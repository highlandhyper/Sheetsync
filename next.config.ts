
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // For client-side bundles, provide fallbacks for Node.js core modules
    // that are not available in the browser. This helps prevent errors when
    // server-side libraries (like googleapis or google-auth-library)
    // are indirectly pulled into the client bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}), // Ensure fallback object exists and spread it
        net: false, // 'net' module is not available in the browser
        tls: false, // 'tls' module is not available in the browser
        fs: false,  // 'fs' module is not available in the browser
        child_process: false, // 'child_process' is not available
        http2: false, // 'http2' is not available
        events: false, // 'events' module fallback
        'node:events': false, // Fallback for 'node:events'
        'node:process': false, // Fallback for 'node:process'
      };

      // Add IgnorePlugin for 'node:events' and 'node:process' as fallbacks might not be sufficient
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(node:events|node:process)$/,
        })
      );
    }

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
