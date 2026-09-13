// 用户内容边界工具：将原始文本包裹在 <user-content>...</user-content> 中，
// 配合 system prompt 铁律 #1 实现 prompt injection 防御。
// 遵循 OWASP LLM Prompt Injection Prevention Structured Prompt 模式。
// 移植自 server/src/utils/contentBoundary.js
const USER_CONTENT_OPEN = '<user-content>';
const USER_CONTENT_CLOSE = '</user-content>';
export const USER_CONTENT_TAG = `${USER_CONTENT_OPEN}${USER_CONTENT_CLOSE}`;

export function wrapUserContent(text: string): string {
  if (!text || !text.trim()) return '';
  return `\n${USER_CONTENT_OPEN}\n${text}\n${USER_CONTENT_CLOSE}`;
}
