// 进程内实现：让全部业务逻辑无需数据库即可开发与测试。
// 未配 CloudBase 凭证时 getStore() 自动回退到这里。
import type {
  OffNavStore, CachedSearch, UserRow, UserInput, SessionRow, OAuthStateRow, NavResultRow,
} from "./types";

export function createMemoryStore(): OffNavStore {
  const cache = new Map<string, CachedSearch>();
  const users = new Map<string, UserRow>(); // key = zhihuUid
  const sessions = new Map<string, SessionRow>();
  const states = new Map<string, OAuthStateRow>();
  const results = new Map<string, NavResultRow>();
  let seq = 0;

  return {
    async getCachedSearch(hash) {
      return cache.get(hash) ?? null;
    },
    async putCachedSearch(row) {
      cache.set(row.queryHash, row);
    },

    async upsertUser(u) {
      const existing = users.get(u.zhihuUid);
      const row: UserRow = existing
        ? { ...existing, ...u }
        : { id: `u${++seq}`, createdAt: Date.now(), ...u };
      users.set(u.zhihuUid, row);
      return row;
    },
    // users 以 zhihuUid 为 key，按 id 查需要遍历；用户数量小，进程内实现无需索引。
    async getUser(id) {
      for (const row of users.values()) if (row.id === id) return row;
      return null;
    },

    async createSession(s) {
      sessions.set(s.id, s);
    },
    async getSession(id) {
      const s = sessions.get(id);
      if (!s) return null;
      if (s.expiresAt <= Date.now()) {
        sessions.delete(id);
        return null;
      }
      return s;
    },
    async deleteSession(id) {
      sessions.delete(id);
    },

    async putOAuthState(s) {
      states.set(s.state, s);
    },
    // 原子消费：取出即删，防重复回调复用。
    async consumeOAuthState(state) {
      const s = states.get(state);
      if (!s) return null;
      states.delete(state);
      if (s.expiresAt <= Date.now()) return null;
      return s;
    },

    async putNavResult(row) {
      results.set(row.id, row);
    },
    async getNavResult(id) {
      return results.get(id) ?? null;
    },
  };
}
