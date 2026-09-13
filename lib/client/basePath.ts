// 部署在子路径（云函数挂 /offnav）时的路径处理。
//
// 网关的行为（实测）：把 /offnav/xxx 转发给函数时**剥掉** /offnav 前缀，
// 函数内部看到的是 /xxx。所以：
//   - API 请求（fetch）不加前缀——浏览器发 /api/nav，网关转成函数看到的 /api/nav。
//     等等，浏览器是在 /offnav/ 页面里发的相对请求，所以要带前缀才能命中网关路由。
//   - 静态图片同理，浏览器直接请求，必须带前缀。
// 结论：浏览器侧发出的一切请求都要带前缀；Next 自己的 _next 资源由 assetPrefix 处理。
//
// NEXT_PUBLIC_ 前缀是必需的：客户端代码只能读到以此开头的环境变量。
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function withBase(path: string): string {
  if (!BASE) return path;
  return path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;
}
