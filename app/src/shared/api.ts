import type { Game, GameDraft } from "./model";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };
export interface Selection {
  token: string;
  preview: string;
}
export interface DesktopApi {
  platform: string;
  preview: boolean;
  scanGames?(): Promise<Result<{ name: string; directory: string; executables: string[] }[] | null>>;
  listGames(): Promise<Result<Game[]>>;
  saveGame(
    draft: GameDraft,
    id?: string,
    coverToken?: string,
  ): Promise<Result<Game>>;
  deleteGame(id: string): Promise<Result<void>>;
  selectDirectory(): Promise<Result<string | null>>;
  selectExecutable(directory: string): Promise<Result<string | null>>;
  getExecutableCover(executable: string): Promise<Result<Selection | null>>;
  selectCover(): Promise<Result<Selection | null>>;
  launchGame(id: string): Promise<Result<void>>;
  openGameDirectory(id: string): Promise<Result<void>>;
  exportBackup(): Promise<Result<boolean>>;
  previewImport(): Promise<Result<{ token: string; count: number } | null>>;
  confirmImport(token: string): Promise<Result<Game[]>>;
}
declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
