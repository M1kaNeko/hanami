import { realpath, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { resolve, relative, isAbsolute, extname } from "node:path";
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".ks": "text/plain; charset=utf-8",
};
export async function gameAsset(
  root: string,
  url: string,
  method = "GET",
  range: string | null = null,
): Promise<Response> {
  try {
    const canonicalRoot = await realpath(root);
    const u = new URL(url);
    if (
      u.protocol !== "game:" ||
      u.hostname !== "local" ||
      u.port ||
      u.username ||
      u.password
    )
      return new Response("", { status: 403 });
    if (!["GET", "HEAD"].includes(method))
      return new Response("", { status: 405 });
    const target = await realpath(
      resolve(
        root,
        "." +
          decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname),
      ),
    );
    const rel = relative(canonicalRoot, target);
    if (rel.startsWith("..") || isAbsolute(rel))
      return new Response("", { status: 403 });
    const s = await stat(target);
    if (!s.isFile()) return new Response("", { status: 404 });
    let start = 0,
      end = s.size - 1,
      status = 200;
    const headers: Record<string, string> = {
      "Content-Type":
        mime[extname(target).toLowerCase()] ?? "application/octet-stream",
      "Accept-Ranges": "bytes",
    };
    if (range) {
      const m = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!m || (!m[1] && !m[2]))
        return new Response("", {
          status: 416,
          headers: { "Content-Range": `bytes */${s.size}` },
        });
      if (!m[1]) start = Math.max(0, s.size - Number(m[2]));
      else {
        start = Number(m[1]);
        if (m[2]) end = Math.min(end, Number(m[2]));
      }
      if (!Number.isSafeInteger(start) || start > end || end >= s.size)
        return new Response("", {
          status: 416,
          headers: { "Content-Range": `bytes */${s.size}` },
        });
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${s.size}`;
    }
    headers["Content-Length"] = String(Math.max(0, end - start + 1));
    if (method === "HEAD" || s.size === 0)
      return new Response(null, { status, headers });
    return new Response(
      Readable.toWeb(
        createReadStream(target, { start, end }),
      ) as ReadableStream,
      { status, headers },
    );
  } catch {
    return new Response("", { status: 404 });
  }
}
