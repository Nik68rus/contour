"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Point = { x: number; y: number };

type Contour = {
  id: number;
  name: string;
  color: string;
  points: Point[];
  closed: boolean;
  visible: boolean;
};

type ProjectState = {
  version: 1;
  imageName: string;
  imageSize: { width: number; height: number };
  contours: Contour[];
  selectedId: number | null;
  nextId: number;
  zoom: number;
  fillOpacity: number;
  strokeWidth: number;
  showImage: boolean;
  showGrid: boolean;
};

type ProjectBackup = {
  product: "contour";
  formatVersion: 1;
  state: ProjectState;
  image: {
    name: string;
    type: string;
    dataUrl: string;
  };
};

type SaveStatus = "restoring" | "idle" | "saving" | "saved" | "error";

const MASK_COLORS = ["#FF6B35", "#5B5BD6", "#11A36A", "#E1467C", "#E7A400"];
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200];

function Icon({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`icon ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function formatPoint(value: number) {
  return Number(value.toFixed(2));
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function isProjectBackup(value: unknown): value is ProjectBackup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProjectBackup>;
  return (
    candidate.product === "contour" &&
    candidate.formatVersion === 1 &&
    Boolean(candidate.state) &&
    candidate.image?.dataUrl?.startsWith("data:image/") === true
  );
}

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [contours, setContours] = useState<Contour[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nextId, setNextId] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [fitScale, setFitScale] = useState(1);
  const [fillOpacity, setFillOpacity] = useState(28);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showImage, setShowImage] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragPoint, setDragPoint] = useState<{
    contourId: number;
    pointIndex: number;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("restoring");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const imageDirtyRef = useRef(false);
  const imageGenerationRef = useRef(0);
  const restoreCompleteRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const selectedContour = useMemo(
    () => contours.find((contour) => contour.id === selectedId) ?? null,
    [contours, selectedId],
  );
  const draftContour = useMemo(
    () => contours.find((contour) => !contour.closed) ?? null,
    [contours],
  );

  const projectState = useMemo<ProjectState>(
    () => ({
      version: 1,
      imageName,
      imageSize,
      contours,
      selectedId,
      nextId,
      zoom,
      fillOpacity,
      strokeWidth,
      showImage,
      showGrid,
    }),
    [
      contours,
      fillOpacity,
      imageName,
      imageSize,
      nextId,
      selectedId,
      showGrid,
      showImage,
      strokeWidth,
      zoom,
    ],
  );

  const displayImageBlob = useCallback((blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setImageUrl(url);
    setImageBlob(blob);
  }, []);

  const applyProjectState = useCallback((state: ProjectState) => {
    setImageName(state.imageName);
    setImageSize(state.imageSize);
    setContours(state.contours);
    setSelectedId(state.selectedId);
    setNextId(state.nextId);
    setZoom(state.zoom);
    setFillOpacity(state.fillOpacity);
    setStrokeWidth(state.strokeWidth);
    setShowImage(state.showImage);
    setShowGrid(state.showGrid);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const restoreProject = async () => {
      try {
        const response = await fetch("/api/project", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Cloud restore unavailable");

        const payload = (await response.json()) as {
          project: {
            state: ProjectState;
            hasImage: boolean;
            updatedAt: string;
          } | null;
        };

        if (payload.project?.hasImage) {
          const imageResponse = await fetch(
            `/api/project/image?updated=${encodeURIComponent(payload.project.updatedAt)}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (!imageResponse.ok) throw new Error("Project image unavailable");

          const blob = await imageResponse.blob();
          displayImageBlob(blob);
          applyProjectState(payload.project.state);
          imageDirtyRef.current = false;
          setSavedAt(payload.project.updatedAt);
          setSaveStatus("saved");
          setToast("Проект восстановлен из облака");
        } else {
          setSaveStatus("idle");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setSaveStatus("error");
      } finally {
        if (!controller.signal.aborted) restoreCompleteRef.current = true;
      }
    };

    void restoreProject();
    return () => controller.abort();
  }, [applyProjectState, displayImageBlob]);

  useEffect(() => {
    if (
      !restoreCompleteRef.current ||
      !imageBlob ||
      !imageSize.width ||
      !imageSize.height
    ) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    const imageGeneration = imageGenerationRef.current;
    autosaveTimerRef.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const formData = new FormData();
        formData.append("state", JSON.stringify(projectState));
        if (imageDirtyRef.current) {
          formData.append("image", imageBlob, imageName || "image");
          formData.append("imageName", imageName || "image");
        }

        const response = await fetch("/api/project", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Cloud save unavailable");

        const payload = (await response.json()) as { updatedAt: string };
        if (imageGenerationRef.current === imageGeneration) {
          imageDirtyRef.current = false;
        }
        setSavedAt(payload.updatedAt);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [imageBlob, imageName, imageSize, projectState]);

  const updateFitScale = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !imageSize.width || !imageSize.height) return;
    const horizontalRoom = Math.max(120, viewport.clientWidth - 112);
    const verticalRoom = Math.max(120, viewport.clientHeight - 112);
    setFitScale(
      Math.min(
        horizontalRoom / imageSize.width,
        verticalRoom / imageSize.height,
        1,
      ),
    );
  }, [imageSize]);

  useEffect(() => {
    updateFitScale();
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [updateFitScale]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closeDraft = useCallback(() => {
    if (!draftContour || draftContour.points.length < 3) return;
    setContours((items) =>
      items.map((item) =>
        item.id === draftContour.id ? { ...item, closed: true } : item,
      ),
    );
    setToast(`Контур «${draftContour.name}» замкнут`);
  }, [draftContour]);

  const undoLastPoint = useCallback(() => {
    if (!draftContour) return;
    if (draftContour.points.length <= 1) {
      setContours((items) => items.filter((item) => item.id !== draftContour.id));
      setSelectedId(null);
      return;
    }
    setContours((items) =>
      items.map((item) =>
        item.id === draftContour.id
          ? { ...item, points: item.points.slice(0, -1) }
          : item,
      ),
    );
  }, [draftContour]);

  const deleteSelected = useCallback(() => {
    if (selectedId === null) return;
    setContours((items) => items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastPoint();
      }
      if (event.key === "Enter") closeDraft();
      if ((event.key === "Delete" || event.key === "Backspace") && !draftContour) {
        deleteSelected();
      }
      if (event.key === "Escape" && draftContour) {
        setContours((items) =>
          items.filter((item) => item.id !== draftContour.id),
        );
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDraft, deleteSelected, draftContour, undoLastPoint]);

  const loadFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("Выберите файл изображения");
      return;
    }
    if (saveStatus === "restoring") return;
    displayImageBlob(file);
    imageGenerationRef.current += 1;
    imageDirtyRef.current = true;
    setImageName(file.name);
    setImageSize({ width: 0, height: 0 });
    setContours([]);
    setSelectedId(null);
    setNextId(1);
    setZoom(100);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const exportProjectFile = async () => {
    if (!imageBlob) return;
    try {
      const backup: ProjectBackup = {
        product: "contour",
        formatVersion: 1,
        state: projectState,
        image: {
          name: imageName || "image",
          type: imageBlob.type || "application/octet-stream",
          dataUrl: await blobToDataUrl(imageBlob),
        },
      };
      const blob = new Blob([JSON.stringify(backup)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${imageName.replace(/\.[^/.]+$/, "") || "contour-project"}.contour`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast("Резервная копия проекта скачана");
    } catch {
      setToast("Не удалось создать файл проекта");
    }
  };

  const importProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text()) as unknown;
      if (!isProjectBackup(payload)) throw new Error("Invalid project");

      const imageResponse = await fetch(payload.image.dataUrl);
      const blob = await imageResponse.blob();
      displayImageBlob(blob);
      applyProjectState(payload.state);
      imageGenerationRef.current += 1;
      imageDirtyRef.current = true;
      restoreCompleteRef.current = true;
      setToast("Проект открыт и будет сохранён в облаке");
    } catch {
      setToast("Не удалось открыть файл проекта");
    }
  };

  const createContour = (firstPoint?: Point) => {
    if (draftContour) {
      setSelectedId(draftContour.id);
      return draftContour.id;
    }
    const id = nextId;
    const contour: Contour = {
      id,
      name: `Контур ${id}`,
      color: MASK_COLORS[(id - 1) % MASK_COLORS.length],
      points: firstPoint ? [firstPoint] : [],
      closed: false,
      visible: true,
    };
    setContours((items) => [...items, contour]);
    setSelectedId(id);
    setNextId((value) => value + 1);
    return id;
  };

  const getPointFromEvent = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(
        imageSize.width,
        Math.max(0, ((event.clientX - rect.left) / rect.width) * imageSize.width),
      ),
      y: Math.min(
        imageSize.height,
        Math.max(
          0,
          ((event.clientY - rect.top) / rect.height) * imageSize.height,
        ),
      ),
    };
  };

  const handleCanvasPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (!imageSize.width || dragPoint) return;
    const point = getPointFromEvent(event);
    if (draftContour) {
      setContours((items) =>
        items.map((item) =>
          item.id === draftContour.id
            ? { ...item, points: [...item.points, point] }
            : item,
        ),
      );
      setSelectedId(draftContour.id);
    } else {
      createContour(point);
    }
  };

  const handleCanvasPointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (!dragPoint) return;
    const point = getPointFromEvent(event);
    setContours((items) =>
      items.map((item) =>
        item.id !== dragPoint.contourId
          ? item
          : {
              ...item,
              points: item.points.map((oldPoint, index) =>
                index === dragPoint.pointIndex ? point : oldPoint,
              ),
            },
      ),
    );
  };

  const handlePointPointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    contour: Contour,
    pointIndex: number,
  ) => {
    event.stopPropagation();
    if (!contour.closed && pointIndex === 0 && contour.points.length >= 3) {
      closeDraft();
      return;
    }
    setSelectedId(contour.id);
    setDragPoint({ contourId: contour.id, pointIndex });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stageScale = fitScale * (zoom / 100);
  const stageWidth = Math.max(1, imageSize.width * stageScale);
  const stageHeight = Math.max(1, imageSize.height * stageScale);

  const setContourProperty = (
    id: number,
    patch: Partial<Pick<Contour, "name" | "color" | "visible">>,
  ) => {
    setContours((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const buildSvg = () => {
    const visibleContours = contours.filter(
      (contour) => contour.closed && contour.visible,
    );
    const paths = visibleContours
      .map((contour) => {
        const path = contour.points
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${formatPoint(point.x)} ${formatPoint(point.y)}`,
          )
          .join(" ");
        return `  <path id="contour-${contour.id}" d="${path} Z" fill="${contour.color}" fill-opacity="${fillOpacity / 100}" stroke="${contour.color}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
      })
      .join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageSize.width}" height="${imageSize.height}" viewBox="0 0 ${imageSize.width} ${imageSize.height}" preserveAspectRatio="xMidYMid meet">\n${paths}\n</svg>\n`;
  };

  const exportSvg = () => {
    if (!imageSize.width || !contours.some((contour) => contour.closed)) return;
    const blob = new Blob([buildSvg()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${imageName.replace(/\.[^/.]+$/, "") || "image"}-mask.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("SVG‑маска экспортирована");
  };

  const copySvg = async () => {
    if (!contours.some((contour) => contour.closed)) return;
    await navigator.clipboard.writeText(buildSvg());
    setToast("SVG скопирован в буфер");
  };

  const nudgeZoom = (direction: 1 | -1) => {
    const index = ZOOM_STEPS.findIndex((step) => step >= zoom);
    const nextIndex =
      direction === 1
        ? Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + 1))
        : Math.max(0, (index === -1 ? ZOOM_STEPS.length : index) - 1);
    setZoom(ZOOM_STEPS[nextIndex]);
  };

  const completedCount = contours.filter((contour) => contour.closed).length;
  const saveLabel =
    saveStatus === "restoring"
      ? "Восстановление…"
      : saveStatus === "saving"
        ? "Сохранение…"
        : saveStatus === "saved"
          ? savedAt
            ? `Сохранено ${new Date(savedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Сохранено"
          : saveStatus === "error"
            ? "Нет связи с облаком"
            : "Автосохранение";

  return (
    <main className="app-shell">
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
          <span className={`status-dot ${imageUrl ? "ready" : ""}`} />
          <span>{imageName || "Новый проект"}</span>
          {imageSize.width > 0 && (
            <small>
              {imageSize.width} × {imageSize.height}
            </small>
          )}
          <span className={`save-indicator ${saveStatus}`}>
            <i />
            {saveLabel}
          </span>
        </div>

        <div className="top-actions">
          <button
            className="button button-ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={saveStatus === "restoring"}
          >
            <Icon>↥</Icon>
            {imageUrl ? "Заменить" : "Открыть"}
          </button>
          <button
            className="button button-primary"
            onClick={exportSvg}
            disabled={!imageUrl || completedCount === 0}
          >
            <Icon>↓</Icon>
            Экспорт SVG
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            aria-label="Загрузить изображение"
          />
          <input
            ref={projectInputRef}
            className="visually-hidden"
            type="file"
            accept=".contour,application/json"
            onChange={importProjectFile}
            aria-label="Открыть файл проекта Contour"
          />
        </div>
      </header>

      <section className="editor-grid">
        <aside className="left-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Слои</span>
              <h2>Контуры</h2>
            </div>
            <span className="count-badge">{completedCount}</span>
          </div>

          <div className="layer-list">
            <button
              className={`layer-row image-layer ${selectedId === null ? "selected" : ""}`}
              onClick={() => setSelectedId(null)}
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
                  setShowImage((value) => !value);
                }}
              >
                {showImage ? "●" : "○"}
              </span>
            </button>

            {contours.map((contour) => (
              <button
                key={contour.id}
                className={`layer-row ${selectedId === contour.id ? "selected" : ""}`}
                onClick={() => setSelectedId(contour.id)}
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
                    setContourProperty(contour.id, {
                      visible: !contour.visible,
                    });
                  }}
                >
                  {contour.visible ? "●" : "○"}
                </span>
              </button>
            ))}
          </div>

          <button
            className="add-contour"
            onClick={() => createContour()}
            disabled={!imageUrl || Boolean(draftContour)}
          >
            <Icon>＋</Icon>
            Новый контур
          </button>

          <div className="project-file-actions">
            <button
              onClick={exportProjectFile}
              disabled={!imageBlob}
              title="Скачать резервную копию вместе с изображением"
            >
              <Icon>↓</Icon>
              Проект
            </button>
            <button
              onClick={() => projectInputRef.current?.click()}
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
              onClick={() => nudgeZoom(-1)}
              aria-label="Уменьшить"
            >
              −
            </button>
            <button
              className="zoom-value"
              onClick={() => setZoom(100)}
              title="Вписать изображение"
            >
              {zoom}%
            </button>
            <button
              className="tool-button"
              onClick={() => nudgeZoom(1)}
              aria-label="Увеличить"
            >
              ＋
            </button>
            <span className="toolbar-divider" />
            <button
              className={`tool-button ${showGrid ? "active-soft" : ""}`}
              onClick={() => setShowGrid((value) => !value)}
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
                onClick={() => fileInputRef.current?.click()}
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
              <div
                className="stage-space"
                style={{
                  width: stageWidth + 96,
                  height: stageHeight + 96,
                }}
              >
                <div
                  className="image-stage"
                  style={{ width: stageWidth, height: stageHeight }}
                >
                  {showImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={imageName}
                      draggable={false}
                      onLoad={(event) => {
                        setImageSize({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        });
                      }}
                    />
                  )}
                  {!showImage && imageUrl && !imageSize.width && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="dimension-probe"
                      onLoad={(event) =>
                        setImageSize({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        })
                      }
                    />
                  )}
                  {imageSize.width > 0 && (
                    <svg
                      className="mask-layer"
                      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                      preserveAspectRatio="none"
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={() => setDragPoint(null)}
                      onPointerCancel={() => setDragPoint(null)}
                      onPointerLeave={() => {
                        if (dragPoint) setDragPoint(null);
                      }}
                      aria-label="Область создания SVG маски"
                    >
                      {contours
                        .filter((contour) => contour.visible)
                        .map((contour) => {
                          const pointString = contour.points
                            .map((point) => `${point.x},${point.y}`)
                            .join(" ");
                          return (
                            <g key={contour.id}>
                              {contour.closed ? (
                                <polygon
                                  points={pointString}
                                  fill={contour.color}
                                  fillOpacity={fillOpacity / 100}
                                  stroke={contour.color}
                                  strokeWidth={strokeWidth / stageScale}
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    setSelectedId(contour.id);
                                  }}
                                />
                              ) : (
                                <polyline
                                  points={pointString}
                                  fill="none"
                                  stroke={contour.color}
                                  strokeWidth={strokeWidth / stageScale}
                                />
                              )}
                              {selectedId === contour.id &&
                                contour.points.map((point, pointIndex) => (
                                  <circle
                                    key={`${contour.id}-${pointIndex}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r={(pointIndex === 0 ? 6 : 4.5) / stageScale}
                                    fill={
                                      !contour.closed && pointIndex === 0
                                        ? contour.color
                                        : "#ffffff"
                                    }
                                    stroke={contour.color}
                                    strokeWidth={2 / stageScale}
                                    className={
                                      !contour.closed &&
                                      pointIndex === 0 &&
                                      contour.points.length >= 3
                                        ? "closing-point"
                                        : ""
                                    }
                                    onPointerDown={(event) =>
                                      handlePointPointerDown(
                                        event,
                                        contour,
                                        pointIndex,
                                      )
                                    }
                                  />
                                ))}
                            </g>
                          );
                        })}
                    </svg>
                  )}
                </div>
              </div>
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
                <button onClick={undoLastPoint}>Отменить точку</button>
                <button
                  onClick={closeDraft}
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

        <aside className="right-panel panel">
          <div className="panel-heading inspector-heading">
            <div>
              <span className="eyebrow">Свойства</span>
              <h2>{selectedContour ? selectedContour.name : "SVG‑маска"}</h2>
            </div>
            {selectedContour && (
              <button
                className="icon-action danger"
                onClick={deleteSelected}
                aria-label="Удалить контур"
                title="Удалить контур"
              >
                ×
              </button>
            )}
          </div>

          {selectedContour ? (
            <div className="inspector-content">
              <label className="field">
                <span>Название</span>
                <input
                  value={selectedContour.name}
                  onChange={(event) =>
                    setContourProperty(selectedContour.id, {
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
                      onClick={() =>
                        setContourProperty(selectedContour.id, { color })
                      }
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
                        setContourProperty(selectedContour.id, {
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
                  onClick={closeDraft}
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
            <label className="range-field">
              <span>
                Заливка <strong>{fillOpacity}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="80"
                value={fillOpacity}
                onChange={(event) => setFillOpacity(Number(event.target.value))}
              />
            </label>
            <label className="range-field">
              <span>
                Обводка <strong>{strokeWidth} px</strong>
              </span>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
            </label>
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
              onClick={copySvg}
              disabled={completedCount === 0}
              aria-label="Скопировать SVG"
              title="Скопировать SVG"
            >
              ⧉
            </button>
          </div>
        </aside>
      </section>

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}
