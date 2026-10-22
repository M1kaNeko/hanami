import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { GameDraft } from "../shared/model";
import { win32 } from "node:path";
interface Deps {
  stat: (
    path: string,
  ) => Promise<{ isFile(): boolean; isDirectory?(): boolean }>;
  spawn: (
    file: string,
    args: string[],
    options: { cwd: string; shell: false; detached: true; stdio: "ignore" },
  ) => any;
}
export async function launchExecutable(
  exe: string,
  platform: NodeJS.Platform,
  deps: Deps = { stat, spawn },
): Promise<void> {
  if (platform !== "win32")
    throw Error("请在 Windows 中启动游戏，Mac 上可管理收藏");
  if (!/\.exe$/i.test(exe) || !win32.isAbsolute(exe))
    throw Error("请选择有效的 Windows .exe 路径");
  try {
    if (!(await deps.stat(exe)).isFile()) throw Error();
  } catch {
    throw Error("启动程序不存在，请重新选择路径");
  }
  await spawnGame(exe, [], win32.dirname(exe), deps);
}
async function spawnGame(exe: string, args: string[], cwd: string, deps: Deps) {
  await new Promise<void>((resolve, reject) => {
    try {
      const child = deps.spawn(exe, args, {
        cwd,
        shell: false,
        detached: true,
        stdio: "ignore",
      });
      child.once("error", () =>
        reject(Error("游戏启动失败，请检查文件、权限和运行环境")),
      );
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    } catch {
      reject(Error("游戏启动失败，请检查启动程序"));
    }
  });
}

export async function launchGame(
  game: Pick<GameDraft, "directory" | "executable" | "launchMode">,
  platform: NodeJS.Platform,
  enginePath: string,
  saveDirectory: string,
  deps: Deps = { stat, spawn },
): Promise<void> {
  if (game.launchMode !== "kirikiri")
    return launchExecutable(game.executable, platform, deps);
  if (platform !== "win32")
    throw Error("请在 Windows 中启动游戏，Mac 上可管理收藏");
  if (!win32.isAbsolute(enginePath) || !/\.exe$/i.test(enginePath))
    throw Error("内置引擎缺失，请完整解压新版花间");
  try {
    if (!(await deps.stat(enginePath)).isFile()) throw Error();
  } catch {
    throw Error("内置引擎缺失，请完整解压新版花间");
  }
  if (
    !win32.isAbsolute(game.directory) ||
    game.directory.length > 220 ||
    !win32.isAbsolute(saveDirectory)
  )
    throw Error("请选择有效的 Windows 游戏目录；目录路径请缩短到 220 字符以内");
  try {
    if (!(await deps.stat(game.directory)).isDirectory?.()) throw Error();
  } catch {
    throw Error("游戏目录不存在，请重新选择路径");
  }
  let target: string | undefined;
  for (const [entry, project] of [
    [win32.join(game.directory, "startup.tjs"), game.directory],
    [
      win32.join(game.directory, "data", "startup.tjs"),
      win32.join(game.directory, "data"),
    ],
    [
      win32.join(game.directory, "data.xp3"),
      win32.join(game.directory, "data.xp3"),
    ],
  ]) {
    try {
      if ((await deps.stat(entry)).isFile()) {
        target = project;
        break;
      }
    } catch {
      /* Try the next standard entry. */
    }
  }
  if (!target)
    throw Error(
      "未找到 startup.tjs、data/startup.tjs 或 data.xp3，请选择完整的吉里吉里游戏目录；其他引擎请使用 exe 启动",
    );
  await spawnGame(
    enginePath,
    [target, `-datapath=${saveDirectory}`],
    game.directory,
    deps,
  );
}
