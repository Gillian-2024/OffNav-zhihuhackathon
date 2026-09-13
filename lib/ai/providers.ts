// 统一 Provider 工厂。移植自 server/src/providers/index.js
// 依赖 @ai-sdk/openai-compatible + @ai-sdk/anthropic，已装。
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ProviderCfg = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

// 根据 cfg 返回 ai sdk 的 model 实例
export function getProvider(cfg: ProviderCfg): any {
  const { provider, apiKey, baseUrl, model } = cfg;
  if (!apiKey) {
    throw new Error(`Provider [${provider}] 缺少 API Key：请配置环境变量或在前端设置面板填入`);
  }
  if (!model) {
    throw new Error(`Provider [${provider}] 缺少 model`);
  }

  // Anthropic 协议（Claude）
  if (provider === "claude") {
    return createAnthropic({ apiKey, baseURL: baseUrl })(model);
  }

  // 知乎直答：OpenAI 兼容，但额外要求 X-Request-Timestamp（秒级）。
  // 这版 @ai-sdk/openai-compatible 的 headers 选项是静态对象，不支持函数式重取时间，
  // 所以用 fetch 选项包装：每次请求时才补上当前时间戳，而不是固化在模型实例创建时。
  if (provider === "zhihu") {
    return createOpenAICompatible({
      name: "zhihu",
      apiKey,
      baseURL: baseUrl,
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("X-Request-Timestamp", String(Math.floor(Date.now() / 1000)));
        return fetch(input, { ...init, headers });
      },
    })(model);
  }

  // 其余全部 OpenAI 兼容协议（含官方 OpenAI）
  return createOpenAICompatible({
    name: provider,
    apiKey,
    baseURL: baseUrl,
  })(model);
}
