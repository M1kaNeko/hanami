import { BrowserWindow, session } from "electron";
import { mkdir, open, stat } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Game } from "../shared/model";
import {
  detectNativeGame,
  renpyCommand,
  prepareRenpyProject,
} from "./native-game";
import { gameAsset } from "./game-assets";
const windows = new Map<string, BrowserWindow>();
const children = new Map<string, ReturnType<typeof spawn>>();
export function createNativeLauncher(runtimeRoot: string) {
  return async (game: Game, saveDirectory: string) => {
    if (process.platform !== "darwin") throw Error("Mac 原生运行只支持 macOS");
    const detected = await detectNativeGame(game.directory);
    if (detected.kind === "tyrano") {
      const existing = windows.get(game.id);
      if (existing && !existing.isDestroyed()) {
        existing.show();
        existing.focus();
        return;
      }
      const key = createHash("sha256").update(game.id).digest("hex");
      const s = session.fromPartition(`persist:hanami-game-${key}`);
      if (
        s.protocol.isProtocolHandled &&
        (await s.protocol.isProtocolHandled("game"))
      )
        s.protocol.unhandle("game");
      s.protocol.handle("game", (request) =>
        gameAsset(
          detected.directory,
          request.url,
          request.method,
          request.headers.get("range"),
        ),
      );
      s.setPermissionRequestHandler((_w, _p, cb) => cb(false));
      s.setPermissionCheckHandler(() => false);
      s.webRequest.onBeforeRequest((details, callback) => {
        const u = new URL(details.url);
        callback({
          cancel: !(
            (u.protocol === "game:" && u.hostname === "local") ||
            u.protocol === "data:" ||
            u.protocol === "blob:"
          ),
        });
      });
      const w = new BrowserWindow({
        title: game.name,
        width: 1100,
        height: 800,
        webPreferences: {
          session: s,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      windows.set(game.id, w);
      w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      w.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("game://local/")) event.preventDefault();
      });
      w.on("closed", () => {
        windows.delete(game.id);
        s.protocol.unhandle("game");
      });
      try {
        await w.loadURL("game://local/index.html");
      } catch (e) {
        w.destroy();
        throw Error("游戏页面加载失败，请检查目录是否完整");
      }
      return;
    }
    const existing = children.get(game.id);
    if (existing && existing.exitCode === null && !existing.killed)
      throw Error("这个游戏已经启动，请切换到游戏窗口");
    if (detected.version === "7.3.5" && process.arch === "arm64") {
      try {
        await promisify(execFile)("/usr/bin/arch", [
          "-x86_64",
          "/usr/bin/true",
        ]);
      } catch {
        throw Error(
          "这部游戏需要 Rosetta 2。请先安装 Apple 的 Rosetta 2 后重试",
        );
      }
    }
    const project = await prepareRenpyProject(
      detected.directory,
      saveDirectory,
    );
    const command = renpyCommand(
      { ...detected, directory: project },
      runtimeRoot,
      join(saveDirectory, "renpy"),
    );
    try {
      if (!(await stat(command.file)).isFile()) throw Error();
    } catch {
      throw Error("原生运行组件缺失，请完整解压 Mac 版花间");
    }
    await mkdir(saveDirectory, { recursive: true });
    await mkdir(join(saveDirectory, "renpy"), { recursive: true });
    const log = await open(join(saveDirectory, "launch.log"), "a");
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(command.file, command.args, {
          cwd: detected.directory,
          shell: false,
          detached: true,
          stdio: ["ignore", log.fd, log.fd],
          env: { ...process.env, RENPY_LOG_BASE: saveDirectory },
        });
        children.set(game.id, child);
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          reject(Error(message));
        };
        child.once("error", () => {
          children.delete(game.id);
          fail("游戏启动失败，请检查目录、运行组件和 Rosetta 2");
        });
        child.once("exit", () => {
          children.delete(game.id);
          fail("游戏在启动时退出，详情见该游戏存档目录下的 launch.log");
        });
        child.once("spawn", () => {
          timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              child.unref();
              resolve();
            }
          }, 1500);
        });
      });
    } finally {
      await log.close();
    }
  };
}
