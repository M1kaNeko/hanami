import { _electron as electron } from "playwright";
import { resolve, join } from "node:path";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
} from "node:fs/promises";
import assert from "node:assert/strict";
const root = await mkdtemp(resolve("../work/mac-native-"));
const app = await electron.launch({
  args: ["."],
  env: { ...process.env, HANAMI_DATA_DIR: root },
});
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.desktop));
  await app.evaluate(() => {
    const cp = process.getBuiltinModule("child_process");
    const original = cp.spawn;
    globalThis.hanamiChildren = [];
    cp.spawn = function (...args) {
      const c = original(...args);
      if (String(args[0]).includes("/engines/renpy-"))
        globalThis.hanamiChildren.push(c.pid);
      return c;
    };
  });
  // Exercise real save IPC after the native game's folder goes away.
  const missing = join(root, "offline-game");
  await mkdir(join(missing, "tyrano"), { recursive: true });
  await writeFile(join(missing, "index.html"), "test");
  const draft = {
    name: "离线目录测试",
    directory: missing,
    executable: "",
    launchMode: "native",
    cover: null,
    tags: [],
    status: "wishlist",
    rating: null,
    notes: "",
  };
  const added = await page.evaluate((d) => window.desktop.saveGame(d), draft);
  assert(added.ok);
  await rm(missing, { recursive: true });
  const edited = await page.evaluate(
    (g) =>
      window.desktop.saveGame(
        { ...g, status: "completed", notes: "离线也能编辑", rating: 8 },
        g.id,
      ),
    added.value,
  );
  assert(edited.ok);
  await page.evaluate((id) => window.desktop.deleteGame(id), added.value.id);
  const results = [];
  for (const [number, name] of [
    [1, "Tyrano 测试"],
    [2, "RenPy 7 测试"],
    [3, "RenPy 8 测试"],
  ]) {
    const directory = resolve(
      `../work/game-tests/game-${number}/original-copy`,
    );
    const r = await page.evaluate((d) => window.desktop.saveGame(d), {
      ...draft,
      name,
      directory,
    });
    assert(r.ok, JSON.stringify(r));
    const launch = await page.evaluate(
      (id) => window.desktop.launchGame(id),
      r.value.id,
    );
    assert(launch.ok, JSON.stringify(launch));
    results.push({ number, id: r.value.id, directory, launchIpc: true });
    console.log("launched", number);
  }
  const tyrano = (await app.windows()).find((w) =>
    w.url().startsWith("game://local/"),
  );
  assert(tyrano);
  await tyrano.waitForFunction(
    () => window.TYRANO?.kag?.stat?.current_scenario,
    { timeout: 30000 },
  );
  const isolation = await tyrano.evaluate(() => ({
    desktop: typeof window.desktop,
    node: typeof require,
    nw: $.isNWJS(),
    scenario: TYRANO.kag.stat.current_scenario,
  }));
  assert.equal(isolation.desktop, "undefined");
  assert.equal(isolation.node, "undefined");
  const deadline = Date.now() + 40000;
  let logs = [];
  while (Date.now() < deadline) {
    logs = [];
    async function walk(p) {
      for (const e of await readdir(p, { withFileTypes: true }).catch(
        () => [],
      )) {
        const file = join(p, e.name);
        if (e.isDirectory()) await walk(file);
        else if (e.name === "log.txt") logs.push(await readFile(file, "utf8"));
      }
    }
    await walk(join(root, "saves"));
    if (logs.filter((s) => s.includes("Interface start")).length >= 2) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(
    logs.filter((s) => s.includes("Interface start")).length >= 2,
    "RenPy startup logs not ready",
  );
  const games = await page.evaluate(() => window.desktop.listGames());
  assert(games.ok && games.value.every((g) => g.lastLaunchedAt));
  const report = {
    offlineMetadataSave: true,
    results,
    tyranoSandbox: isolation,
    renpyStartupReady: 2,
    root,
  };
  await writeFile(
    resolve("../work/mac-native-check-result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await app
    .evaluate(() => {
      for (const pid of globalThis.hanamiChildren ?? [])
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
    })
    .catch(() => {});
  const timer = setTimeout(() => app.process().kill("SIGTERM"), 3000);
  try {
    await app.close();
  } finally {
    clearTimeout(timer);
  }
}
