import { describe, it, expect } from "vitest";
import { parseFile } from "@/lib/parsers";

const enc = (s: string) => new TextEncoder().encode(s);

describe("parseFile", () => {
  it("纯文本原样返回并去首尾空白", async () => {
    expect(await parseFile(enc("  简历正文  "), "text/plain", "a.txt")).toBe("简历正文");
  });

  it("HTML 剥标签并压缩空白", async () => {
    const html = "<html><head><style>p{color:red}</style></head><body><h1>张三</h1><p>产品经理</p><script>x()</script></body></html>";
    const out = await parseFile(enc(html), "text/html", "a.html");
    expect(out).toContain("张三");
    expect(out).toContain("产品经理");
    expect(out).not.toContain("color:red");
    expect(out).not.toContain("x()");
  });

  it("拒绝 .doc 旧格式并给出可操作提示", async () => {
    await expect(parseFile(enc("x"), "application/msword", "a.doc")).rejects.toThrow(/另存为/);
  });

  it("未知 mimetype 兜底按文本处理", async () => {
    expect(await parseFile(enc("兜底内容"), "application/octet-stream", "a.bin")).toBe("兜底内容");
  });
});
