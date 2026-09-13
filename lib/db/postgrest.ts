// CloudBase 关系型数据库 REST（PostgREST 风格）实现。
// 服务端专用：CLOUDBASE_SERVER_API_KEY 是管理员权限凭证，绝不可进客户端代码。
//
// 查证状态（2026-09-13，诚实记录，供后续任务参考）：
// - 已确认：网关 host `https://offnav-2026-d6gvnsynj3c561411.api.tcloudbasegateway.com`、
//   路径前缀 `/v1/rdb/rest/{table}`、鉴权 `Authorization: Bearer <key>` 均正确——
//   带合法 key 的 `GET .../v1/rdb/rest/zhihu_search_cache?limit=1` 返回 404 Not Found，
//   不带鉴权头返回 401 `{"code":"MISSING_CREDENTIALS"}`。二者对比说明 401 是鉴权层拦截，
//   证明 host/前缀/auth 都对；404 极可能是表尚未建（schema.sql 尚未在控制台执行），
//   但也不能排除路径形状本身有出入——建表前无法区分这两种可能。
// - 未确认（待建表后用真实请求验证）：单行过滤语法（`?col=eq.value` 是否原样支持）、
//   upsert 写法（`Prefer: resolution=merge-duplicates` 是否生效，以及能否与
//   `return=representation` 逗号组合成一个 Prefer 头一起生效）、返回体形状
//   （裸数组 vs `{ data: [...] }` 包裹）、表名是否需要 schema 前缀、PATCH 命中零行
//   时网关返回的是 200+空数组（PostgREST 标准行为）还是 404（见 consumeOAuthState
//   内注释与兜底处理）。
// - 本文件按 PostgREST 标准惯例实现，未对 CloudBase 网关做任何真实调用验证
//   （避免在表不存在时用无意义的 404 消耗查证机会）。`pickRow` 保留对两种返回体
//   形状的兼容，等真实验证后再收窄为其中一种。
import type {
  OffNavStore, UserRow, UserInput, SessionRow, OAuthStateRow, NavResultRow, CachedSearch,
} from "./types";

const BASE = process.env.CLOUDBASE_API_BASE || "";
const KEY = process.env.CLOUDBASE_SERVER_API_KEY || "";

function rdbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!KEY) throw new Error("缺少 CLOUDBASE_SERVER_API_KEY");
  return {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
}

async function rdb(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE}/v1/rdb/rest/${path}`, {
    ...init,
    headers: rdbHeaders(init.headers as Record<string, string>),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CloudBase RDB ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// 兼容两种返回体形状：裸数组 或 { data: [...] }。查证后可收窄为其中一种。
function pickRow(body: any): any | null {
  const rows = Array.isArray(body) ? body : body?.data;
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export function createPostgrestStore(): OffNavStore {
  return {
    async getCachedSearch(hash) {
      const r = pickRow(await rdb(`zhihu_search_cache?query_hash=eq.${encodeURIComponent(hash)}&limit=1`));
      if (!r) return null;
      return { queryHash: r.query_hash, query: r.query, payload: r.payload, fetchedAt: Number(r.fetched_at) };
    },
    async putCachedSearch(row) {
      await rdb("zhihu_search_cache", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          query_hash: row.queryHash,
          query: row.query,
          payload: row.payload,
          fetched_at: row.fetchedAt,
        }),
      });
    },

    async upsertUser(u: UserInput): Promise<UserRow> {
      const id = `u_${u.zhihuUid}`;
      const createdAt = Date.now();
      // merge-duplicates + return=representation：PostgREST 惯例可用逗号组合两个
      // Prefer 指令一次声明；组合写法本身未对 CloudBase 网关验证过。目的是让更新
      // 时也能拿到服务端存的真实行（尤其 created_at），而不是用本地 Date.now() 冒充。
      const body = await rdb("users", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          id,
          zhihu_uid: u.zhihuUid,
          hash_id: u.hashId,
          fullname: u.fullname,
          avatar: u.avatar,
          created_at: createdAt,
        }),
      });
      const r = pickRow(body);
      if (r) {
        return {
          id: r.id, zhihuUid: r.zhihu_uid, hashId: r.hash_id,
          fullname: r.fullname, avatar: r.avatar, createdAt: Number(r.created_at),
        };
      }
      // 响应没带回行（未确认网关是否支持 return=representation）时，退回本地拼装值。
      return { id, createdAt, ...u };
    },

    async createSession(s) {
      await rdb("sessions", {
        method: "POST",
        body: JSON.stringify({ id: s.id, user_id: s.userId, oauth_token: s.oauthToken, expires_at: s.expiresAt }),
      });
    },
    async getSession(id) {
      const r = pickRow(await rdb(`sessions?id=eq.${encodeURIComponent(id)}&limit=1`));
      if (!r || Number(r.expires_at) <= Date.now()) return null;
      return { id: r.id, userId: r.user_id, oauthToken: r.oauth_token, expiresAt: Number(r.expires_at) };
    },
    async deleteSession(id) {
      await rdb(`sessions?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    async putOAuthState(s) {
      await rdb("oauth_states", {
        method: "POST",
        body: JSON.stringify({ state: s.state, session_hint: s.sessionHint, expires_at: s.expiresAt }),
      });
    },
    // 原子消费：条件更新 consumed_at is null，靠返回行判断是否抢到。
    // 风险未查证：PATCH 匹配零行（state 已被消费/不存在）时，CloudBase 网关
    // 到底是像标准 PostgREST 一样返回 200 + 空数组，还是返回 404。若是 404，
    // rdb() 会 throw，下面必须兜底为 null（防重放场景应失败关闭，不应让登录流程崩）；
    // 一旦建表可验证，若确认是 200+空数组，这段 catch 可以简化但不需要删除
    // （多一层防御无害）。真正的 5xx/鉴权失败必须继续往外抛，不能被这里吞掉。
    async consumeOAuthState(state) {
      let body: any;
      try {
        body = await rdb(
          `oauth_states?state=eq.${encodeURIComponent(state)}&consumed_at=is.null`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ consumed_at: Date.now() }),
          }
        );
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        // rdb() 的错误信息形如 "CloudBase RDB 404: ...”——只吞未命中类状态码。
        if (/CloudBase RDB 404:/.test(msg)) return null;
        throw err;
      }
      const r = pickRow(body);
      if (!r || Number(r.expires_at) <= Date.now()) return null;
      return { state: r.state, sessionHint: r.session_hint, expiresAt: Number(r.expires_at) };
    },

    async putNavResult(row) {
      await rdb("nav_results", {
        method: "POST",
        body: JSON.stringify({
          id: row.id,
          user_id: row.userId,
          kind: row.kind,
          input: row.input,
          result: row.result,
          created_at: row.createdAt,
        }),
      });
    },
    async getNavResult(id) {
      const r = pickRow(await rdb(`nav_results?id=eq.${encodeURIComponent(id)}&limit=1`));
      if (!r) return null;
      return {
        id: r.id, userId: r.user_id, kind: r.kind,
        input: r.input, result: r.result, createdAt: Number(r.created_at),
      };
    },
  };
}
