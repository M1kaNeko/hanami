export const statuses = {
  wishlist: "想玩",
  playing: "在玩",
  completed: "已通关",
  paused: "搁置",
} as const;
export type GameStatus = keyof typeof statuses;
export interface GameDraft {
  name: string;
  directory: string;
  executable: string;
  cover: string | null;
  tags: string[];
  status: GameStatus;
  rating: number | null;
  notes: string;
}
export interface Game extends GameDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt: string | null;
}
export interface Library {
  schemaVersion: 1;
  games: Game[];
}
export const emptyLibrary = (): Library => ({ schemaVersion: 1, games: [] });
