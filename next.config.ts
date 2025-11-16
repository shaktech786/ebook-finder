import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        pathname: '/b/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gutenberg.org',
        pathname: '/cache/**',
      },
      {
        protocol: 'http',
        hostname: 'libgen.is',
        pathname: '/covers/**',
      },
      {
        protocol: 'http',
        hostname: 'libgen.rs',
        pathname: '/covers/**',
      },
      {
        protocol: 'http',
        hostname: 'libgen.st',
        pathname: '/covers/**',
      },
      {
        protocol: 'https',
        hostname: 'libgen.ac',
        pathname: '/covers/**',
      },
      {
        protocol: 'https',
        hostname: 'libgen.li',
        pathname: '/covers/**',
      },
      {
        protocol: 'https',
        hostname: 'libgen.gs',
        pathname: '/covers/**',
      },
      {
        protocol: 'https',
        hostname: 'archive.org',
        pathname: '/services/**',
      },
    ],
  },
};

export default nextConfig;
