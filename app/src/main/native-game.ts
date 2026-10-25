import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
export type NativeGame =
  | { kind: "tyrano"; directory: string }
  | { kind: "renpy"; directory: string; version: "7.3.5" | "8.1.1" };
async function file(p: string) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}
async function folder(p: string) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
export async function detectNativeGame(input: string): Promise<NativeGame> {
  if (!isAbsolute(input) || input.includes("\0"))
    throw Error("请选择 Mac 上实际的游戏目录");
  const root = await realpath(input).catch(() => {
    throw Error("游戏目录不存在，请重新选择");
  });
  if (!(await folder(root))) throw Error("请选择游戏文件夹");
  let examined = 0;
  const found: NativeGame[] = [];
  const unsupported: string[] = [];
  async function inspect(dir: string, depth: number) {
    if (++examined > 200)
      throw Error("目录过大，请直接选择包含游戏程序的文件夹");
    if (
      (await file(join(dir, "index.html"))) &&
      (await folder(join(dir, "tyrano")))
    ) {
      found.push({ kind: "tyrano", directory: dir });
      return;
    }
    if (
      (await file(join(dir, "renpy", "__init__.py"))) &&
      (await folder(join(dir, "game")))
    ) {
      const init = await readFile(join(dir, "renpy", "__init__.py"), "utf8");
      const vc = await readFile(
        join(dir, "renpy", "vc_version.py"),
        "utf8",
      ).catch(() => "");
      const tuple = init.match(
        /version_tuple\s*=\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/,
      );
      const version = tuple
        ? tuple.slice(1, 4).join(".")
        : vc.match(/^version\s*=\s*['"](\d+\.\d+\.\d+)/m)?.[1];
      if (version === "7.3.5" || version === "8.1.1")
        found.push({ kind: "renpy", directory: dir, version });
      else unsupported.push(version ?? "未知版本");
      return;
    }
    if (depth >= 2) return;
    for (const entry of await readdir(dir, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !["lib", "renpy", "data", "node_modules", "saves"].includes(entry.name)
      )
        await inspect(join(dir, entry.name), depth + 1);
  }
  await inspect(root, 0);
  if (found.length > 1)
    throw Error("发现多个游戏入口，请直接选择其中一个游戏的文件夹");
  if (found.length === 1) return found[0];
  if (unsupported.length)
    throw Error(
      `检测到 Ren’Py ${unsupported.join("、")}，此版暂只附带 7.3.5 和 8.1.1 组件`,
    );
  throw Error(
    "没有识别到支持的 Mac 原生游戏。请选择含 Tyrano index.html 或 Ren’Py game 文件夹的完整目录；此模式不能运行任意 exe",
  );
}
export function renpyCommand(
  game: Extract<NativeGame, { kind: "renpy" }>,
  runtimeRoot: string,
  saveDirectory: string,
) {
  const root = join(runtimeRoot, `renpy-${game.version}`),
    platform = game.version === "7.3.5" ? "darwin-x86_64" : "py3-mac-universal";
  return {
    file: join(root, "lib", platform, "renpy"),
    args: [
      ...(game.version === "7.3.5" ? ["-EO", join(root, "renpy.py")] : []),
      "--savedir",
      saveDirectory,
      game.directory,
    ],
  };
}

// Ren'Py treats this standard macOS bundle layout as macapp=True and omits
// the game-local saves location. --savedir alone does not provide isolation.
export async function prepareRenpyProject(
  directory: string,
  saveDirectory: string,
): Promise<string> {
  const { mkdir, symlink, lstat, readlink, rename, unlink } =
    await import("node:fs/promises");
  const base = join(
    saveDirectory,
    "project",
    "Contents",
    "Resources",
    "autorun",
  );
  await mkdir(base, { recursive: true });
  const link = join(base, "game"),
    target = join(directory, "game");
  try {
    const current = await lstat(link);
    if (!current.isSymbolicLink())
      throw Error(
        "原生启动缓存路径被其他文件占用，请保留存档并检查 project 目录",
      );
    if ((await readlink(link)) === target) return base;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const temp = link + "." + (await import("node:crypto")).randomUUID();
  await symlink(target, temp, "dir");
  try {
    await rename(temp, link);
  } finally {
    await unlink(temp).catch(() => {});
  }
  return base;
}
