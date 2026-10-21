import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyLibrary, type Library } from "../shared/model";
import { validateLibrary } from "../shared/validation";
export function createStore(root: string) {
  const file = join(root, "library.json");
  let blocked = false;
  let queue: Promise<unknown> = Promise.resolve();
  async function read(): Promise<Library> {
    try {
      const library = validateLibrary(JSON.parse(await readFile(file, "utf8")));
      blocked = false;
      return library;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyLibrary();
      blocked = true;
      throw Error("游戏库读取失败，已保留原文件。请从备份恢复或检查数据目录。");
    }
  }
  async function saveNow(library: Library) {
    if (blocked) throw Error("游戏库已锁定，避免覆盖损坏的数据");
    const data = validateLibrary(library);
    await mkdir(root, { recursive: true });
    await read();
    try {
      await copyFile(file, join(root, "library.previous.json"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const temp = join(root, `library.${randomUUID()}.tmp`);
    try {
      await writeFile(temp, JSON.stringify(data, null, 2), "utf8");
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  }
  return {
    read,
    save(library: Library): Promise<void> {
      const snapshot = structuredClone(library);
      const next = queue.then(() => saveNow(snapshot));
      queue = next.catch(() => {});
      return next;
    },
  };
}
