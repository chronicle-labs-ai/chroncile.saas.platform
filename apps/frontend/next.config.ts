import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["ui", "platform-api", "plans"],
};

export default nextConfig;
