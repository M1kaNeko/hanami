import { Play, FolderOpen, Pencil, Trash2, Star } from "lucide-react";
import { statuses, type Game } from "../../shared/model";
import { Modal } from "./Modal";
import { Cover } from "./GameCard";
export function GameDetails({
  game,
  onClose,
  onEdit,
  onDelete,
  onLaunch,
  onFolder,
  busy,
}: {
  game: Game;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLaunch: () => void;
  onFolder: () => void;
  busy: boolean;
}) {
  return (
    <Modal title="故事档案" onClose={onClose} busy={busy}>
      <div className="detail-top">
        <div className="detail-cover">
          <Cover game={game} />
        </div>
        <div className="detail-info">
          <h3>{game.name}</h3>
          <span className="status-pill">{statuses[game.status]}</span>
          <p>
            <Star size={12} />{" "}
            {game.rating ? `${game.rating} / 10` : "还没有评分"}
          </p>
          <div className="tags">
            {game.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          <p className="hint">
            最近启动：
            {game.lastLaunchedAt
              ? new Date(game.lastLaunchedAt).toLocaleString("zh-CN")
              : "还未开始"}
          </p>
        </div>
      </div>
      <div className="detail-section">
        <h4>感想与笔记</h4>
        <p>{game.notes || "把这个故事带给你的感受，留在这里吧。"}</p>
      </div>
      <div className="detail-section">
        <h4>游戏路径</h4>
        <p className="hint">
          启动方式：
          {game.launchMode === "kirikiri" ? "内置吉里吉里 Z" : "直接启动 exe"}
        </p>
        <p className="path-text">
          {game.directory}
          <br />
          {game.executable}
        </p>
        <button className="secondary" onClick={onFolder} disabled={busy}>
          <FolderOpen size={13} />
          打开目录
        </button>
        <button
          className="secondary"
          style={{ marginLeft: 8 }}
          onClick={onEdit}
          disabled={busy}
        >
          <Pencil size={13} />
          修改路径与记录
        </button>
      </div>
      <div className="form-footer">
        <button
          className="secondary danger"
          style={{ marginRight: "auto" }}
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 size={13} />
          移出收藏
        </button>
        <button className="primary" onClick={onLaunch} disabled={busy}>
          <Play size={14} />
          {busy ? "启动中…" : "启动游戏"}
        </button>
      </div>
    </Modal>
  );
}
