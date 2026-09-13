// 发起授权：生成密码学安全 state，存库绑会话，跳转知乎授权页。
import { NextRequest } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/zhihu/oauth";
import { getStore } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_TTL_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  // sessionHint 用于把本次登录请求绑到当前浏览器，防跨会话复用。
  const existing = req.cookies.get("offnav_hint")?.value;
  const hint = existing || randomUUID();
  const state = randomBytes(32).toString("base64url");

  try {
    await getStore().putOAuthState({ state, sessionHint: hint, expiresAt: Date.now() + STATE_TTL_MS });
    const url = buildAuthorizeUrl(state);
    const res = Response.redirect(url, 302);
    const out = new Response(res.body, res);
    if (!existing) {
      out.headers.append(
        "Set-Cookie",
        `offnav_hint=${hint}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_MS / 1000}`
      );
    }
    return out;
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
