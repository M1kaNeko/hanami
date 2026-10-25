import { it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gameAsset } from "../src/main/game-assets";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
it("流式资源支持中文路径、HEAD、音视频 Range，拒绝跨目录符号链接", async () => {
  const root = await mkdtemp(join(tmpdir(), "assets-")),
    other = await mkdtemp(join(tmpdir(), "outside-"));
  roots.push(root, other);
  await writeFile(join(root, "中文.mp4"), "0123456789");
  await writeFile(join(other, "secret"), "private");
  await symlink(join(other, "secret"), join(root, "escape"));
  const url = "game://local/" + encodeURIComponent("中文.mp4");
  const response = await gameAsset(root, url, "GET", "bytes=2-5");
  expect(response.status).toBe(206);
  expect(await response.text()).toBe("2345");
  expect(response.headers.get("content-type")).toBe("video/mp4");
  expect(await (await gameAsset(root, url, "HEAD")).text()).toBe("");
  expect((await gameAsset(root, url, "GET", "bytes=99-")).status).toBe(416);
  expect((await gameAsset(root, "game://local/escape")).status).toBe(403);
  expect((await gameAsset(root, "game://other/中文.mp4")).status).toBe(403);
});
