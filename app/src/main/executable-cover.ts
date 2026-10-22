import { win32, extname } from "node:path";
import { PNG } from "pngjs";
interface FileIcon {
  isEmpty(): boolean;
  resize(options: { width: number; height: number; quality: "best" }): {
    toPNG(options?: { scaleFactor: number }): Buffer;
  };
}
interface IconDependencies {
  stat(path: string): Promise<{ isFile(): boolean }>;
  getIcon(path: string, options: { size: "large" }): Promise<FileIcon>;
}
export async function extractExecutableCover(
  path: string,
  platform: NodeJS.Platform,
  deps: IconDependencies,
): Promise<Buffer | null> {
  if (
    platform !== "win32" ||
    !win32.isAbsolute(path) ||
    extname(path).toLowerCase() !== ".exe"
  )
    return null;
  try {
    if (!(await deps.stat(path)).isFile()) return null;
    const icon = await deps.getIcon(path, { size: "large" });
    if (icon.isEmpty()) return null;
    const pixels = PNG.sync.read(
      icon
        .resize({ width: 160, height: 160, quality: "best" })
        .toPNG({ scaleFactor: 1 }),
    );
    if (
      !pixels.width ||
      !pixels.height ||
      pixels.width > 256 ||
      pixels.height > 256
    )
      return null;
    const poster = new PNG({ width: 300, height: 400 });
    for (let i = 0; i < poster.data.length; i += 4) {
      poster.data[i] = 246;
      poster.data[i + 1] = 248;
      poster.data[i + 2] = 244;
      poster.data[i + 3] = 255;
    }
    const left = Math.floor((300 - pixels.width) / 2),
      top = Math.floor((400 - pixels.height) / 2);
    for (let y = 0; y < pixels.height; y++)
      for (let x = 0; x < pixels.width; x++) {
        const source = (y * pixels.width + x) * 4,
          target = ((y + top) * 300 + x + left) * 4,
          alpha = pixels.data[source + 3] / 255;
        for (let channel = 0; channel < 3; channel++)
          poster.data[target + channel] = Math.round(
            pixels.data[source + channel] * alpha +
              poster.data[target + channel] * (1 - alpha),
          );
      }
    return PNG.sync.write(poster);
  } catch {
    return null;
  }
}
