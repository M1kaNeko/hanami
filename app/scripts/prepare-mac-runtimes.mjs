// Copy minimal, unmodified runtime files from the corresponding official SDKs.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const source = resolve(process.argv[2] ?? "../work/renpy-runtimes");
for (const [version, platform, stdlib] of [
  ["7.3.5", "darwin-x86_64", "pythonlib2.7"],
  ["8.1.1", "py3-mac-universal", "python3.9"],
]) {
  const sdk = join(source, `renpy-${version}-sdk`),
    target = resolve("engines", `renpy-${version}`);
  await mkdir(join(target, "lib"), { recursive: true });
  for (const ref of [
    "renpy",
    "renpy.py",
    "renpy.sh",
    "LICENSE.txt",
    `lib/${platform}`,
    `lib/${stdlib}`,
  ])
    await cp(join(sdk, ref), join(target, ref), { recursive: true });
  await writeFile(
    join(target, "provenance.json"),
    JSON.stringify(
      {
        engine: "RenPy",
        version,
        source: `https://www.renpy.org/release/${version}`,
        archive: `https://www.renpy.org/dl/${version}/renpy-${version}-sdk.tar.bz2`,
        checksums: `https://www.renpy.org/dl/${version}/checksums.txt`,
        changes:
          "Unmodified runtime files selected from official SDK; development tools, samples, documentation and other platform runtimes omitted.",
      },
      null,
      2,
    ),
  );
  console.log(target);
}
