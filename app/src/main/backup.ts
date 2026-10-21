import {
  readFile,
  writeFile,
  stat,
  mkdir,
  rename,
  rm,
  copyFile,
  cp,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Library } from "../shared/model";
import { validateLibrary, validCover } from "../shared/validation";
import { imageType, validateImage, MAX_IMAGE } from "./covers";
import { createStore } from "./store";
const MAX_BACKUP = 100 * 1024 * 1024;
export interface ValidatedBackup {
  format: "galgame-manager-backup";
  version: 1;
  library: Library;
  covers: { reference: string; mime: string; base64: string }[];
}
export async function exportBackup(
  root: string,
  library: Library,
  destination: string,
): Promise<void> {
  validateLibrary(library);
  const covers = [];
  for (const reference of new Set(
    library.games.flatMap((g) => (g.cover ? [g.cover] : [])),
  )) {
    const path = join(root, "covers", reference);
    if ((await stat(path)).size > MAX_IMAGE) throw Error("封面过大");
    const data = await readFile(path);
    covers.push({
      reference,
      mime: (await validateImage(data)).mime,
      base64: data.toString("base64"),
    });
  }
  const text = JSON.stringify({
    format: "galgame-manager-backup",
    version: 1,
    library,
    covers,
  });
  if (Buffer.byteLength(text) > MAX_BACKUP) throw Error("备份不能超过 100 MiB");
  const temp = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, text);
    await rename(temp, destination);
  } finally {
    await rm(temp, { force: true });
  }
}
export async function validateBackup(source: string): Promise<ValidatedBackup> {
  if ((await stat(source)).size > MAX_BACKUP)
    throw Error("备份不能超过 100 MiB");
  const b = JSON.parse(await readFile(source, "utf8"));
  if (
    b.format !== "galgame-manager-backup" ||
    b.version !== 1 ||
    !Array.isArray(b.covers) ||
    b.covers.length > 10000
  )
    throw Error("备份格式或版本不支持");
  const library = validateLibrary(b.library),
    seen = new Set<string>();
  const covers = await Promise.all(
    b.covers.map(async (c: any) => {
      if (
        !validCover(c.reference) ||
        seen.has(c.reference) ||
        typeof c.base64 !== "string" ||
        c.base64.length > Math.ceil(MAX_IMAGE / 3) * 4 ||
        c.base64.length % 4 !== 0 ||
        /[^A-Za-z0-9+/=]/.test(c.base64)
      )
        throw Error("备份封面无效");
      seen.add(c.reference);
      const data = Buffer.from(c.base64, "base64"),
        type = await validateImage(data);
      if (data.toString("base64") !== c.base64) throw Error("备份封面编码无效");
      if (type.mime !== c.mime || !c.reference.endsWith(`.${type.ext}`))
        throw Error("图片格式不匹配");
      return { reference: c.reference, mime: c.mime, base64: c.base64 };
    }),
  );
  for (const g of library.games)
    if (g.cover && !seen.has(g.cover)) throw Error("备份缺少封面");
  return { format: "galgame-manager-backup", version: 1, library, covers };
}
export async function restoreBackup(
  root: string,
  backup: ValidatedBackup,
): Promise<Library> {
  await mkdir(root, { recursive: true });
  let damaged = false;
  let current: Library | undefined;
  try {
    current = await createStore(root).read();
  } catch {
    damaged = true;
    await copyFile(
      join(root, "library.json"),
      join(root, `damaged-before-import-${Date.now()}-${randomUUID()}.json`),
    );
  }
  if (current) {
    try {
      await exportBackup(
        root,
        current,
        join(root, `before-import-${Date.now()}-${randomUUID()}.json`),
      );
    } catch {
      const recovery = join(
        root,
        `incomplete-before-import-${Date.now()}-${randomUUID()}`,
      );
      await mkdir(recovery);
      await copyFile(
        join(root, "library.json"),
        join(recovery, "library.json"),
      );
      try {
        await cp(join(root, "covers"), join(recovery, "covers"), {
          recursive: true,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await writeFile(
        join(recovery, "说明.txt"),
        "恢复前的库包含缺失或损坏的封面，已保留原始清单与现存封面。",
      );
    }
  }
  const stage = join(root, `import-${randomUUID()}`);
  await mkdir(stage);
  const added: string[] = [];
  await mkdir(join(root, "covers"), { recursive: true });
  // Existing covers are never overwritten: remap imported names, then switch only the library.
  const library = structuredClone(backup.library),
    names = new Map<string, string>();
  try {
    for (const c of backup.covers) {
      const ref = `${randomUUID()}.${imageType(Buffer.from(c.base64, "base64")).ext}`;
      names.set(c.reference, ref);
      await writeFile(join(stage, ref), Buffer.from(c.base64, "base64"));
      await copyFile(join(stage, ref), join(root, "covers", ref));
      added.push(ref);
    }
    for (const g of library.games) if (g.cover) g.cover = names.get(g.cover)!;
    if (damaged) {
      await createStore(stage).save(library);
      await rename(join(stage, "library.json"), join(root, "library.json"));
    } else await createStore(root).save(library);
    return library;
  } catch (e) {
    await Promise.all(
      added.map((ref) => rm(join(root, "covers", ref), { force: true })),
    );
    throw e;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
