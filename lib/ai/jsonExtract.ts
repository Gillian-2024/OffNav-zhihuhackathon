// 从模型文本输出抽取 JSON 并用 zod schema 校验。移植自 server/src/utils/jsonExtract.js
const MAX_RETRY_ATTEMPTS = 1;

function cleanForJson(text: string): string {
  let c = text.trim();

  // 1. 去掉 markdown 代码块围栏 ```json ... ``` 或 ``` ... ```
  const fence = c.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) c = fence[1].trim();

  // 2. 截取最外层 { ... } 或 [ ... ]（去掉 JSON 前后的解释性文字）
  const start = c.search(/[[{]/);
  if (start > 0) c = c.slice(start);
  const lastBrace = Math.max(c.lastIndexOf('}'), c.lastIndexOf(']'));
  if (lastBrace > -1 && lastBrace < c.length - 1) {
    c = c.slice(0, lastBrace + 1);
  }

  // 3. 容错：去掉尾随逗号
  c = c.replace(/,(\s*[}\]])/g, '$1');
  return c;
}

function likelyNotJson(text: string): boolean {
  return !text.includes('{') && !text.includes('[');
}

// 从模型文本输出里抽出 JSON 并用 zod schema 校验。
// 失败时最多重试一次，应对模型偶尔输出格式不稳。
export function extractAndParse(text: string, schema: any, maxRetries = MAX_RETRY_ATTEMPTS): any {
  if (!text || !text.trim()) {
    throw new Error('模型返回空文本，无法解析为 JSON');
  }

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const cleaned = cleanForJson(text);
      const parsed = JSON.parse(cleaned);
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error;
    } catch (e) {
      lastError = e;
    }
    if (attempt === 0) {
      if (likelyNotJson(text)) {
        break; // 无需重试 — 第二次也只会再收到同一条自然语言
      }
      const braceStart = text.indexOf('{');
      const bracketStart = text.indexOf('[');
      const firstBrace = braceStart >= 0 ? (bracketStart >= 0 ? Math.min(braceStart, bracketStart) : braceStart) : bracketStart;
      if (firstBrace >= 0) {
        const closeIdx = Math.max(
          text.lastIndexOf('}', firstBrace + 2000),
          text.lastIndexOf(']', firstBrace + 2000)
        );
        if (closeIdx > firstBrace) text = text.slice(firstBrace, closeIdx + 1);
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  const issues = lastError?.issues
    ? lastError.issues.map((i: any) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    : null;
  throw new Error(
    issues
      ? `Schema 校验失败 (${maxRetries + 1} 次尝试):\n${issues}\n--- 模型原始输出(前 600 字) ---\n${text.slice(0, 600)}`
      : `JSON 解析失败 (${maxRetries + 1} 次尝试):\n${msg}\n--- 模型原始输出(前 600 字) ---\n${text.slice(0, 600)}`
  );
}
