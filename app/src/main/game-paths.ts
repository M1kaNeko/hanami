import { win32 } from "node:path";
import type { GameDraft } from "../shared/model";
export function assertGamePaths(draft: GameDraft, platform: NodeJS.Platform) {
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
