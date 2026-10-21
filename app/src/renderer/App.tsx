import { useEffect, useMemo, useState, useRef, type DragEvent } from "react";
import {
  Palette,
  Flower2,
  Library,
  Heart,
  Play,
  CheckCheck,
  Pause,
  Download,
  Upload,
  Plus,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  Leaf,
  BookOpen,
  FolderOpen,
  ShieldCheck,
  HardDrive,
  Star,
  X,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { DesktopApi } from "../shared/api";
import { statuses, type Game, type GameStatus } from "../shared/model";
import { filterGames } from "../shared/library";
import { desktopApi, unwrap } from "./api";
import { GameCard, GAME_DRAG_TYPE } from "./components/GameCard";
import { GameEditor } from "./components/GameEditor";
import { GameDetails } from "./components/GameDetails";
import { Modal } from "./components/Modal";
import { version } from "../../package.json";
const themes = {
  green: { label: "青苔绿", accent: "#496852", surface: "#f0f2ec" },
  pink: { label: "樱花粉", accent: "#95636f", surface: "#f6edf0" },
  blue: { label: "雾蓝", accent: "#516f90", surface: "#edf2f8" },
} as const;
type Theme = keyof typeof themes;
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("hanami.theme");
    return saved && Object.hasOwn(themes, saved) ? (saved as Theme) : "green";
  } catch {
    return "green";
  }
}
const navigation = [
  { id: "all", label: "全部游戏", icon: Library },
  { id: "wishlist", label: "想玩", icon: Heart },
  { id: "playing", label: "在玩", icon: Play },
  { id: "completed", label: "已通关", icon: CheckCheck },
  { id: "paused", label: "搁置", icon: Pause },
] as const;
type Confirmation =
  | { kind: "delete"; game: Game }
  | { kind: "import"; token: string; count: number };
export default function App({ api = desktopApi }: { api?: DesktopApi }) {
  const [theme, setTheme] = useState<Theme>(initialTheme),
    [themeOpen, setThemeOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("hanami.theme", theme);
    } catch {}
  }, [theme]);
  const [games, setGames] = useState<Game[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [status, setStatus] = useState<GameStatus | "all">("all"),
    [query, setQuery] = useState(""),
    [tag, setTag] = useState<string | null>(null),
    [layout, setLayout] = useState<"grid" | "list">("grid"),
    [editor, setEditor] = useState<Game | "new" | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [busy, setBusy] = useState(false),
    [dropTarget, setDropTarget] = useState<GameStatus | null>(null),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  function notify(message: string, error = false) {
    setToast({ message, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 9000 : 4000);
  }
  async function load() {
    setLoadError("");
    try {
      setGames(unwrap(await api.listGames()));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void load();
    return () => clearTimeout(toastTimer.current);
  }, [api]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        navigation.map((n) => [
          n.id,
          n.id === "all"
            ? games.length
            : games.filter((g) => g.status === n.id).length,
        ]),
      ),
    [games],
  );
  const filtered = useMemo(
    () => filterGames(games, { query, status, tag }),
    [games, query, status, tag],
  );
  const allTags = [...new Set(games.flatMap((g) => g.tags))].sort();
  const selected = games.find((g) => g.id === selectedId);
  const current = navigation.find((n) => n.id === status)!;
  async function action(run: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await run();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  function dropGame(
    event: DragEvent<HTMLButtonElement>,
    target: GameStatus | "all",
  ) {
    setDropTarget(null);
    if (
      target === "all" ||
      busy ||
      !event.dataTransfer.types.includes(GAME_DRAG_TYPE)
    )
      return;
    event.preventDefault();
    const game = games.find(
      (g) => g.id === event.dataTransfer.getData(GAME_DRAG_TYPE),
    );
    if (!game || game.status === target) return;
    void action(async () => {
      const updated = unwrap(
        await api.saveGame({ ...game, status: target }, game.id),
      );
      setGames((current) =>
        current.map((g) => (g.id === updated.id ? updated : g)),
      );
      notify(`已将「${game.name}」移到${statuses[target]}`);
    });
  }
  async function launch(game: Game) {
    await action(async () => {
      unwrap(await api.launchGame(game.id));
      await load();
      notify(`已启动「${game.name}」`);
    });
  }
  async function backup() {
    await action(async () => {
      if (unwrap(await api.exportBackup()))
        notify("备份已保存，好好珍藏这些故事吧。");
    });
  }
  async function prepareImport() {
    await action(async () => {
      const result = unwrap(await api.previewImport());
      if (result) setConfirmation({ kind: "import", ...result });
    });
  }
  async function confirm() {
    if (!confirmation) return;
    await action(async () => {
      if (confirmation.kind === "delete") {
        unwrap(await api.deleteGame(confirmation.game.id));
        setGames((gs) => gs.filter((g) => g.id !== confirmation.game.id));
        setSelectedId(null);
        notify("已移出收藏，游戏文件仍在原处。");
      } else {
        setGames(unwrap(await api.confirmImport(confirmation.token)));
        setLoaded(true);
        setLoadError("");
        setSelectedId(null);
        notify("游戏库已恢复，原来的库已自动备份。");
      }
      setConfirmation(null);
    });
  }
  function saved(game: Game) {
    setGames((gs) =>
      gs.some((g) => g.id === game.id)
        ? gs.map((g) => (g.id === game.id ? game : g))
        : [...gs, game],
    );
    setEditor(null);
    notify("故事已收进书架。");
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Flower2 size={27} strokeWidth={1.3} />
          </div>
          <div className="brand-text">
            <h1>花间</h1>
            <small>HANAMI LIBRARY</small>
          </div>
        </div>
        <p className="nav-label">我的收藏</p>
        <nav className="nav" aria-label="游戏状态">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`${status === n.id ? "active" : ""} ${dropTarget === n.id ? "drag-over" : ""}`}
              title={
                n.id === "all" ? "全部游戏" : `把游戏拖到这里，标记为${n.label}`
              }
              onDragOver={(event) => {
                if (
                  n.id === "all" ||
                  busy ||
                  !event.dataTransfer.types.includes(GAME_DRAG_TYPE)
                )
                  return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(n.id);
              }}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setDropTarget(null);
              }}
              onDrop={(event) => dropGame(event, n.id)}
              onClick={() => setStatus(n.id)}
              aria-current={status === n.id ? "page" : undefined}
            >
              <n.icon size={16} strokeWidth={1.5} />
              <span className="nav-text">{n.label}</span>
              <span className="nav-count">{counts[n.id] ?? 0}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="nav-label">书架管理</p>
          <button
            className="sidebar-tool"
            disabled={busy}
            onClick={backup}
            title="导出备份"
          >
            <Download size={16} strokeWidth={1.5} />
            <span>导出备份</span>
          </button>
          <button
            className="sidebar-tool"
            disabled={busy}
            onClick={prepareImport}
            title="恢复备份"
          >
            <Upload size={16} strokeWidth={1.5} />
            <span>恢复备份</span>
          </button>
          <p className="sidebar-note">
            故事会结束，
            <br />
            心动会一直留下来。
          </p>
          <p className="version">HANAMI · v{version}</p>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <BookOpen size={14} />
            <span>我的书架</span>
            <ChevronRight size={12} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="preview-badge">
              <i />
              {api.preview
                ? "浏览器预览"
                : api.platform === "win32"
                  ? "Windows · 本地书架"
                  : "Mac · 收藏管理"}
            </span>
            <button
              className="icon-button"
              aria-label="切换配色"
              title="切换配色"
              onClick={() => setThemeOpen(true)}
            >
              <Palette size={15} />
            </button>
            <button
              className="icon-button"
              onClick={load}
              aria-label="刷新书架"
              title="刷新书架"
            >
              <RefreshCw size={13} />
            </button>
            <div className="avatar">
              <Leaf size={14} />
            </div>
          </div>
        </header>
        <div className="content">
          <div className="eyebrow">
            <span>YOUR LITTLE WORLD</span>
            <span>—</span>
          </div>
          <div className="page-heading">
            <div>
              <h2>
                {status === "all" ? "我的游戏书架" : current.label + "的故事"}
              </h2>
              <p>收藏那些让你心动的世界，慢慢读完每一个故事。</p>
            </div>
            <button
              className="primary"
              onClick={() => setEditor("new")}
              disabled={!loaded || !!loadError}
            >
              <Plus size={15} />
              添加游戏
            </button>
          </div>
          <section className="stats" aria-label="收藏统计">
            {[
              { label: "收藏的故事", count: games.length, icon: BookOpen },
              { label: "正在邂逅", count: counts.playing ?? 0, icon: Play },
              {
                label: "读完的故事",
                count: counts.completed ?? 0,
                icon: CheckCheck,
              },
              { label: "期待的相遇", count: counts.wishlist ?? 0, icon: Heart },
            ].map((s) => (
              <div className="stat" key={s.label}>
                <div className="stat-icon">
                  <s.icon size={18} strokeWidth={1.4} />
                </div>
                <div>
                  <span>{s.label}</span>
                  <b>
                    {s.count}
                    <small>部</small>
                  </b>
                </div>
              </div>
            ))}
          </section>
          <div className="library-toolbar">
            <label className="search">
              <Search size={16} />
              <input
                aria-label="搜索游戏"
                placeholder="搜索游戏、标签…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              className="tag-select"
              aria-label="标签筛选"
              value={tag ?? ""}
              onChange={(e) => setTag(e.target.value || null)}
            >
              <option value="">全部标签</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="result-count">共 {filtered.length} 部作品</span>
            <div className="view-buttons">
              <button
                className={layout === "grid" ? "selected" : ""}
                aria-label="网格视图"
                onClick={() => setLayout("grid")}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                className={layout === "list" ? "selected" : ""}
                aria-label="列表视图"
                onClick={() => setLayout("list")}
              >
                <List size={15} />
              </button>
            </div>
          </div>
          {api.preview && (
            <p className="preview-notice">
              浏览器预览 ·
              数据仅保留到本次刷新；选择目录、启动和备份请使用桌面版。
            </p>
          )}
          {!loaded ? (
            <div className="empty">
              <RefreshCw className="loading-spin" size={24} />
              <p>正在整理书架…</p>
            </div>
          ) : loadError ? (
            <div className="empty">
              <ShieldCheck size={34} />
              <h3>暂时无法读取书架</h3>
              <p role="alert">{loadError}</p>
              <button className="secondary" onClick={load}>
                重新读取
              </button>
            </div>
          ) : games.length === 0 ? (
            <section className="empty">
              <div className="empty-art" aria-hidden="true">
                <div className="book left" />
                <div className="book right" />
                <div className="book" />
                <span className="spark s1">✧</span>
                <span className="spark s2">✦</span>
                <span className="spark s3">✧</span>
                <div className="art-line" />
              </div>
              <h3>每个故事，都值得珍藏。</h3>
              <p>
                你的书架还是空的。
                <br />
                添加第一部游戏，把喜欢的世界留在这里。
              </p>
              <button className="primary" onClick={() => setEditor("new")}>
                <Plus size={14} />
                添加游戏
              </button>
            </section>
          ) : filtered.length === 0 ? (
            <section className="empty">
              <Search size={34} strokeWidth={1} />
              <h3>还没有找到这个故事</h3>
              <p>试着换个关键词，或看看其他游玩状态。</p>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setTag(null);
                  setStatus("all");
                }}
              >
                清除筛选
              </button>
            </section>
          ) : (
            <section
              className={`cards ${layout === "list" ? "list" : ""}`}
              aria-label="游戏书架"
            >
              {filtered.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  busy={busy}
                  onDragEnd={() => setDropTarget(null)}
                  onOpen={() => setSelectedId(game.id)}
                  onLaunch={() => launch(game)}
                />
              ))}
            </section>
          )}
          {games.length === 0 && (
            <div className="tips">
              <div className="tip">
                <FolderOpen size={19} strokeWidth={1.3} />
                <div>
                  <strong>从本地，开始收藏</strong>
                  <p>选择游戏文件夹，关联启动程序。</p>
                </div>
              </div>
              <div className="tip">
                <Heart size={19} strokeWidth={1.3} />
                <div>
                  <strong>记录每一次心动</strong>
                  <p>标记游玩状态，写下专属感想。</p>
                </div>
              </div>
              <div className="tip">
                <ShieldCheck size={19} strokeWidth={1.3} />
                <div>
                  <strong>只属于你的书架</strong>
                  <p>数据保存在本地，随时导出备份。</p>
                </div>
              </div>
            </div>
          )}
          <footer className="footer">
            <span>
              <HardDrive size={11} />
              {api.preview ? "临时预览数据" : "本地保存 · 无需登录"}
            </span>
            <span>
              与你的下一个故事，慢慢相遇 <Flower2 size={11} />
            </span>
          </footer>
        </div>
      </main>
      {themeOpen && (
        <Modal title="书架配色" onClose={() => setThemeOpen(false)}>
          <p className="theme-description">给你的书架换一种心情。</p>
          <div className="theme-options">
            {Object.entries(themes).map(([id, preset]) => (
              <button
                key={id}
                className="theme-choice"
                aria-label={preset.label}
                aria-pressed={theme === id}
                onClick={() => {
                  setTheme(id as Theme);
                  setThemeOpen(false);
                }}
              >
                <span
                  className="theme-preview"
                  style={{ background: preset.surface }}
                >
                  <i style={{ background: preset.accent }} />
                  <span style={{ background: preset.accent }} />
                </span>
                <span className="theme-label">
                  {preset.label}
                  {theme === id && <CheckCheck size={14} />}
                </span>
              </button>
            ))}
          </div>
          <p className="hint theme-note">下次打开时，会保留这次选择。</p>
        </Modal>
      )}
      {selected && !editor && !confirmation && (
        <GameDetails
          game={selected}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditor(selected)}
          onDelete={() => setConfirmation({ kind: "delete", game: selected })}
          onLaunch={() => launch(selected)}
          onFolder={() =>
            action(async () => {
              unwrap(await api.openGameDirectory(selected.id));
            })
          }
        />
      )}
      {editor && (
        <GameEditor
          key={editor === "new" ? "new" : editor.id}
          game={editor === "new" ? undefined : editor}
          api={api}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {confirmation && (
        <Modal
          title={confirmation.kind === "delete" ? "移出收藏" : "恢复游戏库"}
          onClose={() => setConfirmation(null)}
          busy={busy}
        >
          <p className="confirm-text">
            {confirmation.kind === "delete"
              ? `确定将「${confirmation.game.name}」移出收藏吗？游戏文件会保留在原处，评分与感想将从书架中移除。`
              : `这份备份包含 ${confirmation.count} 部游戏。恢复将替换当前书架，系统会先自动备份现有数据。游戏路径会按备份保留，必要时请重新选择。`}
          </p>
          <div className="form-footer">
            <button
              className="secondary"
              onClick={() => setConfirmation(null)}
              disabled={busy}
            >
              取消
            </button>
            <button className="primary" onClick={confirm} disabled={busy}>
              {busy
                ? "正在处理…"
                : confirmation.kind === "delete"
                  ? "确认移出"
                  : "确认恢复"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "error" : ""}`}
        >
          {toast.message}
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
