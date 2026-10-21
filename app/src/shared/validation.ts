import { statuses, type GameDraft, type Library, type Game } from "./model";
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("数据格式不正确");
  return input as Record<string, unknown>;
}
function text(v: unknown, max: number, required = false): string {
  if (typeof v !== "string" || v.length > max || v.includes("\0"))
    throw Error("文本格式或长度不正确");
  const s = v.trim();
  if (required && !s) throw Error("请填写名称、目录和启动程序");
  return s;
}
export function validCover(ref: unknown): ref is string {
  return typeof ref === "string" && /^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(ref);
}
export function normalizeExecutable(path: string): string {
  const parts: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (
      segment === ".." &&
      parts.length &&
      parts.at(-1) !== ".." &&
      !/^[a-z]:$/i.test(parts.at(-1)!)
    )
      parts.pop();
    else parts.push(segment);
  }
  return parts.join("/").toLowerCase();
}
export function validateDraft(input: unknown): GameDraft {
  const d = record(input);
  const name = text(d.name, 200, true),
    directory = text(d.directory, 4000, true),
    executable = text(d.executable, 4000, true);
  if (!/\.exe$/i.test(executable)) throw Error("请选择 .exe 启动程序");
  if (typeof d.status !== "string" || !Object.hasOwn(statuses, d.status))
    throw Error("游玩状态不正确");
  if (
    d.rating !== null &&
    (typeof d.rating !== "number" ||
      !Number.isInteger(d.rating) ||
      d.rating < 1 ||
      d.rating > 10)
  )
    throw Error("评分请填写 1–10 的整数");
  if (!Array.isArray(d.tags) || d.tags.length > 30)
    throw Error("标签数量不正确");
  if (d.cover !== null && !validCover(d.cover)) throw Error("封面引用不正确");
  return {
    name,
    directory,
    executable,
    status: d.status as GameDraft["status"],
    rating: d.rating as number | null,
    cover: d.cover as string | null,
    tags: [...new Set(d.tags.map((t) => text(t, 40, true)))],
    notes: text(d.notes, 20000),
  };
}
export function validateLibrary(input: unknown): Library {
  const d = record(input);
  if (
    d.schemaVersion !== 1 ||
    !Array.isArray(d.games) ||
    d.games.length > 10000
  )
    throw Error("游戏库格式或版本不支持");
  const ids = new Set<string>(),
    paths = new Set<string>();
  const games = d.games.map((raw): Game => {
    const g = record(raw),
      draft = validateDraft(g);
    const id = text(g.id, 100, true);
    if (ids.has(id)) throw Error("游戏 ID 重复");
    ids.add(id);
    const p = normalizeExecutable(draft.executable);
    if (paths.has(p)) throw Error("启动路径重复");
    paths.add(p);
    function time(v: unknown) {
      const s = text(v, 40, true);
      if (!Number.isFinite(Date.parse(s))) throw Error("日期无效");
      return s;
    }
    return {
      ...draft,
      id,
      createdAt: time(g.createdAt),
      updatedAt: time(g.updatedAt),
      lastLaunchedAt: g.lastLaunchedAt === null ? null : time(g.lastLaunchedAt),
    };
  });
  return { schemaVersion: 1, games };
}
