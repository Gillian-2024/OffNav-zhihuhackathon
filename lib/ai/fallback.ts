// 直答额度只有 100/天（每租户每自然日，所有访客共享）。
// 撞额度时降级到 claude（Anthropic 协议，可指向兼容中转站），并让调用方能把这件事告诉用户，而不是静默换模型。
import { generateText } from "ai";
import { getProvider } from "./providers";
import { resolveConfig } from "./config";

const FALLBACK_PROVIDER = "claude";

// 判断是否为额度/限流类错误。知乎业务码 30001=频率或日限、30002=成功次数上限；
// HTTP 429 与文案兜底覆盖 SDK 包装后的形态。
export function isQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /\b429\b/.test(msg) ||
    /"?Code"?\s*[:=]\s*3000[12]/.test(msg) ||
    /rate limit|quota|额度|频率/i.test(msg)
  );
}

export type GenOutcome = { text: string; provider: string; degraded: boolean };

// 先用请求指定（默认直答）的 provider；撞额度则换 FALLBACK_PROVIDER 重试一次。
// 只重试一次，且只对额度类错误重试——其他错误直接抛，不掩盖真问题。
export async function generateWithFallback(args: {
  headers: Record<string, string | null>;
  system: string;
  prompt: string;
}): Promise<GenOutcome> {
  const { headers, system, prompt } = args;
  const primary = resolveConfig({ get: (k) => headers[k] ?? null });

  try {
    const { text } = await generateText({ model: getProvider(primary), system, prompt });
    return { text, provider: primary.provider, degraded: false };
  } catch (e) {
    if (!isQuotaError(e) || primary.provider === FALLBACK_PROVIDER) throw e;

    console.warn(`[fallback] ${primary.provider} 额度受限，降级到 ${FALLBACK_PROVIDER}`);
    const backup = resolveConfig({
      get: (k) => (k === "x-provider" ? FALLBACK_PROVIDER : k === "x-model" ? null : headers[k] ?? null),
    });
    const { text } = await generateText({ model: getProvider(backup), system, prompt });
    return { text, provider: backup.provider, degraded: true };
  }
}
