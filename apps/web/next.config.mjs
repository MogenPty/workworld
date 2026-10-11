/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@workworld/simulation-core",
    "@workworld/career-systems",
    "@workworld/game-sdk",
    "@workworld/game-codeworks",
    "@workworld/persistence",
  ],
};

export default nextConfig;
