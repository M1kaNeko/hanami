# Galgame Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 交付可以在 Mac 开发预览、在 Windows 管理与启动本地 galgame 的桌面应用。

**Architecture:** Electron 主进程负责系统交互和持久化，preload 暴露有限类型化 API。React 界面使用同一个 API，浏览器预览仅用临时数据适配器并明确提示不会保存到正式游戏库。

**Tech Stack:** Electron、React、TypeScript、Vite、Vitest、Testing Library、electron-builder。执行时核实可用版本，安装后提交锁文件。

**Spec:** [galgame-manager-design.md](./galgame-manager-design.md)

## Global Constraints

- Mac 开发，Windows 虚拟机真实验收；不得把 Mac 检查描述为 Windows 验证。
- 中文、浅色界面；不预置真实收藏。
- 状态为想玩、在玩、已通关、搁置，新添加默认为想玩。
- 评分可不填，填写时为 1–10 的整数。
- 启动游戏不会自动更改状态。
- 数据包含 schemaVersion，写入采用临时文件与替换，并保留上一次有效数据。
- 备份包含清单和封面，不包含游戏程序及存档。
- 删除操作只移除记录及应用内封面副本，不删除游戏文件。
- Windows 启动必须检查 .exe，禁止拼接 shell 命令。

## Review Focus

1. Windows 路径大小写、斜杠差异不能绕过重复检查（任务 1）。
2. 并发保存、损坏数据不得造成静默丢库（任务 2）。
3. 备份中的非法封面引用、超大图片、未知版本需拒绝且保留当前库（任务 3）。
4. 路径含空格、中文或 shell 符号必须作为单个路径传递；进程创建失败不得记录成功（任务 4）。
5. 保存失败应保留用户填写内容；筛选无结果不能显示成空库（任务 5）。

## 文件结构

应用源码统一置于 `app/`，最终交付归档与安装产物放在 `outputs/`。

- `app/package.json`, `tsconfig*.json`, `vite.config.ts`, `electron-builder.yml`：开发、检查、测试、打包入口。
- `app/src/shared/model.ts`, `validation.ts`, `library.ts`, `api.ts`：类型、校验、筛选、桌面接口。
- `app/src/main/store.ts`, `covers.ts`, `backup.ts`, `launcher.ts`, `ipc.ts`, `index.ts`：本地服务。
- `app/src/preload/index.ts`：隔离桥接。
- `app/src/renderer/App.tsx`, `components/{Sidebar,GameCard,GameEditor,GameDetails}.tsx`, `styles.css`, `api.ts`：交互与样式。
- `app/tests/{domain,store,backup,launcher,ui}.test.{ts,tsx}`：各模块验收。
- `app/README.md`, `outputs/verification.md`：运行说明与实际验证记录。

## Task 1：游戏领域模型与可检查工程

**Interfaces:** `GameStatus = 'wishlist' | 'playing' | 'completed' | 'paused'`；`Game` 包含 `id,name,directory,executable,cover,tags,status,rating,notes,createdAt,updatedAt,lastLaunchedAt`，其中 cover、rating、lastLaunchedAt 可空。`Library = {schemaVersion:1,games:Game[]}`。`GameDraft` 为可编辑字段。时间为 ISO 字符串。

产生 `validateDraft(draft:GameDraft):GameDraft`、`validateLibrary(input:unknown):Library`、`normalizeExecutable(path:string):string`、`filterGames(games:Game[],filter:{query:string,status:GameStatus|'all',tag:string|null}):Game[]`；所有跨 IPC 参数也在主进程校验。

- [ ] 建立 package scripts：`dev`, `typecheck`, `test`, `build`, `dist:win`；配置 Vitest、React 和 Electron 的独立构建目标。
- [ ] 在 domain 测试中断言空名称失败、评分 null/1/10 合法而 0/11/1.5 非法、未知状态失败；搜索匹配名称及标签，三个条件取交集，结果按 updatedAt 降序。
- [ ] 断言 `C:\\Games\\A.exe` 和 `c:/games/a.exe` 归一化相同，编辑记录排除自身 ID 后不误判重复。
- [ ] 运行 `npm test -- tests/domain.test.ts`，确认缺少实现导致失败；实现上述接口后同一命令通过。
- [ ] 执行 `npm run typecheck`；若初始化了 Git，提交本任务代码与锁文件。

## Task 2：持久化与封面文件

**Interfaces:** `createStore(root:string):{read():Promise<Library>,save(library:Library):Promise<void>}`；`importCover(root:string,source:string):Promise<string>`；cover 返回随机文件名形式的相对引用，不接受任意路径。主进程通过受控自定义协议读取封面，禁止渲染层任意 file URL 读取。

- [ ] store 测试覆盖首次空库、保存后重读、上次有效副本、连续并发写入的序列化，以及读取损坏 JSON 后 save 被拒绝且原文件字节不变。
- [ ] 封面测试覆盖 PNG/JPEG/WebP 文件内容校验、单张最大 10 MiB、随机名称副本、拒绝伪图片和越界引用。原图删除后副本仍可读。
- [ ] 运行 `npm test -- tests/store.test.ts` 确认失败，再实现校验、串行保存、同目录临时写入与替换。只对首次 ENOENT 返回空库，其他读错误阻止后续覆盖。
- [ ] 删除记录先保存清单，成功后仅清理应用封面目录内已无引用的副本；清理失败不撤销已保存记录，显示可理解提示。
- [ ] 同一测试命令通过后运行 typecheck，提交本任务（存在 Git 时）。

## Task 3：可恢复备份

**Interfaces:** `exportBackup(root:string,library:Library,destination:string):Promise<void>`；`validateBackup(source:string):Promise<ValidatedBackup>`；`restoreBackup(root:string,backup:ValidatedBackup):Promise<Library>`。ValidatedBackup 只由校验函数产生。

单文件格式为 JSON：`{format:'galgame-manager-backup',version:1,library,covers:[{reference,mime,base64}]}`。限制文件总计 100 MiB、图片每张 10 MiB；校验引用无分隔符、无重复、无缺失、内容与 MIME 匹配。

- [ ] backup 测试断言清单与封面完整往返，Windows 路径原样保留；拒绝未知版本、重复 ID、缺失图片、`../` 引用、非法 base64、超限与损坏 JSON。
- [ ] 运行 `npm test -- tests/backup.test.ts` 确认失败，再实现导出与预校验。恢复先生成当前库的完整备份，在临时目录完成新库准备，再切换；中途失败保留旧库与封面。
- [ ] 加入模拟写失败的恢复测试，断言旧库仍可读取；重复运行此任务测试并 typecheck，通过后提交。

## Task 4：桌面桥接与启动

**Interfaces:** `DesktopApi` 提供 `listGames`, `saveGame(draft,id?)`, `deleteGame(id)`, `selectDirectory`, `selectExecutable(directory)`, `selectCover`, `launchGame(id)`, `openGameDirectory(id)`, `exportBackup`, `previewImport`, `confirmImport(token)`，均返回 Promise。取消选择返回 null；失败使用 `{ok:false,error:{code,message}}`，成功 `{ok:true,value}`。导入预览 token 在主进程关联已验证备份，确认后只使用该备份。

`launchExecutable(executable:string,platform:NodeJS.Platform):Promise<void>` 使用可注入文件与进程依赖供测试；平台错误优先返回中文提示。

- [ ] launcher 测试断言 Mac 不执行 .exe，缺失目标或非 .exe 拒绝；中文空格和 `&` 等字符作为单一路径以 `shell:false` 传入，cwd 为 exe 父目录，error 事件导致失败，只有 spawn 成功后更新最近启动时间。
- [ ] 运行 `npm test -- tests/launcher.test.ts` 确认失败；实现 launcher、ipc、preload 和主窗口。设置 contextIsolation=true、nodeIntegration=false、sandbox=true，限制导航与新窗口，校验 IPC 来源及全部输入。
- [ ] 文件选择器限制启动文件位于所选游戏目录内；主进程再次校验实际路径。系统打开目录根据记录 ID 解析，不接受渲染层提供任意路径。
- [ ] 配置 renderer 的构建资源使用相对路径、严格 CSP；开发服务器地址仅开发模式加载；封面协议仅服务应用封面目录。
- [ ] 测试通过并 typecheck；运行桌面开发入口，确认窗口和桥接正常，提交本任务。

## Task 5：书架和记录交互

**Consumes:** 前述 DesktopApi 和领域类型；浏览器预览提供相同接口的临时适配器，明确显示“浏览器预览 · 数据仅保留到本次刷新”，启动按钮显示平台限制。

- [ ] ui 测试覆盖空库引导，添加及重启式重新加载，编辑状态评分和感想，取消编辑不保存，组合筛选，零匹配提示与真实空库区分。
- [ ] 测试保存失败后弹窗与输入仍保留；删除需确认且失败保留记录；启动失败提示和重新选择路径入口；导入显示游戏数量并二次确认，取消不修改数据。
- [ ] 运行 `npm test -- tests/ui.test.tsx` 确认失败；实现浅色中文书架、状态侧栏计数、工具栏、占位封面、详情、添加编辑弹窗以及备份入口。无可选评分使用“未评分”，加载和保存期间阻止重复提交。
- [ ] 封面选择结果先预览，提交时才导入应用目录；取消表单不产生永久孤立副本。维护焦点、Esc 关闭和有标签的表单控件。
- [ ] 测试通过后运行 `npm run typecheck` 与 `npm run build`。实际截图检查空库、多卡片、详情、表单与窄窗口；修复遮挡、溢出和不可点击控件，提交本任务。

## Task 6：交付与 Windows 验收

- [ ] 配置 electron-builder 的 Windows NSIS 安装包和 unpacked 构建，明确 x64 与 arm64 的构建目标，不把 arm64 虚拟机默认为 x64。不配置证书时标明未签名。
- [ ] README 写明 Mac 开发命令、Windows 安装依赖与构建命令、数据位置、备份恢复和 Windows 路径选择；不承诺兼容所有旧游戏。
- [ ] 运行 `npm test`, `npm run typecheck`, `npm run build`，记录实际结果；打包不成功时保留完整源码交付与精确错误，不伪造安装包。
- [ ] 检查能否访问 Windows 虚拟机。可访问时构建并完成设计文档的真实游戏验收；不可访问时将 Windows 构建和实机启动明确记为待用户执行，不阻塞 Mac 可验证部分。
- [ ] 交付源码归档、已实际生成的安装包、预览截图、verification.md 到 outputs，归档排除 node_modules、缓存和用户游戏数据。最终只汇报实际完成与仍待验证项。

## 计划自查与执行方式

已按设计核对功能、数据保护、备份、平台区别和交付范围，各项分别映射到上述任务。review focus 五项均有所属任务的测试；接口名称在各任务间保持一致。

推荐在当前会话由主代理依次实现，避免重复加载上下文。也可选子代理逐任务实现和独立审阅；只有用户选择后才启动相应方式。计划等待用户审阅与执行方式确认。
