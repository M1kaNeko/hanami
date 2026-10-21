import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export const MAX_IMAGE = 10 * 1024 * 1024;
export function imageType(data: Buffer): { mime: string; ext: string } {
  if (data.length < 24 || data.length > MAX_IMAGE)
    throw Error("图片无效或超过 10 MiB");
  if (
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR"
  )
    return { mime: "image/png", ext: "png" };
  if (
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255 &&
    data.at(-2) === 255 &&
    data.at(-1) === 217
  )
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  throw Error("请选择 PNG、JPEG 或 WebP 图片");
}
export async function importCover(
  root: string,
  source: string,
): Promise<string> {
  if ((await stat(source)).size > MAX_IMAGE) throw Error("图片不能超过 10 MiB");
  const data = await readFile(source),
    type = await validateImage(data),
    ref = `${randomUUID()}.${type.ext}`;
  await mkdir(join(root, "covers"), { recursive: true });
  await writeFile(join(root, "covers", ref), data);
  return ref;
}

/** Decode before accepting pixels; file headers alone are insufficient. */
export async function validateImage(
  data: Buffer,
): Promise<{ mime: string; ext: string }> {
  const type = imageType(data);
  const maxPixels = 20_000_000;
  let decoded: { width: number; height: number; data: unknown };
  const dimensions = (w: number, h: number) => {
    if (w < 1 || h < 1 || w * h > maxPixels)
      throw Error("封面尺寸过大或无效，请使用 2000 万像素以内的图片");
  };
  try {
    if (type.ext === "png") {
      if (data.length < 33) throw Error("PNG 不完整");
      dimensions(data.readUInt32BE(16), data.readUInt32BE(20));
      const { PNG } = await import("pngjs");
      decoded = PNG.sync.read(data);
    } else if (type.ext === "jpg") {
      const jpeg = await import("jpeg-js");
      decoded = jpeg.decode(data, {
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 128,
        tolerantDecoding: false,
      });
    } else {
      const chunk = data.toString("ascii", 12, 16);
      if (chunk === "VP8X") {
        if (data.length < 30) throw Error("WebP 不完整");
        dimensions(data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1);
      } else if (chunk === "VP8L") {
        if (data.length < 25 || data[20] !== 0x2f) throw Error("WebP 不完整");
        dimensions(
          (data[21] | ((data[22] & 63) << 8)) + 1,
          ((data[22] >> 6) | (data[23] << 2) | ((data[24] & 15) << 10)) + 1,
        );
      } else if (chunk === "VP8 ") {
        if (data.length < 30) throw Error("WebP 不完整");
        dimensions(
          data.readUInt16LE(26) & 16383,
          data.readUInt16LE(28) & 16383,
        );
      } else throw Error("WebP 无效");
      const webp = await import("webp-wasm");
      decoded = await webp.default.decode(
        data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer,
      );
    }
    dimensions(decoded.width, decoded.height);
    return type;
  } catch (e) {
    throw Error(`图片无法解码：${e instanceof Error ? e.message : "文件损坏"}`);
  }
}
