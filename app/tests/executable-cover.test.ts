import { it, expect } from "vitest";
import { PNG } from "pngjs";
import { extractExecutableCover } from "../src/main/executable-cover";
function icon() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(255);
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 225;
    png.data[i + 1] = 70;
    png.data[i + 2] = 90;
  }
  return {
    isEmpty: () => false,
    resize: () => ({ toPNG: () => PNG.sync.write(png) }),
  };
}
it("从 Windows exe 图标生成完整 PNG 封面，图标居中而不裁切", async () => {
  const cover = await extractExecutableCover(
    "D:\\游戏 目录\\Game.exe",
    "win32",
    { stat: async () => ({ isFile: () => true }), getIcon: async () => icon() },
  );
  expect(cover).not.toBeNull();
  const image = PNG.sync.read(cover!);
  expect([image.width, image.height]).toEqual([300, 400]);
  const center = (199 * 300 + 149) * 4;
  expect([...image.data.subarray(center, center + 4)]).toEqual([
    225, 70, 90, 255,
  ]);
  expect([...image.data.subarray(0, 4)]).toEqual([246, 248, 244, 255]);
});
it("缺文件、无图标、不支持平台都返回空，不执行 exe", async () => {
  const deps = {
    stat: async () => ({ isFile: () => false }),
    getIcon: async () => icon(),
  };
  expect(
    await extractExecutableCover("D:\\Game.exe", "darwin", deps),
  ).toBeNull();
  expect(
    await extractExecutableCover("D:\\Game.cmd", "win32", deps),
  ).toBeNull();
  expect(
    await extractExecutableCover("D:\\Game.exe", "win32", deps),
  ).toBeNull();
  expect(
    await extractExecutableCover("D:\\Game.exe", "win32", {
      stat: async () => ({ isFile: () => true }),
      getIcon: async () => {
        throw Error("failed");
      },
    }),
  ).toBeNull();
});
