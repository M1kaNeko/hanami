// @vitest-environment jsdom
import React from "react";
import { it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
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

it("选择不同程序都使用游戏目录名，不使用 exe 文件名", async () => {
  const api = createPreviewApi();
  let path = "D:\\Games\\Summer\\夏日回忆.EXE";
  api.selectDirectory = async () => ({ ok: true, value: "D:\\Games\\Summer" });
  api.selectExecutable = async () => ({ ok: true, value: path });
  const user = userEvent.setup();
  render(<App api={api} />);
  await screen.findByText("每个故事，都值得珍藏。");
  await user.click(screen.getAllByRole("button", { name: /添加游戏/ })[0]);
  await user.click(screen.getByRole("button", { name: "选择游戏目录" }));
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("Summer");
  path = "D:\\Games\\Summer\\星空的约定.exe";
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("Summer");
});
it("文件夹默认命名保留手填名称，取消选择不修改", async () => {
  const api = createPreviewApi();
  api.selectExecutable = async () => ({
    ok: true,
    value: "D:\\Games\\夏日回忆\\game.exe",
  });
  const user = userEvent.setup();
  render(<App api={api} />);
  await screen.findByText("每个故事，都值得珍藏。");
  await user.click(screen.getAllByRole("button", { name: /添加游戏/ })[0]);
  await user.type(screen.getByLabelText("游戏目录"), "D:\\Games\\夏日回忆");
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("夏日回忆");
  await user.clear(screen.getByLabelText("游戏名称"));
  await user.type(screen.getByLabelText("游戏名称"), "我的特别命名");
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("我的特别命名");
  api.selectExecutable = async () => ({ ok: true, value: null });
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("我的特别命名");
});
it("编辑已有游戏时重新选程序也保留原名", async () => {
  const api = createPreviewApi();
  await api.saveGame({
    name: "已收藏的名字",
    directory: "D:\\Games\\Summer",
    executable: "D:\\Games\\Summer\\old.exe",
    cover: null,
    tags: [],
    status: "wishlist",
    rating: null,
    notes: "",
  });
  api.selectExecutable = async () => ({
    ok: true,
    value: "D:\\Games\\Summer\\new.exe",
  });
  const user = userEvent.setup();
  render(<App api={api} />);
  await user.click(
    await screen.findByRole("button", { name: "查看 已收藏的名字" }),
  );
  await user.click(screen.getByRole("button", { name: "修改路径与记录" }));
  await user.click(screen.getByRole("button", { name: "选择启动程序" }));
  expect(screen.getByLabelText("游戏名称")).toHaveValue("已收藏的名字");
});

function dragPayload() {
  const values = new Map<string, string>();
  return {
    types: [] as string[],
    effectAllowed: "none",
    dropEffect: "none",
    setData(type: string, value: string) {
      values.set(type, value);
      this.types = [...values.keys()];
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
  };
}
it.each(["grid", "list"])(
  "游戏卡片可从 %s 视图拖到在玩并保存，筛选与计数同步",
  async (layout) => {
    const api = createPreviewApi();
    const seeded = await api.saveGame({
      name: "拖拽测试",
      directory: "D:\\Games",
      executable: "D:\\Games\\a.exe",
      cover: null,
      tags: [],
      status: "wishlist",
      rating: 8,
      notes: "保持笔记",
    });
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByRole("button", { name: "查看 拖拽测试" });
    await user.click(screen.getByRole("button", { name: /^想玩/ }));
    if (layout === "list")
      await user.click(screen.getByRole("button", { name: "列表视图" }));
    const card = screen
      .getByRole("button", { name: "查看 拖拽测试" })
      .closest("article")!;
    expect(card).toHaveAttribute("draggable", "true");
    const transfer = dragPayload(),
      target = screen.getByRole("button", { name: /^在玩/ });
    fireEvent.dragStart(card, { dataTransfer: transfer });
    fireEvent.dragOver(target, { dataTransfer: transfer });
    expect(target).toHaveClass("drag-over");
    fireEvent.drop(target, { dataTransfer: transfer });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "查看 拖拽测试" }),
      ).not.toBeInTheDocument(),
    );
    expect(target).toHaveTextContent("1");
    const result = await api.listGames();
    expect(result.ok && result.value[0]).toMatchObject({
      status: "playing",
      rating: 8,
      notes: "保持笔记",
    });
    await user.click(target);
    expect(
      await screen.findByRole("button", { name: "查看 拖拽测试" }),
    ).toBeInTheDocument();
  },
);
it("拖拽保存失败保留原状态，外部文本拖入不生效", async () => {
  const api = createPreviewApi();
  await api.saveGame({
    name: "保留状态",
    directory: "D:\\Games",
    executable: "D:\\Games\\a.exe",
    cover: null,
    tags: [],
    status: "wishlist",
    rating: null,
    notes: "",
  });
  api.saveGame = async () => ({
    ok: false,
    error: { code: "WRITE", message: "拖拽保存失败" },
  });
  render(<App api={api} />);
  const card = (
      await screen.findByRole("button", { name: "查看 保留状态" })
    ).closest("article")!,
    target = screen.getByRole("button", { name: /^在玩/ }),
    transfer = dragPayload();
  fireEvent.dragStart(card, { dataTransfer: transfer });
  fireEvent.drop(target, { dataTransfer: transfer });
  expect(await screen.findByText("拖拽保存失败")).toBeInTheDocument();
  const current = await api.listGames();
  expect(current.ok && current.value[0].status).toBe("wishlist");
  const external = dragPayload();
  external.setData("text/plain", "external");
  fireEvent.dragOver(target, { dataTransfer: external });
  expect(target).not.toHaveClass("drag-over");
  fireEvent.drop(target, { dataTransfer: external });
  expect(screen.getByRole("button", { name: /^想玩/ })).toHaveTextContent("1");
});
it("顶部切换配色，重新打开界面后仍保留选择", async () => {
  localStorage.clear();
  const user = userEvent.setup(),
    api = createPreviewApi();
  render(<App api={api} />);
  await user.click(screen.getByRole("button", { name: "切换配色" }));
  await user.click(screen.getByRole("button", { name: "樱花粉" }));
  expect(document.documentElement.dataset.theme).toBe("pink");
  cleanup();
  render(<App api={api} />);
  expect(document.documentElement.dataset.theme).toBe("pink");
  await user.click(screen.getByRole("button", { name: "切换配色" }));
  expect(screen.getByRole("button", { name: "樱花粉" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "雾蓝" }));
  expect(document.documentElement.dataset.theme).toBe("blue");
  cleanup();
  render(<App api={api} />);
  expect(document.documentElement.dataset.theme).toBe("blue");
  localStorage.clear();
});
it("无效的配色记录回退默认配色，仍能读取游戏库", async () => {
  localStorage.setItem("hanami.theme", "unknown");
  render(<App api={createPreviewApi()} />);
  expect(await screen.findByText("每个故事，都值得珍藏。")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("green");
  localStorage.clear();
});
