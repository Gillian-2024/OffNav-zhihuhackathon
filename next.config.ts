import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 云函数网关把服务挂在 /offnav 下，但转发给函数时**已经剥掉该前缀**
  // （实测：/offnav/offnav/ 返回 308，说明 Next 内部看到的是根路径）。
  // 所以不能用 basePath——那会让 Next 期待 /offnav/ 而网关只给 /，页面直接 404。
  // 正解是只给静态资源加前缀：路由按根路径匹配，浏览器请求资源时带上前缀。
  ...(process.env.NEXT_ASSET_PREFIX ? { assetPrefix: process.env.NEXT_ASSET_PREFIX } : {}),
  // standalone 只给自建容器用（CloudBase 云托管 / Docker）。
  // Vercel 自己处理打包，设了 standalone 反而干扰它，所以按环境变量切换。
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
