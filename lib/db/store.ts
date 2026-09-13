// 单例选择器：配了 CloudBase 凭证走 PostgREST，否则回退进程内实现。
// 回退让本地开发和 CI 无需数据库即可跑通全部业务逻辑。
import type { OffNavStore } from "./types";
import { createMemoryStore } from "./memory";
import { createPostgrestStore } from "./postgrest";

let cached: OffNavStore | null = null;

export function getStore(): OffNavStore {
  if (cached) return cached;
  const usePg = Boolean(process.env.CLOUDBASE_SERVER_API_KEY && process.env.CLOUDBASE_API_BASE);
  cached = usePg ? createPostgrestStore() : createMemoryStore();
  if (!usePg) console.warn("[store] 未配置 CloudBase 凭证，使用进程内存储（重启即丢）");
  return cached;
}

export type { OffNavStore } from "./types";
