// 简历上传：解析成纯文本返回给前端，由前端带进 /api/match。
// 不落盘、不入库——只做一次性解析，降低隐私面。
import { NextRequest } from "next/server";
import { parseFile } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "请求不是合法的 multipart 表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "文件是空的" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "文件超过 6MB，请压缩后重试" }, { status: 413 });
  }

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const text = await parseFile(buf, file.type, file.name);
    if (!text.trim()) {
      return Response.json({ error: "没能从文件里读出文字，若是扫描版 PDF 请改用文字版" }, { status: 422 });
    }
    return Response.json({ text, chars: text.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
