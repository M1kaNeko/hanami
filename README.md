# 花间 · Hanami

本地 Galgame 收藏与启动管理器，使用 Electron、React、TypeScript 构建。

- 游戏封面、标签、评分、笔记与游玩状态。
- 拖拽调整状态，三套配色，网格及列表视图。
- 按名称、评分、最近启动排序，搜索名称、标签与笔记。
- Windows 主文件夹扫描：递归最多六层，确认入口后批量添加，跳过已入库程序。
- Windows 直接启动 exe 或使用随附的吉里吉里 Z。
- Mac 原生运行测试版支持 Tyrano、Ren’Py 7.3.5 / 8.1.1；未集成 Wine，不能通用运行 exe。

## 开发

```sh
cd app
npm ci
npm run typecheck
npm test
npm run dev
```

Windows ARM64 便携包：`npm run portable:win:arm64`；x64：`npm run portable:win:x64`。
Mac 运行库准备、打包和数据备份见 [详细说明](app/README.md)。

## 数据

游戏与游戏资源由用户自行选择，不包含在项目中。应用数据保存在系统用户数据目录；收藏备份不代替游戏存档备份。
扫描结果是 exe 候选列表，并不保证每个候选都是游戏。多入口目录请核对后选择。

## 第三方组件

吉里吉里 Z 的来源与许可证位于 `app/engines/kirikiri/`。Ren’Py 组件从官方 SDK 准备，未提交至源码仓库。各第三方组件沿用各自许可证。
