// SSE 工具（Next Route Handler 版）。
// Express 用 res.write/flushHeaders；Next 用 Response + ReadableStream。
// 客户端契约（client/src/api/client.ts streamSSE）：
//   逐行接收 `data: {json}`，模型结束收 `data: [DONE]`。
import type { SendFn, EndFn } from "./types";

const encoder = new TextEncoder();

// 将一段异步 SSE 处理器包装成可流式返回的 Response。
// handler 通过 send(data) 推送 JSON 帧、end() 推送 [DONE]。
export function createSSEResponse(handler: (send: SendFn, end: EndFn) => Promise<void>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendFn = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      const end: EndFn = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      try {
        await handler(send, end);
      } catch (e) {
        // 兜底：handler 内部通常已 failSSE，这里是安全网
        send({ type: "error", message: (e as Error).message || String(e) });
        end();
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
