import { Icon } from "./Icon";
import type { SaveStatus } from "./types";

type TopbarProps = {
  imageName: string;
  imageSize: { width: number; height: number };
  hasImage: boolean;
  completedCount: number;
  saveStatus: SaveStatus;
  savedAt: string | null;
  onOpenImage: () => void;
  onExportSvg: () => void;
};

function saveStatusLabel(status: SaveStatus, savedAt: string | null) {
  if (status === "restoring") return "Восстановление…";
  if (status === "saving") return "Сохранение…";
  if (status === "error") return "Нет связи с облаком";
  if (status !== "saved") return "Автосохранение";
  if (!savedAt) return "Сохранено";

  return `Сохранено ${new Date(savedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function Topbar({
  imageName,
  imageSize,
  hasImage,
  completedCount,
  saveStatus,
  savedAt,
  onOpenImage,
  onExportSvg,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>Contour</strong>
          <small>SVG mask studio</small>
        </div>
      </div>

      <div className="document-title">
        <span className={`status-dot ${hasImage ? "ready" : ""}`} />
        <span>{imageName || "Новый проект"}</span>
        {imageSize.width > 0 && (
          <small>
            {imageSize.width} × {imageSize.height}
          </small>
        )}
        <span className={`save-indicator ${saveStatus}`}>
          <i />
          {saveStatusLabel(saveStatus, savedAt)}
        </span>
      </div>

      <div className="top-actions">
        <button
          className="button button-ghost"
          onClick={onOpenImage}
          disabled={saveStatus === "restoring"}
        >
          <Icon>↥</Icon>
          {hasImage ? "Заменить" : "Открыть"}
        </button>
        <button
          className="button button-primary"
          onClick={onExportSvg}
          disabled={!hasImage || completedCount === 0}
        >
          <Icon>↓</Icon>
          Экспорт SVG
        </button>
      </div>
    </header>
  );
}
