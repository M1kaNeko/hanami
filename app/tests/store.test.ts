import { it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/main/store";
import { game } from "./fixtures";
const roots: string[] = [];
async function root() {
  const r = await mkdtemp(join(tmpdir(), "hanami-"));
  roots.push(r);
  return r;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((r) => rm(r, { recursive: true, force: true })),
  );
});
it("首次空库，持久保存，保留上一版本", async () => {
  const r = await root();
  const s = createStore(r);
  expect((await s.read()).games).toEqual([]);
  await s.save({ schemaVersion: 1, games: [game] });
  await s.save({ schemaVersion: 1, games: [] });
  expect((await createStore(r).read()).games).toEqual([]);
  expect(
    JSON.parse(await readFile(join(r, "library.previous.json"), "utf8"))
      .games[0].name,
  ).toBe("白色相簿");
});
it("损坏库拒绝覆盖且保留原内容", async () => {
  const r = await root();
  await writeFile(join(r, "library.json"), "broken");
  const s = createStore(r);
  await expect(s.read()).rejects.toThrow();
  await expect(s.save({ schemaVersion: 1, games: [] })).rejects.toThrow();
  expect(await readFile(join(r, "library.json"), "utf8")).toBe("broken");
});
it("并发写入不破坏 JSON", async () => {
  const r = await root();
  const s = createStore(r);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      s.save({ schemaVersion: 1, games: [{ ...game, name: String(i) }] }),
    ),
  );
  expect((await s.read()).games[0].name).toBe("9");
});
