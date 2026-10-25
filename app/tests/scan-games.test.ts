import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanGames } from "../src/main/scan-games";
it("递归查找入口、保留多个候选、排除安装程序和符号链接", async () => {
  const root = await mkdtemp(join(tmpdir(), "hanami-scan-"));
  try {
    await mkdir(join(root, "游戏", "plugin"), { recursive: true });
    for (const file of [
      "游戏/a.exe",
      "游戏/b.EXE",
      "游戏/unins000.exe",
      "游戏/setup.exe",
      "游戏/plugin/tool.exe",
    ])
      await writeFile(join(root, file), "");
    await symlink(root, join(root, "loop"));
    const result = await scanGames(root);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("游戏");
    expect(result[0].executables.map((p) => p.split("/").pop())).toEqual([
      "a.exe",
      "b.EXE",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
