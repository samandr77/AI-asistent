/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Read markdown files from ../legal at build time.
    outputFileTracingIncludes: {
      "/privacy": ["../legal/**"],
      "/terms": ["../legal/**"],
    },
  },
};

module.exports = nextConfig;
