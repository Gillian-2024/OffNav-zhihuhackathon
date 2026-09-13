// 统一文件解析入口：buffer + mimetype/originalname → 纯文本。
// 这层质量决定 prompt 上限。
import { extractText } from "unpdf";
import mammoth from "mammoth";
import * as cheerio from "cheerio";

export async function parseFile(
  buffer: Uint8Array | ArrayBuffer,
  mimetype: string,
  originalname = ""
): Promise<string> {
  const name = originalname.toLowerCase();

  if (mimetype === "application/pdf" || name.endsWith(".pdf")) {
    const { text } = await extractText(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), {
      mergePages: true,
    });
    return text.trim();
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const buf = Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value.trim();
  }

  if (mimetype === "application/msword" || name.endsWith(".doc")) {
    throw new Error("暂不支持 .doc 旧格式，请另存为 .docx 或 PDF 后上传");
  }

  if (mimetype === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
    const buf = Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    const $ = cheerio.load(buf.toString("utf-8"));
    $("script,style,noscript").remove();
    return $("body").text().replace(/\s+/g, " ").trim();
  }

  // text/plain + 兜底当文本
  const buf = Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  return buf.toString("utf-8").trim();
}
