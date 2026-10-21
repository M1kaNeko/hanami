import { useState } from "react";
import { Play, Star } from "lucide-react";
import { statuses, type Game } from "../../shared/model";
import { coverUrl } from "../api";
export const GAME_DRAG_TYPE = "application/x-hanami-game";
export function Cover({ game }: { game: Game }) {
  const img = coverUrl(game.cover);
  return (
    <div className="cover">
      {img ? (
        <img
          draggable={false}
          src={img}
          alt={`${game.name} 封面`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span
        className="cover-placeholder"
        style={img ? { visibility: "hidden" } : undefined}
      >
        {game.name}
      </span>
      <span className="status-pill">{statuses[game.status]}</span>
    </div>
  );
}
export function GameCard({
  game,
  onOpen,
  onLaunch,
  busy,
  onDragEnd,
}: {
  game: Game;
  onOpen: () => void;
  onLaunch: () => void;
  busy: boolean;
  onDragEnd: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <article
      className={`game-card ${dragging ? "is-dragging" : ""}`}
      draggable={!busy}
      onDragStart={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(GAME_DRAG_TYPE, game.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      title="拖到左侧游玩状态即可移动"
    >
      <button
        className="cover-button"
        aria-label={`查看 ${game.name}`}
        onClick={onOpen}
      >
        <Cover game={game} />
      </button>
      <div className="game-info">
        <h3 title={game.name}>{game.name}</h3>
        <div className="card-bottom">
          <small>
            {game.rating ? (
              <>
                <Star
                  size={10}
                  style={{ verticalAlign: "middle", marginRight: 4 }}
                />
                {game.rating.toFixed(1)}
              </>
            ) : (
              game.tags[0] || "等待故事开始"
            )}
          </small>
          <button
            className="play-small"
            aria-label={`启动 ${game.name}`}
            disabled={busy}
            onClick={onLaunch}
          >
            <Play size={11} fill="currentColor" />
          </button>
        </div>
      </div>
    </article>
  );
}
