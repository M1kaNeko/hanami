import { it, expect } from "vitest";
import { assertGamePaths } from "../src/main/game-paths";
import { draft } from "./fixtures";
it("Windows IPC 保存路径检查允许内置模式空 exe，保留原模式限制", () => {
  expect(() =>
    assertGamePaths(
      { ...draft, launchMode: "kirikiri", executable: "" },
      "win32",
    ),
  ).not.toThrow();
  expect(() =>
    assertGamePaths(
      {
        ...draft,
        launchMode: "kirikiri",
        executable: "",
        directory: "relative",
      },
      "win32",
    ),
  ).toThrow();
  expect(() =>
    assertGamePaths({ ...draft, executable: "" }, "win32"),
  ).toThrow();
  expect(() =>
    assertGamePaths(
      { ...draft, executable: "C:\\Elsewhere\\game.exe" },
      "win32",
    ),
  ).toThrow();
  expect(() => assertGamePaths(draft, "win32")).not.toThrow();
});
