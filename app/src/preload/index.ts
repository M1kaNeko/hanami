import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api";
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke("hanami", method, ...args);
const api: DesktopApi = {
  platform: process.platform,
  preview: false,
  listGames: () => call("listGames"),
  saveGame: (d, id, token) => call("saveGame", d, id, token),
  deleteGame: (id) => call("deleteGame", id),
  selectDirectory: () => call("selectDirectory"),
  selectExecutable: (dir) => call("selectExecutable", dir),
  selectCover: () => call("selectCover"),
  launchGame: (id) => call("launchGame", id),
  openGameDirectory: (id) => call("openGameDirectory", id),
  exportBackup: () => call("exportBackup"),
  previewImport: () => call("previewImport"),
  confirmImport: (token) => call("confirmImport", token),
};
contextBridge.exposeInMainWorld("desktop", api);
