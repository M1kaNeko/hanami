import { it, expect, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
} from "../src/main/backup";
import { createStore } from "../src/main/store";
import { game } from "./fixtures";
import { importCover } from "../src/main/covers";
const roots: string[] = [];
async function root() {
  const r = await mkdtemp(join(tmpdir(), "hanami-b-"));
  roots.push(r);
  return r;
}
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((r) => rm(r, { recursive: true, force: true })),
  ),
);
import { PNG } from "pngjs";
const onePixel = new PNG({ width: 1, height: 1 });
onePixel.data = Buffer.from([255, 255, 255, 255]);
export const png = PNG.sync.write(onePixel);
it("清单和封面往返，路径保留，旧库自动备份", async () => {
  const a = await root(),
    b = await root();
  await writeFile(join(a, "p.png"), png);
  const cover = await importCover(a, join(a, "p.png"));
  const library = { schemaVersion: 1 as const, games: [{ ...game, cover }] };
  await exportBackup(a, library, join(a, "copy.json"));
  const parsed = await validateBackup(join(a, "copy.json"));
  await createStore(b).save({ schemaVersion: 1, games: [] });
  const restored = await restoreBackup(b, parsed);
  expect({ ...restored.games[0], cover: null }).toEqual({
    ...library.games[0],
    cover: null,
  });
  expect(await readFile(join(b, "covers", restored.games[0].cover!))).toEqual(
    png,
  );
  expect((await createStore(b).read()).games[0].executable).toBe(
    "C:\\Games\\a.exe",
  );
});
it.each([
  { version: 2 },
  {
    version: 1,
    covers: [
      {
        reference: "../bad",
        mime: "image/png",
        base64: png.toString("base64"),
      },
    ],
  },
])("拒绝非法版本或封面引用", async (extra) => {
  const a = await root();
  const f = join(a, "bad.json");
  await writeFile(
    f,
    JSON.stringify({
      format: "galgame-manager-backup",
      library: { schemaVersion: 1, games: [] },
      covers: [],
      ...extra,
    }),
  );
  await expect(validateBackup(f)).rejects.toThrow();
});
it("拒绝伪图片和超大图片", async () => {
  const a = await root();
  await writeFile(join(a, "fake.png"), "hello");
  await expect(importCover(a, join(a, "fake.png"))).rejects.toThrow();
  await writeFile(join(a, "large.png"), Buffer.alloc(10 * 1024 * 1024 + 1));
  await expect(importCover(a, join(a, "large.png"))).rejects.toThrow();
});
it("损坏原库也能恢复，原字节保留为恢复副本", async () => {
  const a = await root();
  await writeFile(join(a, "library.json"), "broken-original");
  const restored = await restoreBackup(a, {
    format: "galgame-manager-backup",
    version: 1,
    library: { schemaVersion: 1, games: [game] },
    covers: [],
  });
  expect(restored.games[0].name).toBe("白色相簿");
  expect((await createStore(a).read()).games).toHaveLength(1);
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(a);
  const preserved = files.find((f) => f.startsWith("damaged-before-import-"));
  expect(preserved).toBeTruthy();
  expect(await readFile(join(a, preserved!), "utf8")).toBe("broken-original");
});
it("准备恢复时写文件失败，原库不受影响", async () => {
  const a = await root();
  const old = { schemaVersion: 1 as const, games: [game] };
  await createStore(a).save(old);
  await writeFile(join(a, "covers"), "not a directory");
  await expect(
    restoreBackup(a, {
      format: "galgame-manager-backup",
      version: 1,
      library: { schemaVersion: 1, games: [] },
      covers: [],
    }),
  ).rejects.toThrow();
  expect(await createStore(a).read()).toEqual(old);
});
it("当前封面缺失不妨碍恢复健康备份，保留原记录", async () => {
  const a = await root();
  const old = {
    schemaVersion: 1 as const,
    games: [{ ...game, cover: "11111111-1111-4111-8111-111111111111.png" }],
  };
  await createStore(a).save(old);
  const restored = await restoreBackup(a, {
    format: "galgame-manager-backup",
    version: 1,
    library: { schemaVersion: 1, games: [] },
    covers: [],
  });
  expect(restored.games).toEqual([]);
  const { readdir } = await import("node:fs/promises");
  const recovery = (await readdir(a)).find((f) =>
    f.startsWith("incomplete-before-import-"),
  );
  expect(recovery).toBeTruthy();
  expect(
    JSON.parse(await readFile(join(a, recovery!, "library.json"), "utf8")),
  ).toEqual(old);
});
it("拒绝只有签名和 IHDR 的假 PNG", async () => {
  const a = await root();
  const fake = Buffer.alloc(24);
  png.copy(fake, 0, 0, 24);
  await writeFile(join(a, "bad.png"), fake);
  await expect(importCover(a, join(a, "bad.png"))).rejects.toThrow();
});
it("可恢复数 MiB 的合法 PNG，不耗尽正则栈", async () => {
  const { deflateSync } = await import("node:zlib");
  const { randomBytes } = await import("node:crypto");
  const a = await root();
  const { PNG } = await import("pngjs");
  const pixels = new PNG({ width: 1200, height: 1200 });
  pixels.data = randomBytes(1200 * 1200 * 4);
  const encoded = PNG.sync.write(pixels);
  expect(encoded.length).toBeGreaterThan(4 * 1024 * 1024);
  await writeFile(join(a, "big.png"), encoded);
  const cover = await importCover(a, join(a, "big.png"));
  const lib = { schemaVersion: 1 as const, games: [{ ...game, cover }] };
  await exportBackup(a, lib, join(a, "large.json"));
  const parsed = await validateBackup(join(a, "large.json"));
  expect(parsed.library.games).toHaveLength(1);
  expect(Buffer.from(parsed.covers[0].base64, "base64").equals(encoded)).toBe(
    true,
  );
});
it("JPEG 与 WebP 实际可解码，截断文件被拒绝", async () => {
  const a = await root();
  const jpeg = await import("jpeg-js"),
    webp = await import("webp-wasm");
  const pixels = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]),
  };
  const jpegBytes = Buffer.from(
      jpeg.encode({ ...pixels, data: Buffer.from(pixels.data) }, 80).data,
    ),
    webpBytes = await webp.default.encode(pixels, {});
  await writeFile(join(a, "valid.jpg"), jpegBytes);
  await writeFile(join(a, "valid.webp"), webpBytes);
  expect(await importCover(a, join(a, "valid.jpg"))).toMatch(/\.jpg$/);
  expect(await importCover(a, join(a, "valid.webp"))).toMatch(/\.webp$/);
  await writeFile(join(a, "bad.webp"), webpBytes.subarray(0, 24));
  await expect(importCover(a, join(a, "bad.webp"))).rejects.toThrow();
});
