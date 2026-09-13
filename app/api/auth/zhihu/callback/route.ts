// 旧回调路径的兼容重定向。官方登记的回调路径已改为 /auth/callback，
// 这里只做 302 转发（保留全部 query 参数），避免旧配置或缓存链接失效。
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // 不能用 req.url 的 origin：云函数监听 9000 端口，网关转发时把它带进来，
  // 拼出的跳转地址会被浏览器按受限端口拒绝。已登记的回调地址是确定的对外地址。
  const registered = process.env.ZHIHU_OAUTH_REDIRECT_URI;
  let target: URL;
  try {
    target = new URL(registered!);
  } catch {
    target = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/auth/callback`, url.origin);
  }
  target.search = url.search;
  return Response.redirect(target.toString(), 302);
}
