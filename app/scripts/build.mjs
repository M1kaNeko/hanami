import { transform } from "esbuild";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
// Transform source read by Node. Keep desktop modules separate for debugging.
async function compileDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const src = join(source, entry.name),
      out = join(destination, entry.name.replace(/\.ts$/, ".js"));
    if (entry.isDirectory()) await compileDirectory(src, out);
    else if (entry.name.endsWith(".ts")) {
      const result = await transform(await readFile(src, "utf8"), {
        loader: "ts",
        format: "cjs",
        target: "node22",
        sourcemap: "inline",
        sourcefile: src,
      });
      await writeFile(out, result.code);
    }
  }
}
await compileDirectory("src/main", "dist/main");
await compileDirectory("src/shared", "dist/shared");
await mkdir("dist/preload", { recursive: true });
const preload = await transform(
  await readFile("src/preload/index.ts", "utf8"),
  { loader: "ts", format: "cjs", target: "node22" },
);
await writeFile("dist/preload/index.cjs", preload.code);
await writeFile("dist/main/index.cjs", await readFile("dist/main/index.js"));
await writeFile("dist/package.json", JSON.stringify({ type: "commonjs" }));
