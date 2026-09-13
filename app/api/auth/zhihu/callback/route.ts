// 旧回调路径的兼容重定向。官方登记的回调路径已改为 /auth/callback，
// 这里只做 302 转发（保留全部 query 参数），避免旧配置或缓存链接失效。
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL("/auth/callback", url.origin);
  target.search = url.search;
  return Response.redirect(target.toString(), 302);
}
