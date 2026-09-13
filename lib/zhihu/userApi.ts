// 代表已登录用户调用知乎用户数据 API（创作内容、关注列表）。
// 契约来自 user-api.md：三个 Header 缺一不可——
// Authorization 是开放平台 Access Secret（鉴权调用方，不是用户身份），
// X-OAuth-Token 才是当前登录用户的 OAuth token（只能来自服务端会话，绝不能来自前端），
// X-Request-Timestamp 是秒级时间戳。
const BASE = "https://developer.zhihu.com";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少 ${name}，请配置环境变量`);
  return v;
}

function authHeaders(oauthToken: string): Record<string, string> {
  const secret = need("ZHIHU_ACCESS_SECRET");
  return {
    Authorization: `Bearer ${secret}`,
    "X-OAuth-Token": oauthToken,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    Accept: "application/json",
  };
}

export type UserApiResult = { ok: true; data: any } | { ok: false; status: number; message: string };

// 通用 GET：path 形如 "/api/v1/user/contents"，query 是已校验/裁剪过的参数。
export async function callUserApi(
  path: string,
  query: Record<string, string>,
  oauthToken: string
): Promise<UserApiResult> {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(u.toString(), { headers: authHeaders(oauthToken), cache: "no-store" });
  } catch (e) {
    return { ok: false, status: 502, message: `网络失败: ${(e as Error).message}` };
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: 502, message: "响应不是合法 JSON" };
  }

  // 同时检查 HTTP 状态和业务 Code，不能只凭 HTTP 200 判断成功（user-api.md）。
  if (!res.ok || body?.Code !== 0) {
    return {
      ok: false,
      status: res.ok ? 502 : res.status,
      message: `Code=${body?.Code} ${body?.Message ?? ""}`.trim(),
    };
  }

  return { ok: true, data: body.Data };
}

// Offset/Limit 分页参数裁剪：Limit 最大 50，Offset 非负整数，非法值回退默认值。
export function clampPaging(searchParams: URLSearchParams): { Offset: string; Limit: string } {
  const rawOffset = Number(searchParams.get("Offset"));
  const rawLimit = Number(searchParams.get("Limit"));
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 20;
  return { Offset: String(offset), Limit: String(limit) };
}
