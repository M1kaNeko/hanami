const { mkdir, writeFile, readFile, readdir } = require("node:fs/promises");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const packageRoot = resolve(process.argv[2] || ".");
const { createService } = require(
  join(packageRoot, "resources/app/dist/main/service.js"),
);
(async () => {
  const { mkdtemp } = require("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "hanami-kirikiri-")),
    directory = join(root, "test-game");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "startup.tjs"),
    'Debug.startLogToFile(true); Plugins.link("menu.dll"); var w = new Window(); w.caption = "Hanami Kirikiri test"; w.width=640; w.height=360; w.visible=true; Debug.message("HANAMI_KIRIKIRI_SMOKE_OK"); System.exit();',
    "utf16le",
  );
  // TJS reads BOM-marked UTF-16LE scripts.
  const raw = await readFile(join(directory, "startup.tjs"));
  await writeFile(
    join(directory, "startup.tjs"),
    Buffer.concat([Buffer.from([255, 254]), raw]),
  );
  const service = createService(root, {
    enginePath: join(packageRoot, "resources/engines/kirikiri/krkrz.exe"),
  });
  const game = await service.save({
    name: "Engine smoke",
    directory,
    executable: "",
    launchMode: "kirikiri",
    cover: null,
    tags: [],
    status: "wishlist",
    rating: null,
    notes: "",
  });
  await service.launch(game.id);
  let matched = false,
    logs = [];
  async function visit(dir) {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(
      () => [],
    )) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await visit(p);
      else {
        const b = await readFile(p);
        logs.push(p);
        if (
          b.toString("utf16le").includes("HANAMI_KIRIKIRI_SMOKE_OK") ||
          b.toString().includes("HANAMI_KIRIKIRI_SMOKE_OK")
        )
          matched = true;
      }
    }
  }
  for (let i = 0; i < 30 && !matched; i++) {
    logs = [];
    await visit(join(root, "saves"));
    if (!matched) await new Promise((r) => setTimeout(r, 300));
  }
  console.log(
    JSON.stringify({
      runtimeMarker: matched,
      launchRecorded: Boolean((await service.list())[0].lastLaunchedAt),
      logs,
    }),
  );
  if (!matched) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
