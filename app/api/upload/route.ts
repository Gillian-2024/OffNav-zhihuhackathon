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
  // 不用 `file instanceof File`：`File` 全局在 Node 18 不存在（Node 20 才加入），
  // 而部署目标的运行时是 Node 18.15，用 instanceof 会直接 ReferenceError。
  // 改为鸭子类型判断——formData 取回的文件对象一定带这三个成员。
  if (
    !file ||
    typeof file === "string" ||
    typeof (file as Blob).arrayBuffer !== "function" ||
    typeof (file as File).size !== "number"
  ) {
    return Response.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  const upload = file as File;
  if (upload.size === 0) {
    return Response.json({ error: "文件是空的" }, { status: 400 });
  }
  if (upload.size > MAX_BYTES) {
    return Response.json({ error: "文件超过 6MB，请压缩后重试" }, { status: 413 });
  }

  try {
    const buf = new Uint8Array(await upload.arrayBuffer());
    const text = await parseFile(buf, upload.type, upload.name);
    if (!text.trim()) {
      return Response.json({ error: "没能从文件里读出文字，若是扫描版 PDF 请改用文字版" }, { status: 422 });
    }
    return Response.json({ text, chars: text.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
