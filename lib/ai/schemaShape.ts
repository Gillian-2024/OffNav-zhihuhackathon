// 把 zod schema 递归转成「可读 JSON 骨架文本」注入 prompt。
// 移植自 server/src/utils/schemaShape.js —— Next 侧 zod 为单实例(无 dual-instance),直接 import。
// 配合 generateText + 手动 parse 使用（generateObject tool mode 对内网 reasoning 模型失效）。
import { z } from "zod";

// 解包 Optional / Nullable
function unwrap(schema: any): any {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrap(schema.unwrap());
  }
  return schema;
}

function descOf(schema: any): string {
  return (schema && schema._def && schema._def.description) || "";
}

function shapeOf(schema: any, indent: number): string {
  const pad = "  ".repeat(indent);
  const d = descOf(schema);
  const note = d ? `  // ${d}` : "";
  const s = unwrap(schema);

  if (s instanceof z.ZodObject) {
    const fields = Object.entries(s.shape).map(
      ([k, v]) => `${pad}  "${k}": ${shapeOf(v, indent + 1)}`
    );
    return `{\n${fields.join(",\n")}\n${pad}}${note}`;
  }
  if (s instanceof z.ZodArray) {
    return `[${shapeOf(s.element, indent)}]${note}`;
  }
  if (s instanceof z.ZodString) return `"string"${note}`;
  if (s instanceof z.ZodNumber) return `"number"${note}`;
  if (s instanceof z.ZodBoolean) return `"boolean"${note}`;
  return `"string"${note}`;
}

export function schemaShape(schema: any): string {
  return shapeOf(schema, 0);
}
