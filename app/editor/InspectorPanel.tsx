import type { Contour } from "./types";
import { MASK_COLORS } from "./types";
import {
  CollapsedPanelRail,
  PanelCollapseButton,
} from "./CollapsiblePanel";
import { PanelHeading } from "./PanelHeading";
import { RangeControl } from "./RangeControl";

type InspectorPanelProps = {
  selectedContour: Contour | null;
  fillOpacity: number;
  strokeWidth: number;
  completedCount: number;
  collapsed: boolean;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onCloseDraft: () => void;
  onChangeContour: (
    id: number,
    patch: Partial<Pick<Contour, "name" | "color" | "visible">>,
  ) => void;
  onFillOpacityChange: (value: number) => void;
  onStrokeWidthChange: (value: number) => void;
  onCopySvg: () => void;
};

export function InspectorPanel({
  selectedContour,
  fillOpacity,
  strokeWidth,
  completedCount,
  collapsed,
  onDelete,
  onToggleCollapse,
  onCloseDraft,
  onChangeContour,
  onFillOpacityChange,
  onStrokeWidthChange,
  onCopySvg,
}: InspectorPanelProps) {
  if (collapsed) {
    return (
      <CollapsedPanelRail
        className="right-panel"
        side="right"
        label="Свойства"
        icon="⌘"
        onExpand={onToggleCollapse}
      />
    );
  }

  return (
    <aside className="right-panel panel">
      <PanelHeading
        eyebrow="Свойства"
        title={selectedContour ? selectedContour.name : "SVG‑маска"}
        className="inspector-heading"
      >
        <div className="panel-heading-actions">
          {selectedContour && (
            <button
              className="icon-action danger"
              onClick={onDelete}
              aria-label="Удалить контур"
              title="Удалить контур"
            >
              ×
            </button>
          )}
          <PanelCollapseButton
            side="right"
            label="Свернуть панель свойств"
            onClick={onToggleCollapse}
          />
        </div>
      </PanelHeading>

      {selectedContour ? (
        <div className="inspector-content">
          <label className="field">
            <span>Название</span>
            <input
              value={selectedContour.name}
              onChange={(event) =>
                onChangeContour(selectedContour.id, {
                  name: event.target.value,
                })
              }
            />
          </label>

          <div className="field">
            <span>Цвет контура</span>
            <div className="color-row">
              {MASK_COLORS.map((color) => (
                <button
                  key={color}
                  className={`swatch ${selectedContour.color === color ? "selected" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onChangeContour(selectedContour.id, { color })}
                  aria-label={`Цвет ${color}`}
                />
              ))}
              <label
                className="custom-color"
                style={{ backgroundColor: selectedContour.color }}
                title="Выбрать свой цвет"
              >
                <input
                  type="color"
                  value={selectedContour.color}
                  onChange={(event) =>
                    onChangeContour(selectedContour.id, {
                      color: event.target.value,
                    })
                  }
                />
                +
              </label>
            </div>
          </div>

          <div className="measure-grid">
            <div>
              <span>Точки</span>
              <strong>{selectedContour.points.length}</strong>
            </div>
            <div>
              <span>Состояние</span>
              <strong>{selectedContour.closed ? "Замкнут" : "Черновик"}</strong>
            </div>
          </div>

          {!selectedContour.closed && (
            <button
              className="button button-primary full-width"
              onClick={onCloseDraft}
              disabled={selectedContour.points.length < 3}
            >
              Замкнуть контур
            </button>
          )}
        </div>
      ) : (
        <div className="inspector-content">
          <div className="empty-inspector">
            <span className="empty-shape">
              <i />
              <i />
              <i />
              <i />
            </span>
            <strong>Выберите контур</strong>
            <p>Здесь появятся его название, цвет и параметры.</p>
          </div>
        </div>
      )}

      <div className="inspector-section">
        <div className="section-title">
          <span>Общие параметры</span>
        </div>
        <RangeControl
          label="Заливка"
          value={fillOpacity}
          valueLabel={`${fillOpacity}%`}
          min={0}
          max={80}
          onChange={onFillOpacityChange}
        />
        <RangeControl
          label="Обводка"
          value={strokeWidth}
          valueLabel={`${strokeWidth} px`}
          min={0}
          max={8}
          step={1}
          onChange={onStrokeWidthChange}
        />
      </div>

      <div className="export-card">
        <span className="export-icon">&lt;/&gt;</span>
        <div>
          <strong>Готово к экспорту</strong>
          <small>
            {completedCount
              ? `${completedCount} ${completedCount === 1 ? "контур" : "контура"} · исходный размер`
              : "Добавьте и замкните контур"}
          </small>
        </div>
        <button
          onClick={onCopySvg}
          disabled={completedCount === 0}
          aria-label="Скопировать SVG"
          title="Скопировать SVG"
        >
          ⧉
        </button>
      </div>
    </aside>
  );
}
