import { it, expect, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createService } from "../src/main/service";
import { draft } from "./fixtures";
const dirs: string[] = [];
async function service() {
  const root = await mkdtemp(join(tmpdir(), "hanami-service-"));
  dirs.push(root);
  return { root, s: createService(root) };
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
it("相同 Windows 路径不能重复添加，自身编辑可保存", async () => {
  const { s } = await service();
  const a = await s.save(draft);
  await expect(
    s.save({ ...draft, executable: "c:/games/A.exe" }),
  ).rejects.toThrow("已经添加");
  const updated = await s.save(
    { ...draft, status: "completed", rating: 10, notes: "喜欢结尾" },
    a.id,
  );
  expect(updated.id).toBe(a.id);
  expect((await s.list())[0]).toMatchObject({
    status: "completed",
    rating: 10,
    notes: "喜欢结尾",
  });
});
it("并发添加保留两条记录", async () => {
  const { s } = await service();
  await Promise.all([
    s.save(draft),
    s.save({ ...draft, executable: "C:\\Games\\b.exe" }),
  ]);
  expect(await s.list()).toHaveLength(2);
});
it("删除收藏不碰游戏原文件", async () => {
  const { root, s } = await service();
  const original = join(root, "original.exe");
  await writeFile(original, "untouched");
  const a = await s.save({ ...draft, directory: root, executable: original });
  await s.delete(a.id);
  expect(await s.list()).toHaveLength(0);
  expect(await readFile(original, "utf8")).toBe("untouched");
});
it("不支持平台启动失败时，不更新最近启动时间", async () => {
  if (process.platform === "win32") return;
  const { s } = await service();
  const a = await s.save(draft);
  await expect(s.launch(a.id)).rejects.toThrow("Windows");
  expect((await s.list())[0].lastLaunchedAt).toBeNull();
});
it("更换或移除封面后，上一版库的图片仍可读", async () => {
  const { root, s } = await service();
  const { mkdir } = await import("node:fs/promises");
  const cover = "11111111-1111-4111-8111-111111111111.png";
  await mkdir(join(root, "covers"));
  await writeFile(join(root, "covers", cover), "previous-cover");
  const a = await s.save({ ...draft, cover });
  await s.save({ ...draft, cover: null }, a.id);
  const previous = JSON.parse(
    await readFile(join(root, "library.previous.json"), "utf8"),
  );
  expect(previous.games[0].cover).toBe(cover);
  expect(await readFile(join(root, "covers", cover), "utf8")).toBe(
    "previous-cover",
  );
});
