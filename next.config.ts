import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone 只给自建容器用（CloudBase 云托管 / Docker）。
  // Vercel 自己处理打包，设了 standalone 反而干扰它，所以按环境变量切换。
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
