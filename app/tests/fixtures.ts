import type { Game, GameDraft } from "../src/shared/model";
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
