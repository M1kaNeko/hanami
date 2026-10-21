import { it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { launchExecutable } from "../src/main/launcher";
it("Mac 禁止启动 Windows exe", async () => {
  await expect(launchExecutable("C:\\Games\\a.exe", "darwin")).rejects.toThrow(
    "Windows",
  );
});
it("非 exe 拒绝", async () => {
  await expect(launchExecutable("C:\\a.cmd", "win32")).rejects.toThrow();
});
it("中文空格符号路径保持原样，工作目录正确", async () => {
  let received: unknown;
  await launchExecutable("C:\\游戏 & games\\a.exe", "win32", {
    stat: async () => ({ isFile: () => true }),
    spawn: (file, args, options) => {
      received = { file, args, options };
      const child = new EventEmitter() as any;
      child.unref = () => {};
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
  });
  expect(received).toEqual({
    file: "C:\\游戏 & games\\a.exe",
    args: [],
    options: {
      cwd: "C:\\游戏 & games",
      shell: false,
      detached: true,
      stdio: "ignore",
    },
  });
});
it("不存在的文件或进程创建失败都报错", async () => {
  await expect(
    launchExecutable("C:\\a.exe", "win32", {
      stat: async () => {
        throw Error("missing");
      },
      spawn: () => {
        throw Error("never");
      },
    }),
  ).rejects.toThrow();
  await expect(
    launchExecutable("C:\\a.exe", "win32", {
      stat: async () => ({ isFile: () => true }),
      spawn: () => {
        const e = new EventEmitter() as any;
        queueMicrotask(() => e.emit("error", Error("denied")));
        return e;
      },
    }),
  ).rejects.toThrow();
});
