import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.openlibrary.org',
      },
      {
        protocol: 'https',
        hostname: '**.gutenberg.org',
      },
      {
        protocol: 'http',
        hostname: 'libgen.is',
      },
      {
        protocol: 'https',
        hostname: 'libgen.is',
      },
      {
        protocol: 'http',
        hostname: 'libgen.rs',
      },
      {
        protocol: 'https',
        hostname: 'libgen.rs',
      },
      {
        protocol: 'http',
        hostname: 'libgen.st',
      },
      {
        protocol: 'https',
        hostname: 'libgen.st',
      },
      {
        protocol: 'https',
        hostname: 'libgen.ac',
      },
      {
        protocol: 'https',
        hostname: 'libgen.li',
      },
      {
        protocol: 'https',
        hostname: 'libgen.gs',
      },
      {
        protocol: 'http',
        hostname: 'library.lol',
      },
      {
        protocol: 'https',
        hostname: 'library.lol',
      },
      {
        protocol: 'https',
        hostname: '**.archive.org',
      },
      {
        protocol: 'http',
        hostname: '**.archive.org',
      },
    ],
  },
};

export default nextConfig;
