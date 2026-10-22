import { _electron as electron } from "playwright";
import { resolve, join } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = await mkdtemp(resolve("../work/update-")),
  directory = join(root, "夏日回忆"),
  executable = join(directory, "Engine.exe");
await mkdir(directory);
await writeFile(executable, "test fixture, not executable");
let app;
async function start() {
  return electron.launch({
    args: [".", "--disable-gpu"],
    env: { ...process.env, HANAMI_DATA_DIR: join(root, "data") },
  });
}
async function close() {
  if (!app) return;
  const timer = setTimeout(() => app.process().kill("SIGTERM"), 3000);
  try {
    await app.close();
  } finally {
    clearTimeout(timer);
  }
}
try {
  app = await start();
  await app.evaluate(
    ({ dialog }, paths) => {
      let selection = 0;
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [selection++ === 0 ? paths.directory : paths.executable],
      });
    },
    { directory, executable },
  );
  const page = await app.firstWindow();
  await page.getByText("每个故事，都值得珍藏。").waitFor();
  await page
    .getByRole("button", { name: "添加游戏", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "选择游戏目录" }).click();
  await page.getByRole("button", { name: "选择启动程序" }).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelector('[aria-label="启动程序"]').value === expected,
    executable,
  );
  assert.equal(
    await page.getByLabel("游戏名称", { exact: true }).inputValue(),
    "夏日回忆",
  );
  await page.getByRole("button", { name: "保存游戏" }).click();
  await page.getByRole("button", { name: "查看 夏日回忆" }).waitFor();
  await page
    .locator(".game-card")
    .dragTo(page.getByRole("button", { name: /^在玩/ }),{sourcePosition:{x:30,y:35}});
  await page.getByText("已将「夏日回忆」移到在玩", { exact: true }).waitFor();
  let result = await page.evaluate(() => window.desktop.listGames());
  assert.equal(result.value[0].status, "playing");
  await page.getByRole("button", { name: "列表视图" }).click();
  await page
    .locator(".game-card")
    .dragTo(page.getByRole("button", { name: /^已通关/ }),{sourcePosition:{x:30,y:35}});
  await page.getByText("已将「夏日回忆」移到已通关", { exact: true }).waitFor();
  result = await page.evaluate(() => window.desktop.listGames());
  assert.equal(result.value[0].status, "completed");
  await page.getByRole("button", { name: "网格视图" }).click();
  const palettes = {};
  for (const [id, label] of [
    ["pink", "樱花粉"],
    ["blue", "雾蓝"],
  ]) {
    await page.getByRole("button", { name: "切换配色" }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      id,
    );
    await page.waitForFunction(expected=>getComputedStyle(document.querySelector('.page-heading .primary')).backgroundColor===expected,id==='pink'?'rgb(149, 99, 111)':'rgb(81, 111, 144)');
    palettes[id] = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      background: getComputedStyle(document.querySelector(".sidebar"))
        .backgroundColor,
      accent: getComputedStyle(document.querySelector(".page-heading .primary"))
        .backgroundColor,
    }));
    await page.screenshot({
      path: `../outputs/hanami-${id}.png`,
      scale: "css",
    });
  }
  assert.notEqual(palettes.pink.background, palettes.blue.background);
  assert.notEqual(palettes.pink.accent, palettes.blue.accent);
  await close();
  app = await start();
  const reloaded = await app.firstWindow();
  await reloaded.getByRole("button", { name: "查看 夏日回忆" }).waitFor();
  assert.equal(
    await reloaded.evaluate(() => document.documentElement.dataset.theme),
    "blue",
  );
  console.log(
    JSON.stringify(
      {
        autoName: "夏日回忆",
        exeName: "Engine.exe",
        gridDragSaved: true,
        listDragSaved: true,
        palettes,
        restartTheme: "blue",
      },
      null,
      2,
    ),
  );
} finally {
  await close();
}
