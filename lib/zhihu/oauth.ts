// 知乎黑客松 OAuth。App ID / App Key 在提交项目时自动生成，
// 开发期用 Mock 测通契约，凭证到手后只需填 .env。
const AUTHORIZE = "https://openapi.zhihu.com/authorize";
const TOKEN = "https://openapi.zhihu.com/access_token";
const USERINFO = "https://openapi.zhihu.com/user";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少 ${name}，请配置环境变量`);
  return v;
}

export function buildAuthorizeUrl(state: string): string {
  const appId = need("ZHIHU_OAUTH_APP_ID");
  const redirect = need("ZHIHU_OAUTH_REDIRECT_URI");
  const u = new URL(AUTHORIZE);
  u.searchParams.set("app_id", appId);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string }> {
  const appId = need("ZHIHU_OAUTH_APP_ID");
  const appKey = need("ZHIHU_OAUTH_APP_KEY");
  const redirect = need("ZHIHU_OAUTH_REDIRECT_URI");

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appKey, code, grant_type: "authorization_code", redirect_uri: redirect }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  const token = body?.access_token;
  if (!token) {
    throw new Error(`换取 access_token 失败：${JSON.stringify(body).slice(0, 200)}`);
  }
  return { accessToken: String(token) };
}

// uid 是 int64，超出 JS 安全整数范围。
// 必须在解析阶段就把它当字符串处理，不能先 JSON.parse 成 Number 再 String()。
export function parseUidLossless(rawJson: string): string {
  const m = rawJson.match(/"uid"\s*:\s*"?(\d+)"?/);
  if (!m) throw new Error("响应里没有 uid");
  return m[1];
}

export async function fetchZhihuUser(accessToken: string): Promise<{
  uid: string; hashId: string; fullname: string; avatar: string;
}> {
  const res = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });

  const raw = await res.text();
  // 不能只凭 HTTP 200 判断成功：历史上用户不存在返回 200 + {"code":404}。
  const uid = parseUidLossless(raw);
  const parsed = JSON.parse(raw);
  if (parsed?.code && parsed.code !== 20000 && parsed.code !== 0) {
    throw new Error(`获取用户信息失败：code=${parsed.code}`);
  }

  return {
    uid,
    hashId: String(parsed.hash_id ?? ""),
    fullname: String(parsed.fullname ?? ""),
    avatar: String(parsed.avatar_path ?? ""),
  };
}
