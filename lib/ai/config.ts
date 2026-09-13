// 模型配置解析。移植自 server/src/utils/config.js，适配 Next（headers 而非 Express req）。
// Next 由 .env.local 注入 env；此处在 process.env 上读取，默认 provider 走知乎直答（额度耗尽时降级到智谱）。
// ⚠️ BYOK 全有或全无：仅当客户端自带 x-api-key 时才信任 x-base-url 自定义，
//    否则一律走服务端 profile 的 baseUrl——防止攻击者只传 x-base-url,
//    把服务端自己的 API Key 发送到其控制的域名（密钥走私）。

import type { ProviderCfg } from "./providers";

export type ResolveInput = {
  get: (key: string) => string | null;
};

const ENV_PROFILES: Record<string, { apiKey: string; baseUrl: string; model: string }> = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    model: process.env.ANTHROPIC_MODEL || "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "",
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: "https://api.deepseek.com",
    model: "",
  },
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY || "",
    baseUrl: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    model: process.env.ZHIPU_MODEL || "glm-5.2",
  },
  zhihu: {
    apiKey: process.env.ZHIHU_ACCESS_SECRET || "",
    baseUrl: "https://developer.zhihu.com/v1",
    model: process.env.ZHIHU_ZHIDA_MODEL || "zhida-fast-1p5",
  },
};

// 从请求解析最终模型配置：header 透传 > .env 默认
export function resolveConfig(input: ResolveInput): ProviderCfg {
  const provider = input.get("x-provider") || process.env.DEFAULT_PROVIDER || "zhihu";
  const profile = ENV_PROFILES[provider] || {};
  const byokKey = input.get("x-api-key");
  const modelFromHeader = input.get("x-model");

  return {
    provider,
    apiKey: byokKey || profile.apiKey || "",
    // 若带 x-base-url（自定义网关）但缺 x-api-key → 视为攻击面，仍走服务端 profile url
    baseUrl: byokKey ? input.get("x-base-url") || profile.baseUrl : profile.baseUrl,
    model: modelFromHeader || profile.model,
  };
}
