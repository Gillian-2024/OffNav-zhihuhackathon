// 退出：删服务端会话映射并清 cookie。不做自动重登。
import { NextRequest } from "next/server";
import { getStore } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sid = req.cookies.get("offnav_session")?.value;
  if (sid) await getStore().deleteSession(sid);

  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", "offnav_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return res;
}
