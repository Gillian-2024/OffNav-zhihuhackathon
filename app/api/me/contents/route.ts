// 代理知乎「用户内容」接口：GET /api/v1/user/contents。
// OAuth token 只从服务端会话读取，绝不接受前端传入、绝不回传给浏览器。
import { NextRequest } from "next/server";
import { getStore } from "@/lib/db/store";
import { callUserApi, clampPaging } from "@/lib/zhihu/userApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("offnav_session")?.value;
  if (!sid) return Response.json({ error: "未登录" }, { status: 401 });

  const session = await getStore().getSession(sid);
  if (!session) return Response.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { Offset, Limit } = clampPaging(searchParams);
  const ContentType = searchParams.get("ContentType") || "all";

  const result = await callUserApi(
    "/api/v1/user/contents",
    { ContentType, Offset, Limit },
    session.oauthToken
  );

  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json(result.data);
}
