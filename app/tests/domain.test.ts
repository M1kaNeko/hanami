import { describe, it, expect } from "vitest";
import {
  validateDraft,
  validateLibrary,
  normalizeExecutable,
} from "../src/shared/validation";
import { filterGames } from "../src/shared/library";
import type { GameDraft, Game } from "../src/shared/model";
export const draft: GameDraft = {
  name: "白色相簿",
  directory: "C:\\Games",
  executable: "C:\\Games\\a.exe",
  cover: null,
  tags: ["剧情"],
  status: "wishlist",
  rating: null,
  notes: "",
};
export const game: Game = {
  ...draft,
  id: "one",
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  lastLaunchedAt: null,
};
describe("游戏模型", () => {
  it("清理文本，保留可空评分", () => {
    expect(validateDraft({ ...draft, name: " 游戏 " })).toMatchObject({
      name: "游戏",
      rating: null,
    });
  });
  it.each([0, 11, 1.5])("拒绝非法评分 %s", (rating) =>
    expect(() => validateDraft({ ...draft, rating })).toThrow(),
  );
  it.each([null, 1, 10])("允许评分 %s", (rating) =>
    expect(validateDraft({ ...draft, rating }).rating).toBe(rating),
  );
  it("拒绝空名称和未知状态", () => {
    expect(() => validateDraft({ ...draft, name: " " })).toThrow();
    expect(() => validateDraft({ ...draft, status: "bad" } as never)).toThrow();
  });
  it("Windows 路径忽略大小写和分隔符", () =>
    expect(normalizeExecutable("C:\\Games\\A.exe")).toBe(
      normalizeExecutable("c:/games/a.exe"),
    ));
  it("组合筛选并排序", () => {
    const newer = {
      ...game,
      id: "two",
      status: "playing" as const,
      updatedAt: "2026-10-22T00:00:00.000Z",
    };
    expect(
      filterGames([game, newer], {
        query: "剧情",
        status: "playing",
        tag: "剧情",
      }),
    ).toEqual([newer]);
    expect(
      filterGames([game, newer], { query: "", status: "all", tag: null })[0].id,
    ).toBe("two");
  });
  it("拒绝重复 ID 和不支持的版本", () => {
    expect(() => validateLibrary({ schemaVersion: 2, games: [] })).toThrow();
    expect(() =>
      validateLibrary({ schemaVersion: 1, games: [game, game] }),
    ).toThrow();
  });
});
it("点路径和连续分隔符归一到同一程序", () => {
  expect(normalizeExecutable("C:\\Games\\sub\\..\\a.exe")).toBe(
    normalizeExecutable("C:\\Games\\a.exe"),
  );
  expect(normalizeExecutable("C:\\Games\\\\a.exe")).toBe(
    normalizeExecutable("C:\\Games\\a.exe"),
  );
});
