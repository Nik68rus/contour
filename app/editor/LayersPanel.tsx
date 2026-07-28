import { Icon } from "./Icon";
import { PanelHeading } from "./PanelHeading";
import type { Contour, SaveStatus } from "./types";

type LayersPanelProps = {
  imageUrl: string | null;
  imageName: string;
  hasImageBlob: boolean;
  showImage: boolean;
  contours: Contour[];
  selectedId: number | null;
  completedCount: number;
  hasDraft: boolean;
  saveStatus: SaveStatus;
  onSelect: (id: number | null) => void;
  onToggleImage: () => void;
  onToggleContour: (contour: Contour) => void;
  onCreateContour: () => void;
  onExportProject: () => void;
  onOpenProject: () => void;
};

export function LayersPanel({
  imageUrl,
  imageName,
  hasImageBlob,
  showImage,
  contours,
  selectedId,
  completedCount,
  hasDraft,
  saveStatus,
  onSelect,
  onToggleImage,
  onToggleContour,
  onCreateContour,
  onExportProject,
  onOpenProject,
}: LayersPanelProps) {
  return (
    <aside className="left-panel panel">
      <PanelHeading eyebrow="Слои" title="Контуры">
        <span className="count-badge">{completedCount}</span>
      </PanelHeading>

      <div className="layer-list">
        <button
          className={`layer-row image-layer ${selectedId === null ? "selected" : ""}`}
          onClick={() => onSelect(null)}
          disabled={!imageUrl}
        >
          <span className="layer-thumbnail">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" />
            ) : (
              <Icon>▧</Icon>
            )}
          </span>
          <span className="layer-copy">
            <strong>{imageName || "Изображение"}</strong>
            <small>Основа</small>
          </span>
          <span
            className="visibility-toggle"
            role="switch"
            aria-checked={showImage}
            onClick={(event) => {
              event.stopPropagation();
              onToggleImage();
            }}
          >
            {showImage ? "●" : "○"}
          </span>
        </button>

        {contours.map((contour) => (
          <button
            key={contour.id}
            className={`layer-row ${selectedId === contour.id ? "selected" : ""}`}
            onClick={() => onSelect(contour.id)}
          >
            <span
              className="color-chip"
              style={{ backgroundColor: contour.color }}
            />
            <span className="layer-copy">
              <strong>{contour.name}</strong>
              <small>
                {contour.closed
                  ? `${contour.points.length} точек`
                  : `Рисование · ${contour.points.length}`}
              </small>
            </span>
            <span
              className="visibility-toggle"
              role="switch"
              aria-checked={contour.visible}
              onClick={(event) => {
                event.stopPropagation();
                onToggleContour(contour);
              }}
            >
              {contour.visible ? "●" : "○"}
            </span>
          </button>
        ))}
      </div>

      <button
        className="add-contour"
        onClick={onCreateContour}
        disabled={!imageUrl || hasDraft}
      >
        <Icon>＋</Icon>
        Новый контур
      </button>

      <div className="project-file-actions">
        <button
          onClick={onExportProject}
          disabled={!hasImageBlob}
          title="Скачать резервную копию вместе с изображением"
        >
          <Icon>↓</Icon>
          Проект
        </button>
        <button
          onClick={onOpenProject}
          disabled={saveStatus === "restoring"}
          title="Открыть резервную копию проекта"
        >
          <Icon>↥</Icon>
          Открыть
        </button>
      </div>

      <div className="panel-tip">
        <span className="tip-icon">i</span>
        <p>
          Нажимайте на изображение, чтобы ставить точки. Замкните фигуру
          нажатием на первую точку.
        </p>
      </div>
    </aside>
  );
}
