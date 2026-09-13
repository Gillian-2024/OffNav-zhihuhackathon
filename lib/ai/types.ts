// 共享类型：SSE + analytics 环境。
export type SendFn = (data: unknown) => void;
export type EndFn = () => void;

export type AnalyticsEnv = {
  NODE_ENV?: string;
};
