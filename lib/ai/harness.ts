// Harness：抽跨路由重复的公共片段。
import { getProvider } from "./providers";
import { resolveConfig } from "./config";
import { schemaShape } from "./schemaShape";
import type { SendFn, EndFn } from "./types";

// 拿 provider：成功返回 { cfg, model }；缺 key/model 时 throw，调用方 catch 后 400。
export function getModel(headers: Record<string, string | null>) {
  const cfg = resolveConfig({ get: (k) => headers[k] ?? null });
  return { cfg, model: getProvider(cfg) };
}

// 拼 schema 输出指令（三条分析链共用）。
export function buildSchemaSection(schema: any): string {
  return `【输出格式 —— 必须严格遵守】
直接输出一个 JSON 对象，严格符合下面的结构（字段名、嵌套层级、数组/对象/标量类型都要匹配）。
不要输出 markdown 代码块标记，不要任何解释性文字，不要在 JSON 之外添加任何内容。
数组没有元素就输出 []，字符串没有内容就输出空字符串 ""。
下面 // 后面是字段说明，实际输出时不要带 // 注释：
${schemaShape(schema)}`;
}

// SSE 错误兜底：send error + end。
export function failSSE(send: SendFn, end: EndFn, e: Error, endpoint: string, capability?: string) {
  console.error(`[${endpoint}]${capability ? ` [${capability}]` : ""} error:`, e.message);
  send({ type: "error", message: e.message || String(e) });
  end();
}
