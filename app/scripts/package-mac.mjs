import { cp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
if (process.platform !== "darwin" || process.arch !== "arm64")
  throw Error("Run on an Apple Silicon Mac");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const target = resolve("release/Hanami-mac-arm64/Hanami.app");
await rm(target, { recursive: true, force: true });
await mkdir(resolve("release/Hanami-mac-arm64"), { recursive: true });
await cp("node_modules/electron/dist/Electron.app", target, {
  recursive: true,
  verbatimSymlinks: true,
});
await rename(
  join(target, "Contents/MacOS/Electron"),
  join(target, "Contents/MacOS/Hanami"),
);
const info = join(target, "Contents/Info.plist");
const data = JSON.parse(
  execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", info], {
    encoding: "utf8",
  }),
);
Object.assign(data, {
  CFBundleExecutable: "Hanami",
  CFBundleIdentifier: "local.mika.galgame.mac",
  CFBundleName: "Hanami",
  CFBundleDisplayName: "花间",
  CFBundleVersion: pkg.version,
  CFBundleShortVersionString: pkg.version,
});
const temp = resolve("release/mac-info.json");
await writeFile(temp, JSON.stringify(data));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", info, temp]);
await rm(temp);
const resources = join(target, "Contents/Resources");
await rm(join(resources, "default_app.asar"), { force: true });
const app = join(resources, "app");
await mkdir(app, { recursive: true });
await cp("dist", join(app, "dist"), { recursive: true });
for (const name of ["pngjs", "jpeg-js", "webp-wasm"])
  await cp(join("node_modules", name), join(app, "node_modules", name), {
    recursive: true,
  });
await writeFile(
  join(app, "package.json"),
  JSON.stringify({
    name: pkg.name,
    productName: "Hanami",
    version: pkg.version,
    main: "dist/main/index.cjs",
  }),
);
for (const v of ["7.3.5", "8.1.1"])
  await cp(
    join("engines", `renpy-${v}`),
    join(resources, "engines", `renpy-${v}`),
    { recursive: true },
  );
execFileSync(
  "/usr/bin/codesign",
  [
    "--force",
    "--deep",
    "--sign",
    "-",
    "--entitlements",
    resolve("scripts/mac-entitlements.plist"),
    target,
  ],
  { stdio: "inherit" },
);
execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", target], {
  stdio: "inherit",
});
console.log(target);
