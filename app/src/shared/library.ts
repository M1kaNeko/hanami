import type { Game, GameStatus } from "./model";
export function filterGames(
  games: Game[],
  filter: { query: string; status: GameStatus | "all"; tag: string | null },
): Game[] {
  const q = filter.query.trim().toLocaleLowerCase();
  return games
    .filter(
      (g) =>
        (filter.status === "all" || g.status === filter.status) &&
        (!filter.tag || g.tags.includes(filter.tag)) &&
        (!q || [g.name, ...g.tags].join(" ").toLocaleLowerCase().includes(q)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
