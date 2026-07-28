"use client";

import {
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
  type RefObject,
} from "react";
import { Icon } from "./Icon";
import { MaskStage } from "./MaskStage";
import type { Contour, SaveStatus } from "./types";

type WorkspaceProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  imageUrl: string | null;
  imageName: string;
  imageSize: { width: number; height: number };
  showImage: boolean;
  showGrid: boolean;
  saveStatus: SaveStatus;
  zoom: number;
  stageWidth: number;
  stageHeight: number;
  stageScale: number;
  contours: Contour[];
  selectedId: number | null;
  draftContour: Contour | null;
  fillOpacity: number;
  strokeWidth: number;
  onOpenImage: () => void;
  onFileDrop: (file?: File) => void;
  onToggleGrid: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onImageLoad: (size: { width: number; height: number }) => void;
  onCanvasPointerDown: PointerEventHandler<SVGSVGElement>;
  onCanvasPointerMove: PointerEventHandler<SVGSVGElement>;
  onCanvasPointerEnd: () => void;
  onSelectContour: (id: number) => void;
  onPointPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    contour: Contour,
    pointIndex: number,
  ) => void;
  onUndoLastPoint: () => void;
  onCloseDraft: () => void;
};

export function Workspace({
  viewportRef,
  imageUrl,
  imageName,
  imageSize,
  showImage,
  showGrid,
  saveStatus,
  zoom,
  stageWidth,
  stageHeight,
  stageScale,
  contours,
  selectedId,
  draftContour,
  fillOpacity,
  strokeWidth,
  onOpenImage,
  onFileDrop,
  onToggleGrid,
  onZoomReset,
  onZoomIn,
  onZoomOut,
  onImageLoad,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerEnd,
  onSelectContour,
  onPointPointerDown,
  onUndoLastPoint,
  onCloseDraft,
}: WorkspaceProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    onFileDrop(event.dataTransfer.files?.[0]);
  };

  return (
    <section className="workspace">
      <div className="floating-toolbar" aria-label="Инструменты масштаба">
        <button
          className="tool-button active"
          aria-label="Инструмент контур"
          title="Инструмент контур"
        >
          <Icon>⌁</Icon>
        </button>
        <span className="toolbar-divider" />
        <button
          className="tool-button"
          onClick={onZoomOut}
          aria-label="Уменьшить"
        >
          −
        </button>
        <button
          className="zoom-value"
          onClick={onZoomReset}
          title="Вписать изображение"
        >
          {zoom}%
        </button>
        <button
          className="tool-button"
          onClick={onZoomIn}
          aria-label="Увеличить"
        >
          ＋
        </button>
        <span className="toolbar-divider" />
        <button
          className={`tool-button ${showGrid ? "active-soft" : ""}`}
          onClick={onToggleGrid}
          aria-label="Фон рабочей области"
          title="Фон рабочей области"
        >
          ▦
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-viewport ${showGrid ? "with-grid" : ""} ${isDraggingFile ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDraggingFile(false);
        }}
        onDrop={handleDrop}
      >
        {!imageUrl ? (
          <button
            className="upload-card"
            onClick={onOpenImage}
            disabled={saveStatus === "restoring"}
          >
            <span className="upload-visual">
              <span className="image-corner top-left" />
              <span className="image-corner top-right" />
              <span className="image-corner bottom-left" />
              <span className="image-corner bottom-right" />
              <Icon>↥</Icon>
            </span>
            <strong>
              {saveStatus === "restoring"
                ? "Восстанавливаем проект…"
                : "Загрузите изображение"}
            </strong>
            <span>
              {saveStatus === "restoring"
                ? "Проверяем последнее облачное сохранение"
                : "PNG, JPG, WebP или SVG"}
            </span>
            <small>
              {saveStatus === "restoring"
                ? "Это займёт несколько секунд"
                : "Перетащите файл сюда или нажмите для выбора"}
            </small>
          </button>
        ) : (
          <MaskStage
            imageUrl={imageUrl}
            imageName={imageName}
            imageSize={imageSize}
            showImage={showImage}
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            stageScale={stageScale}
            contours={contours}
            selectedId={selectedId}
            fillOpacity={fillOpacity}
            strokeWidth={strokeWidth}
            onImageLoad={onImageLoad}
            onCanvasPointerDown={onCanvasPointerDown}
            onCanvasPointerMove={onCanvasPointerMove}
            onCanvasPointerEnd={onCanvasPointerEnd}
            onSelectContour={onSelectContour}
            onPointPointerDown={onPointPointerDown}
          />
        )}
        {isDraggingFile && (
          <div className="drop-overlay">
            <strong>Отпустите файл</strong>
            <span>Изображение откроется в редакторе</span>
          </div>
        )}
      </div>

      <div className="workspace-status">
        {draftContour ? (
          <>
            <span className="status-live" />
            <span>
              Поставлено точек: <strong>{draftContour.points.length}</strong>
            </span>
            <span className="status-separator" />
            <button onClick={onUndoLastPoint}>Отменить точку</button>
            <button
              onClick={onCloseDraft}
              disabled={draftContour.points.length < 3}
            >
              Замкнуть контур
            </button>
          </>
        ) : imageUrl ? (
          <>
            <span className="shortcut">Click</span>
            <span>Новый контур</span>
            <span className="status-separator" />
            <span className="shortcut">⌘ Z</span>
            <span>Отменить</span>
          </>
        ) : (
          <span>Изображение обрабатывается только в вашем браузере</span>
        )}
      </div>
    </section>
  );
}
