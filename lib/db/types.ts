// 数据层契约。上层只依赖这些类型与 OffNavStore 接口，
// 不关心底下是 CloudBase PostgREST 还是直连 PG——实现可换。
import type { SearchResult } from "../zhihu/types";

export type CachedSearch = {
  queryHash: string;
  query: string;
  payload: SearchResult;
  fetchedAt: number;
};

export type UserRow = {
  id: string;
  zhihuUid: string; // int64 超 JS 安全整数，必须字符串
  hashId: string;
  fullname: string;
  avatar: string;
  createdAt: number;
};

export type UserInput = Omit<UserRow, "id" | "createdAt">;

export type SessionRow = {
  id: string;
  userId: string;
  oauthToken: string;
  expiresAt: number;
};

export type OAuthStateRow = {
  state: string;
  sessionHint: string;
  expiresAt: number;
};

export type NavResultRow = {
  id: string;
  userId: string | null;
  kind: "nav" | "compare" | "match";
  input: string;
  result: unknown;
  createdAt: number;
};

export interface OffNavStore {
  getCachedSearch(hash: string): Promise<CachedSearch | null>;
  putCachedSearch(row: CachedSearch): Promise<void>;

  upsertUser(u: UserInput): Promise<UserRow>;
  getUser(id: string): Promise<UserRow | null>;

  createSession(s: SessionRow): Promise<void>;
  getSession(id: string): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<void>;

  putOAuthState(s: OAuthStateRow): Promise<void>;
  consumeOAuthState(state: string): Promise<OAuthStateRow | null>;

  putNavResult(row: NavResultRow): Promise<void>;
  getNavResult(id: string): Promise<NavResultRow | null>;
}
