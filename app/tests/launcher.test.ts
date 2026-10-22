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
it("内置引擎接收目录参数，独立存档且不调用 shell", async () => {
  const { launchGame } = await import("../src/main/launcher");
  let received: any;
  await launchGame(
    { directory: "C:\\游戏 & games", executable: "", launchMode: "kirikiri" },
    "win32",
    "C:\\Hanami\\engines\\krkrz.exe",
    "C:\\User\\Hanami\\saves\\one",
    {
      stat: async (p: string) => ({
        isFile: () => p.endsWith(".exe") || p.endsWith("startup.tjs"),
        isDirectory: () => !p.endsWith(".exe") && !p.endsWith("startup.tjs"),
      }),
      spawn: (file: string, args: string[], options: any) => {
        received = { file, args, options };
        const e = new EventEmitter() as any;
        e.unref = () => {};
        queueMicrotask(() => e.emit("spawn"));
        return e;
      },
    },
  );
  expect(received.file).toBe("C:\\Hanami\\engines\\krkrz.exe");
  expect(received.args).toEqual([
    "C:\\游戏 & games",
    "-datapath=C:\\User\\Hanami\\saves\\one",
  ]);
  expect(received.options).toMatchObject({
    cwd: "C:\\游戏 & games",
    shell: false,
  });
});
it("缺少引擎或游戏入口时不启动", async () => {
  const { launchGame } = await import("../src/main/launcher");
  const deps = {
    stat: async () => {
      throw Error("missing");
    },
    spawn: () => {
      throw Error("must not run");
    },
  };
  await expect(
    launchGame(
      { directory: "C:\\Game", executable: "", launchMode: "kirikiri" },
      "win32",
      "C:\\Hanami\\krkrz.exe",
      "C:\\save",
      deps,
    ),
  ).rejects.toThrow("引擎");
});
it("内置启动优先检查入口，data.xp3 作为归档路径传入", async () => {
  const { launchGame } = await import("../src/main/launcher");
  let target = "";
  const deps = {
    stat: async (p: string) => ({
      isFile: () => p.endsWith(".exe") || p.endsWith("data.xp3"),
      isDirectory: () => p === "C:\\Game",
    }),
    spawn: (_f: string, args: string[]) => {
      target = args[0];
      const e = new EventEmitter() as any;
      e.unref = () => {};
      queueMicrotask(() => e.emit("spawn"));
      return e;
    },
  };
  await launchGame(
    { directory: "C:\\Game", executable: "", launchMode: "kirikiri" },
    "win32",
    "C:\\Hanami\\krkrz.exe",
    "C:\\save",
    deps,
  );
  expect(target).toBe("C:\\Game\\data.xp3");
  await expect(
    launchGame(
      { directory: "C:\\Game", executable: "", launchMode: "kirikiri" },
      "win32",
      "C:\\Hanami\\krkrz.exe",
      "C:\\save",
      {
        ...deps,
        stat: async (p: string) => ({
          isFile: () => p.endsWith(".exe"),
          isDirectory: () => true,
        }),
      },
    ),
  ).rejects.toThrow("未找到");
});
