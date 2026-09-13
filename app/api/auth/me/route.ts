// 当前登录用户。未登录返回 { user: null } 而非 401——前端据此决定显示登录按钮。
import { NextRequest } from "next/server";
import { getStore } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("offnav_session")?.value;
  if (!sid) return Response.json({ user: null });

  const s = await getStore().getSession(sid);
  if (!s) return Response.json({ user: null });

  // 只回前端需要的展示字段，绝不回 oauthToken。
  return Response.json({ user: { id: s.userId } });
}
