// 个人主页专用：实时拉取一句话介绍（headline）。
// 不落库（数据库五张表已建好，headline 不在既有 schema 里，不擅自 ALTER TABLE
// 改动生产表结构），只在访问 /me 页面时用当前会话的 OAuth token 现查现返。
// 走黑客松基础信息接口：只需 Authorization: Bearer <OAuth access_token>，
// 不需要 Access Secret 或 X-OAuth-Token（hackathon-user-profile-api.md）。
import { NextRequest } from "next/server";
import { getStore } from "@/lib/db/store";
import { fetchZhihuUser } from "@/lib/zhihu/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("offnav_session")?.value;
  if (!sid) return Response.json({ error: "未登录" }, { status: 401 });

  const session = await getStore().getSession(sid);
  if (!session) return Response.json({ error: "未登录" }, { status: 401 });

  try {
    const profile = await fetchZhihuUser(session.oauthToken);
    return Response.json({ fullname: profile.fullname, avatar: profile.avatar, headline: profile.headline });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
