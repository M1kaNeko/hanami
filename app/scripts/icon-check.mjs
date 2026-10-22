import { _electron as electron } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
const root = await mkdtemp(resolve("../work/icon-")),
  png = new PNG({ width: 32, height: 32 });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 95;
  png.data[i + 1] = 110;
  png.data[i + 2] = 190;
  png.data[i + 3] = 255;
}
const app = await electron.launch({
  args: [".", "--disable-gpu"],
  env: { ...process.env, HANAMI_DATA_DIR: root },
});
try {
  const result = await app.evaluate(
    async ({ nativeImage }, input) => {
      const requireModule = process
        .getBuiltinModule("module")
        .createRequire(input.extract);
      const { extractExecutableCover } = requireModule(input.extract),
        { saveCoverBytes } = requireModule(input.covers),
        { createService } = requireModule(input.service);
      const icon = nativeImage.createFromBuffer(
        Buffer.from(input.png, "base64"),
      );
      const poster = await extractExecutableCover(
        "C:\\Games\\Engine.exe",
        "win32",
        {
          stat: async () => ({ isFile: () => true }),
          getIcon: async () => icon,
        },
      );
      if (!poster) throw Error("No icon cover");
      const reference = await saveCoverBytes(input.root, poster);
      const game = await createService(input.root).save({
        name: "图标封面验证",
        directory: "C:\\Games",
        executable: "C:\\Games\\Engine.exe",
        cover: reference,
        coverSource: "executable",
        tags: [],
        status: "wishlist",
        rating: null,
        notes: "",
      });
      return { id: game.id, source: game.coverSource, bytes: poster.length };
    },
    {
      root,
      extract: resolve("dist/main/executable-cover.js"),
      covers: resolve("dist/main/covers.js"),
      service: resolve("dist/main/service.js"),
      png: PNG.sync.write(png).toString("base64"),
    },
  );
  assert.equal(result.source, "executable");
  const page = await app.firstWindow();
  await page.getByRole("button", { name: "刷新书架" }).click();
  await page.getByRole("button", { name: "查看 图标封面验证" }).waitFor();
  await page.waitForFunction(
    () => document.querySelector(".game-card .cover img")?.naturalWidth === 300,
  );
  const stored = await page.evaluate(() => window.desktop.listGames());
  assert.equal(stored.value[0].coverSource, "executable");
  console.log(
    JSON.stringify({
      nativeImageResize: true,
      posterSaved: true,
      coverProtocolDecoded: true,
      sourcePersisted: true,
      ...result,
    }),
  );
} finally {
  const timer = setTimeout(() => app.process().kill("SIGTERM"), 3000);
  try {
    await app.close();
  } finally {
    clearTimeout(timer);
  }
}
