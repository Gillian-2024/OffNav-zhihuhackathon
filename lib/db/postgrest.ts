// CloudBase 关系型数据库 REST（PostgREST 风格）实现。
// 服务端专用：CLOUDBASE_SERVER_API_KEY 是管理员权限凭证，绝不可进客户端代码。
//
// 查证状态（2026-09-13 第二次复审更新，诚实记录，供后续任务参考）：
// - 已确认：网关 host 是 `https://offnav-2026-d6gvnsynj3c561411.api.intl.tcloudbasegateway.com`
//   （环境实际在 ap-singapore，国际地域需要 `.intl.` 段；此前注释里写的
//   `api.tcloudbasegateway.com`（缺 `.intl.`，对应 ap-shanghai）是错的，已改正；
//   代码本身从 `process.env.CLOUDBASE_API_BASE` 读取,无需改动，仅注释纠正）。
//   路径前缀 `/v1/rdb/rest/{table}`、鉴权 `Authorization: Bearer <key>` 均正确。
// - 已确认：成功读取返回**裸 JSON 数组**（如 `GET .../zhihu_search_cache?limit=1`
//   在表存在且无匹配行时返回 `HTTP 200 []`），不是 `{ data: [...] }` 包裹。
// - 已确认：五张表（users/sessions/oauth_states/zhihu_search_cache/nav_results）
//   已经建好，`schema.sql` 不会再被人工执行，现在是留档/灾难恢复用的参考文件。
// - 已确认：表不存在时返回 `HTTP 404`，body 形如
//   `{"code":"DATABASE_PGRST205","message":"Could not find the table '...' in the schema cache"}`
//   ——这与「PATCH 零匹配」很可能也是 404 的情况在 HTTP 状态码层面无法区分，
//   必须靠 body 里的 `PGRST205` 错误码区分（见 `classifyRdbError`）。
// - 仍未确认：单行过滤语法（`?col=eq.value`）、upsert 写法（`Prefer:
//   resolution=merge-duplicates` 及与 `return=representation` 逗号组合）在
//   实际写路径上的效果、表名是否需要 schema 前缀、PATCH 命中零行时网关到底
//   返回 200+空数组还是 404（`classifyRdbError` 对两种可能都做了兜底，但
//   哪种是实际行为仍未用真实写请求验证过）。
// - 本文件仍未对 CloudBase 网关发起任何真实调用来验证写路径（POST/PATCH），
//   仅根据已探测到的读路径响应形状调整了注释与 `pickRow`。
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
  // 写操作常见 201/204 且响应体为空（实测 CloudBase 的 POST 返回 201 + 零长度 body）。
  // 直接 res.json() 会在空 body 上抛 "Unexpected end of JSON input"——
  // 那个报错来自 undici 内部，堆栈里看不到本文件，极难定位，所以这里按文本读再判空。
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`CloudBase RDB ${res.status}: 响应不是合法 JSON: ${text.slice(0, 200)}`);
  }
}

// 裸数组是已确认的实际形状（`GET .../zhihu_search_cache?limit=1` 空表时返回
// `HTTP 200 []`）。仍保留对 { data: [...] } 包裹的兼容——无害，且写路径（POST/PATCH
// 的 return=representation）尚未做真实验证，不排除形状不同。
function pickRow(body: any): any | null {
  const rows = Array.isArray(body) ? body : body?.data;
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// 表不存在（PGRST205）是致命配置错误，必须抛出——
// 静默当成「state 未命中」会把建表遗漏变成「所有登录都被拒绝」且无任何诊断线索。
// 已确认的真实响应体形如：
//   `CloudBase RDB 404: {"code":"DATABASE_PGRST205","message":"Could not find the table '...' in the schema cache"}`
// 匹配错误码而非提示文字，因为文字可能被本地化，且 rdb() 把 body 截到 200 字符。
const TABLE_MISSING = /PGRST205|Could not find the table/i;

// 从 rdb() 抛出的 Error.message（形如 "CloudBase RDB <status>: <body前200字符>"）
// 分类：表不存在 / 疑似零匹配未命中 / 其它（5xx、鉴权失败等，必须继续往外抛）。
// 抽成纯函数是为了不依赖真实网络请求就能对失败关闭逻辑做单元测试。
export function classifyRdbError(msg: string): "table_missing" | "not_found" | "other" {
  if (TABLE_MISSING.test(msg)) return "table_missing";
  if (/CloudBase RDB 404:/.test(msg)) return "not_found";
  return "other";
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
    async getUser(id) {
      const r = pickRow(await rdb(`users?id=eq.${encodeURIComponent(id)}&limit=1`));
      if (!r) return null;
      return {
        id: r.id, zhihuUid: r.zhihu_uid, hashId: r.hash_id,
        fullname: r.fullname, avatar: r.avatar, createdAt: Number(r.created_at),
      };
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
    // 已确认：表不存在时报 404 + PGRST205（见文件顶部注释）。
    // 仍未确认：PATCH 匹配零行（state 已被消费/不存在）时，CloudBase 网关到底是
    // 像标准 PostgREST 一样返回 200 + 空数组，还是也返回 404——一旦是 404，
    // 它的响应体形状与「表不存在」的 404 长得不一样（没有 PGRST205），
    // classifyRdbError 靠这一点区分：table_missing 必须 rethrow（配置错误，
    // 不能被静默吃掉变成「所有登录被拒绝」且无诊断线索）；not_found 才失败关闭
    // 返回 null（防重放场景的正常路径）；other（5xx/鉴权失败）必须继续往外抛。
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
        const kind = classifyRdbError(msg);
        if (kind === "not_found") return null;
        throw err; // table_missing 或 other：都必须继续往外抛，不能吞
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
