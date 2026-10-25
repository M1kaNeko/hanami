import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const require = createRequire(resolve("dist/main/index.cjs"));
const { prepareRenpyProject, renpyCommand } = require("./native-game.js");
const root = await mkdtemp(join(tmpdir(), "hanami-isolation-"));
for (const version of ["7.3.5", "8.1.1"]) {
  const original = join(root, version, "original"),
    save = join(root, version, "managed");
  await mkdir(join(original, "game", "saves"), { recursive: true });
  await writeFile(
    join(original, "game/saves/persistent"),
    "SOURCE_PERSISTENT_SENTINEL",
  );
  await writeFile(
    join(original, "game/saves/hanami-probe-LT1.save"),
    "SOURCE_SLOT_SENTINEL",
  );
  const source = `init python:
    import os, json
    config.name = "Hanami isolation check"
    config.save_directory = "hanami-isolation-check"
label start:
    $ marker = os.path.join(config.savedir, "saved-marker")
    $ report = os.path.join(config.savedir, "result.json")
    if os.path.exists(report):
        $ assert persistent.hanami_isolated == "persisted"
        $ open(os.path.join(config.savedir, "persistent-reloaded"), "w").write("ok")
        $ renpy.quit()
    $ value = "initial"
    $ renpy.pause(0.1)
    $ renpy.checkpoint()
    $ persistent.hanami_isolated = "persisted"
    $ renpy.save_persistent()
    if not os.path.exists(marker):
        $ renpy.save("hanami-probe")
        $ open(marker, "w").write("saved")
        $ value = "changed"
        $ renpy.load("hanami-probe")
    $ assert value == "initial"
    $ open(report, "w").write(json.dumps(dict(macapp=renpy.macapp, value=value, savedir=config.savedir, locations=[l.directory for l in renpy.loadsave.location.locations])))
    $ renpy.quit()
`;
  await writeFile(join(original, "game/script.rpy"), source);
  const project = await prepareRenpyProject(original, save);
  const savedir = join(save, "saves");
  await mkdir(savedir, { recursive: true });
  const command = renpyCommand(
    { kind: "renpy", version, directory: project },
    resolve("engines"),
    savedir,
  );
  for (let attempt = 0; attempt < 2; attempt++)
    await new Promise((ok, no) => {
      const c = spawn(command.file, command.args, {
        cwd: original,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, RENPY_SKIP_MAIN_MENU: "1", RENPY_LOG_BASE: save },
      });
      let log = "";
      c.stdout.on("data", (x) => (log += x));
      c.stderr.on("data", (x) => (log += x));
      const timer = setTimeout(() => {
        c.kill("SIGTERM");
        no(Error(version + " timeout " + log));
      }, 45000);
      c.on("error", no);
      c.on("exit", (code) => {
        clearTimeout(timer);
        code === 0 ? ok() : no(Error(version + " failed " + code + " " + log));
      });
    });
  const result = JSON.parse(
    await readFile(join(savedir, "result.json"), "utf8"),
  );
  assert.equal(result.macapp, true);
  assert.deepEqual(result.locations, version === "8.1.1" ? [savedir, join(savedir, "sync")] : [savedir]);
  assert.equal(
    await readFile(join(savedir, "persistent-reloaded"), "utf8"),
    "ok",
  );
  assert.equal(
    await readFile(join(original, "game/saves/persistent"), "utf8"),
    "SOURCE_PERSISTENT_SENTINEL",
  );
  assert.equal(
    await readFile(join(original, "game/saves/hanami-probe-LT1.save"), "utf8"),
    "SOURCE_SLOT_SENTINEL",
  );
  assert.deepEqual((await readdir(join(original, "game/saves"))).sort(), [
    "hanami-probe-LT1.save",
    "persistent",
  ]);
  console.log(
    JSON.stringify({
      version,
      saveLoadRoundtrip: true,
      persistentRoundtrip: true,
      originalSavesUntouched: true,
      root,
    }),
  );
}
