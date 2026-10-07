/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  agentRules: false,
  devIndicators: false,
  logging: { incomingRequests: false },
};

export default nextConfig;
