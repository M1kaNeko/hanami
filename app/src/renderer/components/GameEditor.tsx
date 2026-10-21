import { useState, type FormEvent } from "react";
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
    [busy, setBusy] = useState(false);
  function change<K extends keyof GameDraft>(k: K, value: GameDraft[K]) {
    setDraft((d) => ({ ...d, [k]: value }));
  }
  async function browse(type: "directory" | "executable" | "cover") {
    setError("");
    try {
      if (type === "directory") {
        const dir = unwrap(await api.selectDirectory());
        if (dir)
          setDraft((d) => ({
            ...d,
            directory: dir,
            executable: "",
            name: d.name || dir.split(/[\\/]/).filter(Boolean).at(-1) || "",
          }));
      } else if (type === "executable") {
        if (!draft.directory) throw Error("请先选择或填写游戏目录");
        const file = unwrap(await api.selectExecutable(draft.directory));
        if (file) change("executable", file);
      } else {
        const image = unwrap(await api.selectCover());
        if (image) setCover(image);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const valid = validateDraft({
        ...draft,
        tags: tags
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onSaved(unwrap(await api.saveGame(valid, game?.id, cover?.token)));
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
            {img ? <img src={img} alt="封面预览" /> : <ImagePlus size={23} />}
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
              也可以先留空，稍后再添加。
            </p>
          </div>
          {img && (
            <button
              type="button"
              className="cover-clear"
              onClick={() => {
                setCover(null);
                change("cover", null);
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
            <label className="field full">
              启动程序
              <div className="input-action">
                <input
                  aria-label="启动程序"
                  required
                  placeholder="选择游戏目录里的 .exe 文件"
                  value={draft.executable}
                  onChange={(e) => change("executable", e.target.value)}
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
          <button className="primary" type="submit" disabled={busy}>
            <Save size={14} />
            {busy ? "正在保存…" : "保存游戏"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
