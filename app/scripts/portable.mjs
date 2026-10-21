import { downloadArtifact } from "@electron/get";
import extract from "extract-zip";
import { cp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
const appPackage = JSON.parse(await readFile("package.json", "utf8"));
const arch = process.argv[2] ?? "arm64";
if (!["arm64", "x64"].includes(arch)) throw Error("Only arm64 or x64");
const version = JSON.parse(
  await readFile("node_modules/electron/package.json", "utf8"),
).version;
const zip = process.argv[3]
  ? resolve(process.argv[3])
  : await downloadArtifact({
      version,
      artifactName: "electron",
      platform: "win32",
      arch,
      mirrorOptions: process.env.ELECTRON_MIRROR
        ? { mirror: process.env.ELECTRON_MIRROR }
        : undefined,
    });
const target = resolve("release", `Hanami-windows-${arch}`);
await mkdir(target, { recursive: true });
await extract(zip, { dir: target });
await rename(join(target, "electron.exe"), join(target, "Hanami.exe"));
await rm(join(target, "resources", "default_app.asar"), { force: true });
const app = join(target, "resources", "app");
await mkdir(app, { recursive: true });
await cp("dist", join(app, "dist"), { recursive: true });
for (const dependency of ["pngjs", "jpeg-js", "webp-wasm"]) {
  await mkdir(join(app, "node_modules"), { recursive: true });
  await cp(
    join("node_modules", dependency),
    join(app, "node_modules", dependency),
    { recursive: true },
  );
}
await writeFile(
  join(app, "package.json"),
  JSON.stringify({
    name: "galgame-manager",
    productName: "Hanami",
    version: appPackage.version,
    main: "dist/main/index.cjs",
    description: "花间 · Galgame 管理器",
  }),
);
await writeFile(
  join(target, "使用说明.txt"),
  "花间 · Galgame 管理器\r\n请完整解压这个文件夹，再双击 Hanami.exe。不要只复制 exe 文件。\r\n数据保存在当前 Windows 用户的应用数据目录中。游戏程序与存档不会包含在备份里。\r\n",
);
console.log(target);
