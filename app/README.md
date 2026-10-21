# 花间 · Hanami

一个中文本地 galgame 管理器。管理封面、标签、游玩状态、评分与感想，在 Windows 一键启动游戏，导出或恢复完整收藏备份。

## Windows 使用

便携包按系统架构选择：ARM64 用于 Apple Silicon Mac 上的 Windows 11 ARM 虚拟机；x64 用于常见 Intel / AMD Windows 电脑。

完整解压后双击 `Hanami.exe`。保留同目录的 DLL、resources 等文件，不要只把 exe 拿出来。首次进入为空书架，没有预置游戏。

1. 点“添加游戏”，选择 Windows 中实际的游戏文件夹。
2. 选择该目录里的 `.exe` 启动程序；可以补上名称、封面和标签。封面支持静态 PNG / JPEG / WebP，最大 10 MiB、2000 万像素。
3. 保存后点击封面进入详情，编辑状态、评分、感想，或点击播放按钮启动。
4. 使用左下角“导出备份”。恢复前会自动备份当前库，并询问是否替换。

Mac 目录与 Windows 虚拟机的路径不同，请在 Windows 内选择路径。程序只负责启动目标 exe，不提供转区、兼容层、管理员提权或游戏运行库安装。

## Mac 开发和预览

需要 Node.js 22.12 或以上，推荐 Node 24 LTS。解压源码后在 `app/` 目录执行：

```sh
npm ci
npm run dev
```

`dev` 先构建，再启动桌面窗口。修改源码后重新运行命令。Mac 可管理收藏、选择封面、备份及恢复；启动 Windows exe 会显示平台提示。

```sh
npm run dev:web   # 浏览器临时预览，端口见终端；不保存正式收藏
npm test
npm run typecheck
npm run build
```

浏览器预览的数据只保留到刷新。目录选择、启动和备份使用桌面版。

## Windows 构建

```sh
npm run portable:win:arm64
npm run portable:win:x64
```

便携目录输出在 `release/Hanami-windows-<arch>/`。构建脚本使用 Electron 官方运行时与应用生产构建，不需要目标电脑安装 Node.js。

标准 NSIS 安装包（建议在 Windows 内构建）：

```sh
npm run dist:win:arm64
npm run dist:win
```

如果 GitHub 下载不可达，可以在当前终端设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后重新执行；镜像提供的 Electron 压缩包由下载器校验。默认无代码签名证书，测试包未签名。

## 数据与恢复

Windows 数据通常在 `%APPDATA%\Hanami`，Mac 通常在 `~/Library/Application Support/Hanami`。目录包含 `library.json`、`library.previous.json` 和 `covers/`，请优先使用应用内完整备份，而不是单独复制 JSON。

备份文件包含收藏与封面，不含游戏程序、存档。备份中的绝对路径原样保留，换电脑后可在详情中重新选择。

读取损坏的库时，应用不会自动清空覆盖；可点击“恢复备份”。恢复前产生 `before-import-*.json`；原库损坏时保留为 `damaged-before-import-*.json`。如果原库清单正常、封面却有缺失或损坏，会在 `incomplete-before-import-*` 文件夹中保留原清单与现存图片。上一版清单仍需使用的封面会保留到下一次快照轮换。

这些自动副本不会自行删除，可在确认新库正常并另存备份后手动整理。

## 架构

- `src/shared`：类型、数据校验、搜索和筛选。
- `src/main`：文件保存、封面、备份、启动和限定 IPC。
- `src/preload`：隔离的桌面桥接。
- `src/renderer`：React 书架和编辑界面。
- `tests`：领域、存储、备份、启动、界面与服务测试。

验证范围与待测事项以交付目录的 `verification.md` 为准。
