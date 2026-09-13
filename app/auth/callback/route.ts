// 回调：state 存在时校验（存在、未过期、未消费、绑定同一浏览器）；
// state 缺失时按官方黑客松资料记录的实测行为放行（回调可能不返回 state，
// 且没有 PKCE/CSRF 保障）——只记录一条日志，不能借口"没有 state"就拒绝真实登录。
// 错误 state（存在但不匹配/过期/已消费）必须继续拒绝，不能被"缺失"分支误伤。
// 纯服务端跳转，不依赖前端状态。
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { exchangeCodeForToken, fetchZhihuUser, matchesSessionHint } from "@/lib/zhihu/oauth";
import { getStore } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

// Response.redirect 要求绝对 URL（WHATWG fetch 规范，相对路径会直接抛
// TypeError:Invalid URL）——用请求自身的 origin 拼成绝对地址再跳转。
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;

  function fail(reason: string) {
    return Response.redirect(`${origin}/?login_error=${encodeURIComponent(reason)}`, 302);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("authorization_code") || url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return fail("回调参数不完整");

  const store = getStore();

  if (state) {
    // 原子消费：过期、不存在、已用过都返回 null。
    const st = await store.consumeOAuthState(state);
    if (!st) return fail("登录请求已失效，请重新登录");

    const hint = req.cookies.get("offnav_hint")?.value;
    if (!matchesSessionHint(hint, st.sessionHint)) return fail("登录请求与当前浏览器不匹配");
  } else {
    // 已知协议缺口：实测回调可能不返回 state，不能借此拒绝真实登录。
    console.warn("[auth/callback] 回调未带 state，跳过 CSRF 绑定校验（已知协议缺口）");
  }

  try {
    const { accessToken } = await exchangeCodeForToken(code);
    const profile = await fetchZhihuUser(accessToken);

    const user = await store.upsertUser({
      zhihuUid: profile.uid,
      hashId: profile.hashId,
      fullname: profile.fullname,
      avatar: profile.avatar,
    });

    const sid = randomUUID();
    await store.createSession({ id: sid, userId: user.id, oauthToken: accessToken, expiresAt: Date.now() + SESSION_TTL_MS });

    const res = Response.redirect(`${origin}/?login=ok`, 302);
    const out = new Response(res.body, res);
    // OAuth token 只留服务端；浏览器只拿随机会话标识。
    out.headers.append(
      "Set-Cookie",
      `offnav_session=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
    );
    return out;
  } catch (e) {
    console.error("[auth/callback]", (e as Error).message);
    return fail("授权失败，请重试");
  }
}
