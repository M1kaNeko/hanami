import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { win32 } from "node:path";
interface Deps {
  stat: (path: string) => Promise<{ isFile(): boolean }>;
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
  await new Promise<void>((resolve, reject) => {
    try {
      const child = deps.spawn(exe, [], {
        cwd: win32.dirname(exe),
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
