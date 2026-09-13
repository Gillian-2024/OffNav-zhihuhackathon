// SSE 客户端：逐行读 `data: {json}`，遇 [DONE] 结束。
// 与服务端 createSSEResponse 的帧格式一一对应。
export async function streamSSE(
  url: string,
  body: unknown,
  on: {
    step?: (e: any) => void;
    pool?: (e: any) => void;
    notice?: (e: any) => void;
    result?: (e: any) => void;
    error?: (msg: string) => void;
  }
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    on.error?.(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    return;
  }
  if (!res.body) {
    on.error?.("响应没有 body");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  let sawDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { sawDone = true; return; }
      let e: any;
      try {
        e = JSON.parse(payload);
      } catch {
        continue;
      }
      if (e.type === "step") on.step?.(e);
      else if (e.type === "pool") on.pool?.(e);
      else if (e.type === "notice") on.notice?.(e);
      else if (e.type === "result") on.result?.(e);
      else if (e.type === "error") on.error?.(e.message || "未知错误");
    }
  }

  // 流在没收到 [DONE] 就结束了——通常是连接中断。
  // 不报的话页面会停在半截进度上，看起来像卡死。
  if (!sawDone) on.error?.("连接中断，请重试");
}
