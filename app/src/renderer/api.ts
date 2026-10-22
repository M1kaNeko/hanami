import type { DesktopApi, Result, Selection } from "../shared/api";
import type { Game } from "../shared/model";
import { validateDraft, launchKey } from "../shared/validation";
const previewCovers = new Map<string, string>();
export function coverUrl(ref: string | null): string | undefined {
  return ref ? (previewCovers.get(ref) ?? `covers://image/${ref}`) : undefined;
}
const success = <T>(value: T): Result<T> => ({ ok: true, value });
const failure = (message: string): Result<never> => ({
  ok: false,
  error: { code: "PREVIEW", message },
});
export function createPreviewApi(): DesktopApi {
  let games: Game[] = [];
  const selections = new Map<string, string>();
  return {
    platform: "browser",
    preview: true,
    listGames: async () => success(structuredClone(games)),
    saveGame: async (draft, id, token) => {
      try {
        const d = validateDraft(draft);
        if (games.some((g) => g.id !== id && launchKey(g) === launchKey(d)))
          throw Error("这个启动程序已经添加过了");
        const old = games.find((g) => g.id === id),
          now = new Date().toISOString();
        if (token) {
          const selected = selections.get(token);
          if (!selected) throw Error("请重新选择封面");
          d.cover = `${crypto.randomUUID()}.png`;
          previewCovers.set(d.cover, selected);
        }
        const game: Game = {
          ...d,
          id: old?.id ?? crypto.randomUUID(),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          lastLaunchedAt: old?.lastLaunchedAt ?? null,
        };
        games = old
          ? games.map((g) => (g.id === id ? game : g))
          : [...games, game];
        return success(structuredClone(game));
      } catch (e) {
        return failure((e as Error).message);
      }
    },
    deleteGame: async (id) => {
      games = games.filter((g) => g.id !== id);
      return success(undefined);
    },
    selectDirectory: async () =>
      failure("浏览器预览请手动填写路径；桌面版可选择文件夹"),
    selectExecutable: async () => failure("浏览器预览请手动填写 .exe 路径"),
    getExecutableCover: async () => success(null),
    selectCover: async () =>
      new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp";
        input.oncancel = () => resolve(success(null));
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(success(null));
            return;
          }
          if (file.size > 10 * 1024 * 1024) {
            resolve(failure("封面不能超过 10 MiB"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const preview = String(reader.result),
              token = crypto.randomUUID();
            selections.set(token, preview);
            resolve(success({ token, preview }));
          };
          reader.onerror = () => resolve(failure("图片读取失败"));
          reader.readAsDataURL(file);
        };
        input.click();
      }),
    launchGame: async () => failure("请在 Windows 桌面版中启动游戏"),
    openGameDirectory: async () => failure("请在桌面版中打开游戏目录"),
    exportBackup: async () =>
      failure("备份请在桌面版中操作；预览数据仅保留到刷新"),
    previewImport: async () => failure("请在桌面版中恢复备份"),
    confirmImport: async () => failure("请在桌面版中恢复备份"),
  };
}
export const desktopApi: DesktopApi = window.desktop ?? createPreviewApi();
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw Error(r.error.message);
  return r.value;
}
