import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, readdir, rm } from "node:fs/promises";
import type { GameDraft, Game } from "../shared/model";
import {
  launchKey,
  validateDraft,
  validateLibrary,
  validCover,
} from "../shared/validation";
import { createStore } from "./store";
import { launchGame } from "./launcher";
export function createService(
  root: string,
  options: {
    enginePath?: string;
    nativeLaunch?: (game: Game, saveDirectory: string) => Promise<void>;
  } = {},
) {
  const store = createStore(root);
  let queue: Promise<unknown> = Promise.resolve();
  function transaction<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn);
    queue = next.catch(() => {});
    return next;
  }
  async function cleanupCovers(current: Game[]) {
    try {
      const previous = validateLibrary(
        JSON.parse(await readFile(join(root, "library.previous.json"), "utf8")),
      );
      const keep = new Set(
        [...current, ...previous.games].flatMap((g) =>
          g.cover ? [g.cover] : [],
        ),
      );
      for (const ref of await readdir(join(root, "covers")))
        if (validCover(ref) && !keep.has(ref))
          await rm(join(root, "covers", ref), { force: true });
    } catch {
      /* Preserve files if either snapshot cannot be inspected. */
    }
  }
  return {
    store,
    transaction,
    list: () => store.read().then((l) => l.games),
    save: (draft: GameDraft, id?: string) =>
      transaction(async () => {
        const d = validateDraft(draft);
        const library = await store.read();
        if (id && !library.games.some((g) => g.id === id))
          throw Error("这条记录已不存在，请刷新");
        if (
          library.games.some(
            (g) => g.id !== id && launchKey(g) === launchKey(d),
          )
        )
          throw Error("这个启动程序已经添加过了");
        const now = new Date().toISOString(),
          old = library.games.find((g) => g.id === id);
        const game: Game = {
          ...d,
          id: old?.id ?? randomUUID(),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          lastLaunchedAt: old?.lastLaunchedAt ?? null,
        };
        library.games = old
          ? library.games.map((g) => (g.id === id ? game : g))
          : [...library.games, game];
        await store.save(library);
        await cleanupCovers(library.games);
        return game;
      }),
    delete: (id: string) =>
      transaction(async () => {
        const library = await store.read(),
          game = library.games.find((g) => g.id === id);
        if (!game) throw Error("这条记录已不存在");
        library.games = library.games.filter((g) => g.id !== id);
        await store.save(library);
        await cleanupCovers(library.games);
      }),
    launch: (id: string) =>
      transaction(async () => {
        const library = await store.read(),
          game = library.games.find((g) => g.id === id);
        if (!game) throw Error("这条记录已不存在");
        const saveDirectory = join(
          root,
          "saves",
          createHash("sha256").update(game.id).digest("hex"),
        );
        if (game.launchMode === "native") {
          if (process.platform !== "darwin" || !options.nativeLaunch)
            throw Error("此游戏需要在 Mac 版花间中使用原生运行");
          await options.nativeLaunch(game, saveDirectory);
        } else
          await launchGame(
            game,
            process.platform,
            options.enginePath ?? "",
            join(
              root,
              "saves",
              createHash("sha256").update(game.id).digest("hex"),
            ),
          );
        game.lastLaunchedAt = new Date().toISOString();
        await store.save(library);
      }),
  };
}
