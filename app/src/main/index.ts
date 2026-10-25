import { scanGames } from "./scan-games";
import { createNativeLauncher } from "./native-launcher";
import { detectNativeGame } from "./native-game";
import { assertGamePaths } from "./game-paths";
import { extractExecutableCover } from "./executable-cover";
import { isTrustedUrl } from "./security";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  protocol,
  net,
  session,
} from "electron";
import {
  join,
  resolve,
  relative,
  isAbsolute,
  basename,
  extname,
} from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, stat, rm, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createService } from "./service";
import {
  importCover,
  saveCoverBytes,
  validateImage,
  MAX_IMAGE,
} from "./covers";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  type ValidatedBackup,
} from "./backup";
import { validCover, validateDraft } from "../shared/validation";
import type { Result } from "../shared/api";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "game",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: "covers",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
  {
    scheme: "hanami",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
app.setName("Hanami");
if (process.env.HANAMI_DATA_DIR && !app.isPackaged)
  app.setPath("userData", resolve(process.env.HANAMI_DATA_DIR));
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else
  app.whenReady().then(async () => {
    const root = app.getPath("userData"),
      service = createService(root, {
        nativeLaunch: createNativeLauncher(
          join(
            app.isPackaged ? process.resourcesPath : app.getAppPath(),
            "engines",
          ),
        ),
        enginePath: join(
          app.isPackaged ? process.resourcesPath : app.getAppPath(),
          "engines",
          "kirikiri",
          "krkrz.exe",
        ),
      });
    let window: BrowserWindow | null = null;
    const covers = new Map<string, { source: string } | { data: Buffer }>(),
      imports = new Map<string, ValidatedBackup>();
    function rememberCover(candidate: { source: string } | { data: Buffer }) {
      while (covers.size >= 16) covers.delete(covers.keys().next().value!);
      const token = randomUUID();
      covers.set(token, candidate);
      return token;
    }
    const productionRoot = resolve(__dirname, "../renderer");
    const dev =
      !app.isPackaged &&
      process.env.VITE_DEV_SERVER_URL === "http://127.0.0.1:5173";
    protocol.handle("covers", async (request) => {
      try {
        const u = new URL(request.url),
          ref = decodeURIComponent(u.pathname.slice(1));
        if (u.hostname !== "image" || !validCover(ref))
          return new Response("", { status: 404 });
        return net.fetch(pathToFileURL(join(root, "covers", ref)).href);
      } catch {
        return new Response("", { status: 404 });
      }
    });
    protocol.handle("hanami", async (request) => {
      try {
        const u = new URL(request.url);
        if (u.hostname !== "app") return new Response("", { status: 404 });
        const path = resolve(
          productionRoot,
          `.${decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname)}`,
        );
        const rel = relative(productionRoot, path);
        if (rel.startsWith("..") || isAbsolute(rel))
          return new Response("", { status: 403 });
        return net.fetch(pathToFileURL(path).href);
      } catch {
        return new Response("", { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler((_w, _p, cb) =>
      cb(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    function checkString(v: unknown): string {
      if (typeof v !== "string" || !v || v.length > 4000 || v.includes("\0"))
        throw Error("参数无效");
      return v;
    }
    function selectedPath(result: Electron.OpenDialogReturnValue) {
      return result.canceled ? null : (result.filePaths[0] ?? null);
    }
    ipcMain.handle(
      "hanami",
      async (
        event,
        method: unknown,
        ...args: unknown[]
      ): Promise<Result<unknown>> => {
        try {
          if (
            !window ||
            event.sender !== window.webContents ||
            event.senderFrame !== window.webContents.mainFrame
          )
            throw Error("调用来源无效");
          if (!isTrustedUrl(event.senderFrame.url, dev))
            throw Error("调用来源无效");
          let value: unknown;
          switch (method) {
            case "listGames":
              value = await service.list();
              break;
            case "saveGame": {
              const draft = validateDraft(args[0]),
                id = args[1] === undefined ? undefined : checkString(args[1]);
              let imported: string | undefined;
              assertGamePaths(draft, process.platform);
              if (draft.launchMode === "native") {
                const previous = id
                  ? (await service.list()).find((g) => g.id === id)
                  : undefined;
                if (
                  !previous ||
                  previous.launchMode !== "native" ||
                  previous.directory !== draft.directory
                )
                  draft.directory = (
                    await detectNativeGame(draft.directory)
                  ).directory;
              }
              try {
                if (args[2]) {
                  const token = checkString(args[2]),
                    selection = covers.get(token);
                  if (!selection) throw Error("封面选择已过期，请重新选择");
                  imported =
                    "data" in selection
                      ? await saveCoverBytes(root, selection.data)
                      : await importCover(root, selection.source);
                  draft.cover = imported;
                  draft.coverSource =
                    "data" in selection ? "executable" : "manual";
                }
                if (draft.cover && !imported) {
                  const old = (await service.list()).find((g) => g.id === id);
                  if (old?.cover !== draft.cover)
                    throw Error("请通过选择图片添加封面");
                }
                value = await service.save(draft, id);
                if (args[2]) covers.delete(String(args[2]));
              } catch (e) {
                if (imported)
                  await rm(join(root, "covers", imported), {
                    force: true,
                  }).catch(() => {});
                throw e;
              }
              break;
            }
            case "deleteGame":
              value = await service.delete(checkString(args[0]));
              break;
            case "scanGames": {
              const root = selectedPath(await dialog.showOpenDialog(window, { title: "选择游戏主文件夹", properties: ["openDirectory"] }));
              if (!root) { value = null; break; }
              const existing = await service.list();
              const used = new Set(existing.map(g => g.executable.toLowerCase()));
              value = (await scanGames(root)).map(g => ({ ...g, executables: g.executables.filter(p => !used.has(p.toLowerCase())) })).filter(g => g.executables.length);
              break;
            }
            case "selectDirectory":
              value = selectedPath(
                await dialog.showOpenDialog(window, {
                  title: "选择游戏目录",
                  properties: ["openDirectory"],
                }),
              );
              break;
            case "selectExecutable": {
              const dir = checkString(args[0]);
              const picked = selectedPath(
                await dialog.showOpenDialog(window, {
                  title: "选择启动程序",
                  defaultPath: dir,
                  properties: ["openFile"],
                  filters: [{ name: "Windows 游戏", extensions: ["exe"] }],
                }),
              );
              if (picked) {
                const actual = await realpath(picked),
                  base = await realpath(dir),
                  rel = relative(base, actual);
                if (
                  rel.startsWith("..") ||
                  isAbsolute(rel) ||
                  extname(actual).toLowerCase() !== ".exe"
                )
                  throw Error("请选择游戏目录内的 .exe 文件");
              }
              value = picked;
              break;
            }
            case "getExecutableCover": {
              const executable = checkString(args[0]);
              const data = await extractExecutableCover(
                executable,
                process.platform,
                {
                  stat,
                  getIcon: (path, options) => app.getFileIcon(path, options),
                },
              );
              value = data
                ? {
                    token: rememberCover({ data }),
                    preview: `data:image/png;base64,${data.toString("base64")}`,
                  }
                : null;
              break;
            }
            case "selectCover": {
              const picked = selectedPath(
                await dialog.showOpenDialog(window, {
                  title: "选择封面",
                  properties: ["openFile"],
                  filters: [
                    {
                      name: "封面图片",
                      extensions: ["png", "jpg", "jpeg", "webp"],
                    },
                  ],
                }),
              );
              if (!picked) {
                value = null;
                break;
              }
              if ((await stat(picked)).size > MAX_IMAGE)
                throw Error("封面不能超过 10 MiB");
              const data = await readFile(picked),
                type = await validateImage(data),
                token = rememberCover({ source: picked }),
                preview = `data:${type.mime};base64,${data.toString("base64")}`;
              value = { token, preview };
              break;
            }
            case "launchGame":
              value = await service.launch(checkString(args[0]));
              break;
            case "openGameDirectory": {
              const game = (await service.list()).find(
                (g) => g.id === checkString(args[0]),
              );
              if (!game) throw Error("游戏记录不存在");
              if (!isAbsolute(game.directory))
                throw Error("当前系统无法打开此路径，请在 Windows 中操作");
              if (!(await stat(game.directory)).isDirectory())
                throw Error("游戏目录不存在");
              const error = await shell.openPath(game.directory);
              if (error) throw Error("无法打开目录：" + error);
              break;
            }
            case "exportBackup": {
              const result = await dialog.showSaveDialog(window, {
                title: "导出游戏库备份",
                defaultPath: `花间备份-${new Date().toISOString().slice(0, 10)}.json`,
                filters: [{ name: "游戏库备份", extensions: ["json"] }],
              });
              if (result.canceled || !result.filePath) {
                value = false;
                break;
              }
              await service.transaction(async () =>
                exportBackup(
                  root,
                  await service.store.read(),
                  result.filePath!,
                ),
              );
              value = true;
              break;
            }
            case "previewImport": {
              const picked = selectedPath(
                await dialog.showOpenDialog(window, {
                  title: "选择游戏库备份",
                  properties: ["openFile"],
                  filters: [{ name: "游戏库备份", extensions: ["json"] }],
                }),
              );
              if (!picked) {
                value = null;
                break;
              }
              const backup = await validateBackup(picked),
                token = randomUUID();
              imports.clear();
              imports.set(token, backup);
              value = { token, count: backup.library.games.length };
              break;
            }
            case "confirmImport": {
              const token = checkString(args[0]),
                backup = imports.get(token);
              if (!backup) throw Error("备份选择已过期，请重新选择");
              value = (
                await service.transaction(() => restoreBackup(root, backup))
              ).games;
              imports.delete(token);
              break;
            }
            default:
              throw Error("不支持的操作");
          }
          return { ok: true, value };
        } catch (error) {
          return {
            ok: false,
            error: {
              code: "OPERATION_FAILED",
              message:
                error instanceof Error ? error.message : "操作失败，请重试",
            },
          };
        }
      },
    );
    async function createWindow() {
      window = new BrowserWindow({
        width: 1240,
        height: 850,
        minWidth: 640,
        minHeight: 580,
        backgroundColor: "#f7f8f5",
        title: "花间 · Galgame 管理器",
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, "../preload/index.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (e) => e.preventDefault());
      window.on("closed", () => {
        window = null;
      });
      if (dev) await window.loadURL("http://127.0.0.1:5173");
      else await window.loadURL("hanami://app/index.html");
    }
    app.on("second-instance", () => {
      window?.show();
      window?.focus();
    });
    app.on("activate", () => {
      if (!window) void createWindow();
    });
    await createWindow();
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
