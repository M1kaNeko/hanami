import { win32, posix } from "node:path";
import type { GameDraft } from "../shared/model";
export function assertGamePaths(draft: GameDraft, platform: NodeJS.Platform) {
  if (draft.launchMode === "native") {
    if (platform !== "darwin") throw Error("原生运行模式只支持 Mac");
    if (!posix.isAbsolute(draft.directory))
      throw Error("请选择 Mac 上实际的游戏目录");
    return;
  }
  if (platform !== "win32") return;
  if (!win32.isAbsolute(draft.directory))
    throw Error("请选择 Windows 绝对路径");
  if (draft.launchMode === "kirikiri") return;
  if (!win32.isAbsolute(draft.executable))
    throw Error("请选择 Windows 绝对路径");
  const rel = win32.relative(draft.directory, draft.executable);
  if (rel.startsWith("..") || win32.isAbsolute(rel))
    throw Error("启动程序需要位于游戏目录内");
}
