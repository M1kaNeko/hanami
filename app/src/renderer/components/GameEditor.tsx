import { useRef, useState, type FormEvent } from "react";
import { FolderOpen, ImagePlus, Save } from "lucide-react";
import type { DesktopApi, Selection } from "../../shared/api";
import { statuses, type Game, type GameDraft } from "../../shared/model";
import { validateDraft } from "../../shared/validation";
import { coverUrl, unwrap } from "../api";
import { Modal } from "./Modal";
const fresh: GameDraft = {
  name: "",
  directory: "",
  executable: "",
  cover: null,
  tags: [],
  status: "wishlist",
  rating: null,
  notes: "",
};
export function GameEditor({
  game,
  api,
  onClose,
  onSaved,
}: {
  game?: Game;
  api: DesktopApi;
  onClose: () => void;
  onSaved: (g: Game) => void;
}) {
  const [draft, setDraft] = useState<GameDraft>(
      game ? { ...game } : { ...fresh },
    ),
    [tags, setTags] = useState(game?.tags.join("，") ?? ""),
    [cover, setCover] = useState<Selection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [coverBusy, setCoverBusy] = useState(false);
  const coverManual = useRef(
      Boolean(game?.cover && game.coverSource !== "executable"),
    ),
    coverRequest = useRef(0),
    coverExecutable = useRef(game?.executable ?? "");
  const nameEdited = useRef(Boolean(game?.name.trim()));
  function change<K extends keyof GameDraft>(k: K, value: GameDraft[K]) {
    if (k === "name") nameEdited.current = Boolean(String(value).trim());
    if (k === "executable" && !coverManual.current) {
      coverRequest.current++;
      coverExecutable.current = "";
      setCoverBusy(false);
      setCover(null);
      setDraft((d) => ({
        ...d,
        [k]: value,
        cover: null,
        coverSource: undefined,
      }));
    } else setDraft((d) => ({ ...d, [k]: value }));
  }
  async function defaultCover(executable: string): Promise<Selection | null> {
    if (coverManual.current || draft.launchMode === "kirikiri") return null;
    coverExecutable.current = executable.trim();
    const request = ++coverRequest.current;
    setCover(null);
    setDraft((d) => ({ ...d, cover: null, coverSource: undefined }));
    setCoverBusy(true);
    try {
      const result = await api.getExecutableCover(executable);
      if (request === coverRequest.current && !coverManual.current) {
        setCover(result.ok ? result.value : null);
        if (result.ok && result.value)
          setDraft((d) => ({ ...d, coverSource: "executable" }));
        return result.ok ? result.value : null;
      }
    } catch {
      /* Default images are optional; an unavailable icon must not block adding a game. */
    } finally {
      if (request === coverRequest.current) setCoverBusy(false);
    }
    return null;
  }
  async function browse(type: "directory" | "executable" | "cover") {
    setError("");
    try {
      if (type === "directory") {
        const dir = unwrap(await api.selectDirectory());
        if (dir) {
          if (!coverManual.current) {
            coverRequest.current++;
            setCoverBusy(false);
            setCover(null);
          }
          setDraft((d) => ({
            ...d,
            directory: dir,
            executable: "",
            cover: coverManual.current ? d.cover : null,
            coverSource: coverManual.current ? d.coverSource : undefined,
            name: nameEdited.current
              ? d.name
              : (dir.split(/[\\/]/).filter(Boolean).at(-1) || "").slice(0, 200),
          }));
        }
      } else if (type === "executable") {
        if (!draft.directory) throw Error("请先选择或填写游戏目录");
        const file = unwrap(await api.selectExecutable(draft.directory));
        if (file) {
          setDraft((d) => {
            const suggested = (
              d.directory.split(/[\\/]/).filter(Boolean).at(-1) ?? ""
            ).slice(0, 200);
            return {
              ...d,
              executable: file,
              name: nameEdited.current ? d.name : suggested,
            };
          });
          await defaultCover(file);
        }
      } else {
        const image = unwrap(await api.selectCover());
        if (image) {
          coverManual.current = true;
          coverRequest.current++;
          setCoverBusy(false);
          setCover(image);
          setDraft((d) => ({ ...d, coverSource: "manual" }));
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (coverBusy) return;
    setError("");
    setBusy(true);
    try {
      let chosen = cover;
      if (
        draft.launchMode !== "kirikiri" &&
        !coverManual.current &&
        draft.executable.trim() !== coverExecutable.current
      ) {
        chosen = await defaultCover(draft.executable.trim());
      }
      const valid = validateDraft({
        ...draft,
        tags: tags
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onSaved(unwrap(await api.saveGame(valid, game?.id, chosen?.token)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const img = cover?.preview ?? coverUrl(draft.cover);
  return (
    <Modal
      title={game ? "编辑游戏" : "添加一个新故事"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        {error && (
          <div role="alert" className="inline-error">
            {error}
          </div>
        )}
        <div className="form-cover">
          <div className="cover-preview">
            {coverBusy ? (
              <span className="hint">提取图标…</span>
            ) : img ? (
              <img src={img} alt="封面预览" />
            ) : (
              <ImagePlus size={23} />
            )}
          </div>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => browse("cover")}
              disabled={busy}
            >
              <ImagePlus size={14} />
              选择封面
            </button>
            <p className="hint">
              PNG / JPG / WebP · 最大 10 MiB
              <br />
              {draft.launchMode === "kirikiri"
                ? "内置引擎模式可手动选择封面。"
                : "选择程序后默认使用 exe 图标。"}
            </p>
          </div>
          {img && (
            <button
              type="button"
              className="cover-clear"
              onClick={() => {
                coverManual.current = false;
                coverRequest.current++;
                setCoverBusy(false);
                setCover(null);
                setDraft((d) => ({
                  ...d,
                  cover: null,
                  coverSource: undefined,
                }));
              }}
            >
              移除
            </button>
          )}
        </div>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <label className="field full">
              游戏名称
              <input
                aria-label="游戏名称"
                required
                maxLength={200}
                placeholder="这个故事叫什么名字？"
                value={draft.name}
                onChange={(e) => change("name", e.target.value)}
              />
              <span className="hint">
                默认使用游戏文件夹名，也可以自己修改。
              </span>
            </label>
            <label className="field full">
              启动方式
              <select
                aria-label="启动方式"
                value={draft.launchMode ?? "executable"}
                onChange={(e) => {
                  const mode = e.target.value as GameDraft["launchMode"];
                  coverRequest.current++;
                  coverExecutable.current = "";
                  setCoverBusy(false);
                  if (!coverManual.current) setCover(null);
                  setDraft((d) => ({
                    ...d,
                    launchMode: mode,
                    executable: "",
                    cover: coverManual.current ? d.cover : null,
                    coverSource: coverManual.current
                      ? d.coverSource
                      : undefined,
                  }));
                }}
              >
                <option value="executable">直接启动 exe</option>
                <option value="kirikiri">内置吉里吉里 Z</option>
              </select>
              {draft.launchMode === "kirikiri" && (
                <span className="hint">
                  选择含 startup.tjs、data/startup.tjs 或 data.xp3
                  的完整目录。游戏在独立窗口打开；部分专用插件或加密游戏需要原
                  exe。存档由花间按游戏分开保存，书架备份不包含存档。
                </span>
              )}
            </label>
            <label className="field full">
              游戏目录
              <div className="input-action">
                <input
                  aria-label="游戏目录"
                  required
                  placeholder="例如 D:\Games\Summer"
                  value={draft.directory}
                  onChange={(e) => change("directory", e.target.value)}
                />
                <button
                  type="button"
                  className="secondary"
                  aria-label="选择游戏目录"
                  onClick={() => browse("directory")}
                >
                  <FolderOpen size={15} />
                </button>
              </div>
            </label>
            {draft.launchMode !== "kirikiri" && (
              <label className="field full">
                启动程序
                <div className="input-action">
                  <input
                    aria-label="启动程序"
                    required
                    placeholder="选择游戏目录里的 .exe 文件"
                    value={draft.executable}
                    onChange={(e) => change("executable", e.target.value)}
                    onBlur={(e) => {
                      if (
                        e.relatedTarget instanceof HTMLButtonElement &&
                        e.relatedTarget.type === "submit"
                      )
                        return;
                      const value = e.target.value.trim();
                      if (
                        /\.exe$/i.test(value) &&
                        value !== coverExecutable.current
                      )
                        void defaultCover(value);
                    }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    aria-label="选择启动程序"
                    onClick={() => browse("executable")}
                  >
                    <FolderOpen size={15} />
                  </button>
                </div>
                <span className="hint">
                  在 Windows 中选择游戏实际所在的路径。
                </span>
              </label>
            )}
            <label className="field">
              游玩状态
              <select
                value={draft.status}
                onChange={(e) =>
                  change("status", e.target.value as GameDraft["status"])
                }
              >
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              我的评分
              <select
                value={draft.rating ?? ""}
                onChange={(e) =>
                  change(
                    "rating",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">未评分</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} 分
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              标签
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：日常，治愈，剧情（用逗号分隔）"
              />
            </label>
            <label className="field full">
              感想与笔记
              <textarea
                maxLength={20000}
                placeholder="记下喜欢的台词、当前路线，或此刻的心情…"
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <div className="form-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="primary"
            type="submit"
            disabled={busy || coverBusy}
          >
            <Save size={14} />
            {busy ? "正在保存…" : coverBusy ? "提取图标…" : "保存游戏"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
