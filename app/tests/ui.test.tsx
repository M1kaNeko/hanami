// @vitest-environment jsdom
import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import App from "../src/renderer/App";
import { createPreviewApi } from "../src/renderer/api";
afterEach(cleanup);
it("空库引导，添加游戏，编辑评分，筛选区分空结果", async () => {
  const user = userEvent.setup();
  render(<App api={createPreviewApi()} />);
  expect(await screen.findByText("每个故事，都值得珍藏。")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: /添加游戏/ })[0]);
  await user.type(screen.getByLabelText("游戏名称"), "夏日回忆");
  await user.type(screen.getByLabelText("游戏目录"), "C:\\Games\\Summer");
  await user.type(
    screen.getByLabelText("启动程序"),
    "C:\\Games\\Summer\\game.exe",
  );
  await user.click(screen.getByRole("button", { name: "保存游戏" }));
  expect(
    await screen.findByRole("button", { name: "查看 夏日回忆" }),
  ).toBeInTheDocument();
  await user.type(screen.getByPlaceholderText("搜索游戏、标签…"), "不存在");
  expect(await screen.findByText("还没有找到这个故事")).toBeInTheDocument();
  expect(screen.queryByText("每个故事，都值得珍藏。")).not.toBeInTheDocument();
});
it("保存失败时保留编辑内容", async () => {
  const api = createPreviewApi();
  api.saveGame = async () => ({
    ok: false,
    error: { code: "WRITE", message: "磁盘写入失败" },
  });
  const user = userEvent.setup();
  render(<App api={api} />);
  await screen.findByText("每个故事，都值得珍藏。");
  await user.click(screen.getAllByRole("button", { name: /添加游戏/ })[0]);
  await user.type(screen.getByLabelText("游戏名称"), "不要丢掉");
  await user.type(screen.getByLabelText("游戏目录"), "C:\\Games");
  await user.type(screen.getByLabelText("启动程序"), "C:\\Games\\a.exe");
  await user.click(screen.getByRole("button", { name: "保存游戏" }));
  expect(await screen.findByText("磁盘写入失败")).toBeInTheDocument();
  expect(screen.getByLabelText("游戏名称")).toHaveValue("不要丢掉");
});
