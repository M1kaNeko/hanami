import { _electron as electron } from "playwright";
import { mkdtemp, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const data = await mkdtemp(resolve("../work/kirikiri-ui-"));
const app = await electron.launch({
  args: [".", "--disable-gpu"],
  env: { ...process.env, HANAMI_DATA_DIR: data },
});
try {
  const page = await app.firstWindow();
  await page.getByText("每个故事，都值得珍藏。").waitFor();
  // Exercise the actual Windows save-path IPC branch on this macOS test host.
  await app.evaluate(() => {
    Object.defineProperty(process, "platform", { value: "win32" });
  });
  await page
    .getByRole("button", { name: "添加游戏", exact: true })
    .first()
    .click();
  await page.getByLabel("启动方式").selectOption("kirikiri");
  await page.getByLabel("游戏名称").fill("Kirikiri test");
  await page
    .getByLabel("游戏目录", { exact: true })
    .fill("C:\\Games\\Kirikiri");
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  await page
    .getByRole("button", { name: "查看 Kirikiri test", exact: true })
    .waitFor();
  const library = JSON.parse(
    await readFile(join(data, "library.json"), "utf8"),
  );
  assert.equal(library.games[0].launchMode, "kirikiri");
  assert.equal(library.games[0].executable, "");
  await page
    .getByRole("button", { name: "查看 Kirikiri test", exact: true })
    .click();
  await page
    .getByRole("button", { name: "修改路径与记录", exact: true })
    .click();
  assert.equal(await page.getByLabel("启动方式").inputValue(), "kirikiri");
  await page.screenshot({ path: resolve("../outputs/hanami-kirikiri.png") });
  console.log(
    JSON.stringify({
      windowsSaveIpc: true,
      persistedMode: true,
      editingMode: true,
      data,
    }),
  );
} finally {
  await app
    .evaluate(() => {
      Object.defineProperty(process, "platform", { value: "darwin" });
    })
    .catch(() => {});
  const t = setTimeout(() => app.process().kill("SIGTERM"), 3000);
  try {
    await app.close();
  } finally {
    clearTimeout(t);
  }
}
