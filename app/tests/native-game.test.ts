import { it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  realpath,
  readlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectNativeGame, renpyCommand, prepareRenpyProject } from "../src/main/native-game";
const roots: string[] = [];
async function temp() {
  const p = await mkdtemp(join(tmpdir(), "hanami-native-"));
  roots.push(p);
  return p;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
it("识别外层目录中的 Tyrano，不读取执行游戏脚本", async () => {
  const p = await temp();
  const game = join(p, "game");
  await mkdir(join(game, "tyrano"), { recursive: true });
  await writeFile(join(game, "index.html"), "test");
  expect(await detectNativeGame(p)).toMatchObject({
    kind: "tyrano",
    directory: await realpath(game),
  });
});
it("按原始 RenPy 版本匹配组件，拒绝未知版本", async () => {
  const p = await temp();
  await mkdir(join(p, "renpy"));
  await mkdir(join(p, "game"));
  await writeFile(
    join(p, "renpy/__init__.py"),
    "version_tuple = (7, 3, 5, vc_version)",
  );
  expect(await detectNativeGame(p)).toMatchObject({
    kind: "renpy",
    version: "7.3.5",
  });
  await writeFile(join(p, "renpy/vc_version.py"), "version = '8.1.1.23060707'");
  await writeFile(
    join(p, "renpy/__init__.py"),
    "from renpy.vc_version import version",
  );
  expect(await detectNativeGame(p)).toMatchObject({ version: "8.1.1" });
  await writeFile(join(p, "renpy/vc_version.py"), "version = '8.9.9.0'");
  await expect(detectNativeGame(p)).rejects.toThrow("8.9.9");
});
it("多个入口要求选择更具体目录，忽略指向外部的子目录", async () => {
  const p = await temp(),
    other = await temp();
  await mkdir(join(other, "tyrano"));
  await writeFile(join(other, "index.html"), "test");
  await symlink(other, join(p, "external"));
  await expect(detectNativeGame(p)).rejects.toThrow();
  for (const n of ["a", "b"]) {
    await mkdir(join(p, n, "tyrano"), { recursive: true });
    await writeFile(join(p, n, "index.html"), "test");
  }
  await expect(detectNativeGame(p)).rejects.toThrow("多个");
});
it("7 与 8 参数不同，路径不经过 shell", () => {
  const g = {
    kind: "renpy" as const,
    version: "7.3.5" as const,
    directory: "/Games/A & B",
  };
  expect(renpyCommand(g, "/runtime", "/save").args).toEqual([
    "-EO",
    "/runtime/renpy-7.3.5/renpy.py",
    "--savedir",
    "/save",
    "/Games/A & B",
  ]);
  expect(
    renpyCommand({ ...g, version: "8.1.1" }, "/runtime", "/save").args,
  ).toEqual(["--savedir", "/save", "/Games/A & B"]);
});

it("Mac 存档工程可重复创建且不会替换已有普通文件", async () => {
  const p = await temp();
  const source = join(p, "original");
  const managed = join(p, "managed");
  await mkdir(join(source, "game"), { recursive: true });
  const project = await prepareRenpyProject(source, managed);
  expect(project.endsWith("Contents/Resources/autorun")).toBe(true);
  expect(await readlink(join(project, "game"))).toBe(join(source, "game"));
  expect(await prepareRenpyProject(source, managed)).toBe(project);
  await rm(join(project, "game"));
  await writeFile(join(project, "game"), "preserve");
  await expect(prepareRenpyProject(source, managed)).rejects.toThrow("占用");
});
