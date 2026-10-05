import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        path: false,
        util: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
