import { readdir, realpath } from "node:fs/promises";
import { join, basename } from "node:path";
export interface ScanCandidate {
  name: string;
  directory: string;
  executables: string[];
}
export async function scanGames(root: string): Promise<ScanCandidate[]> {
  const base = await realpath(root);
  const result: ScanCandidate[] = [];
  let visited = 0;
  async function walk(dir: string, depth: number) {
    if (++visited > 5000)
      throw Error("目录超过 5000 个，请选择更具体的主文件夹");
    const entries = await readdir(dir, { withFileTypes: true });
    const executables = entries
      .filter(
        (e) =>
          e.isFile() &&
          /\.exe$/i.test(e.name) &&
          !/^(unins|uninstall|setup|install|vcredist|dxsetup|crash|update|patch)/i.test(
            e.name,
          ),
      )
      .map((e) => join(dir, e.name))
      .sort();
    if (executables.length)
      result.push({ name: basename(dir), directory: dir, executables });
    if (depth >= 6) return;
    for (const e of entries) {
      if (
        !e.isDirectory() ||
        e.name.startsWith(".") ||
        /^(node_modules|plugin|plugins|redist|windows|renpy|lib|saves)$/i.test(
          e.name,
        )
      )
        continue;
      try {
        await walk(join(dir, e.name), depth + 1);
      } catch (error) {
        if (
          !["EACCES", "EPERM", "ENOENT"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw error;
      }
    }
  }
  await walk(base, 0);
  return result;
}
