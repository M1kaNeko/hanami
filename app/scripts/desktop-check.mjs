import { _electron as electron } from "playwright";
import { resolve } from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
const data = await mkdtemp(resolve("../work/desktop-"));
let app;
async function open() {
  return electron.launch({
    args: [process.env.HANAMI_APP_PATH??".", "--disable-gpu"],
    env: { ...process.env, HANAMI_DATA_DIR: data },
    timeout: 20000,
  });
}
async function close() {
  if (!app) return;
  const p = app.process();
  const timer = setTimeout(() => p.kill("SIGTERM"), 3000);
  try {
    await app.close();
  } catch {
  } finally {
    clearTimeout(timer);
  }
}
try {
  app = await open();
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByText("每个故事，都值得珍藏。").waitFor();
  await page.screenshot({ path: "../outputs/hanami-empty.png", scale: "css" });
  for (const [name, tags, status, rating] of [
    ["夏日的最后一封信", "日常，治愈", "playing", "9"],
    ["星空下的约定", "星空，剧情", "wishlist", ""],
    ["雨后，与你重逢", "青春，剧情", "completed", "10"],
  ]) {
    await page
      .getByRole("button", { name: "添加游戏", exact: true })
      .first()
      .click();
    await page.getByLabel("游戏名称", { exact: true }).fill(name);
    await page
      .getByLabel("游戏目录", { exact: true })
      .fill("D:\\Games\\" + name);
    await page
      .getByLabel("启动程序", { exact: true })
      .fill("D:\\Games\\" + name + "\\game.exe");
    await page.getByLabel("标签", { exact: true }).fill(tags);
    await page.getByLabel("游玩状态").selectOption(status);
    await page.getByLabel("我的评分").selectOption(rating);
    await page.getByRole("button", { name: "保存游戏" }).click();
    await page.getByRole("button", { name: "查看 " + name }).waitFor();
  }
  await page.getByRole("button", { name: "关闭提示" }).click();
  await page.screenshot({
    path: "../outputs/hanami-library.png",
    scale: "css",
  });
  await page.getByRole("button", { name: "查看 夏日的最后一封信" }).click();
  await page.screenshot({
    path: "../outputs/hanami-details.png",
    scale: "css",
  });
  await page.getByRole("button", { name: "修改路径与记录" }).click();
  await page.getByLabel("感想与笔记").fill("这一段夏日，想要再读一次。");
  await page.getByRole("button", { name: "保存游戏" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.setViewportSize({ width: 700, height: 760 });
  await page.screenshot({ path: "../outputs/hanami-narrow.png", scale: "css" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  await close();
  app = await open();
  const restored = await app.firstWindow();
  await restored
    .getByRole("button", { name: "查看 夏日的最后一封信" })
    .waitFor();
  const games = await restored.evaluate(
    async () => await window.desktop.listGames(),
  );
  if (
    !games.ok ||
    games.value.length !== 3 ||
    !games.value.some((g) => g.notes === "这一段夏日，想要再读一次。")
  )
    throw Error("Restart persistence failed");
  console.log(
    JSON.stringify(
      {
        gamesAfterRestart: games.value.length,
        notesPreserved: true,
        pageErrors: errors,
        narrowHorizontalOverflow: overflow,
      },
      null,
      2,
    ),
  );
} finally {
  await close();
}
