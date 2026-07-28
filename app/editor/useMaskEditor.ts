"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  downloadProjectBackup,
  readProjectBackup,
} from "./project-file";
import type { Contour, Point, ProjectState } from "./types";
import { MASK_COLORS, ZOOM_STEPS } from "./types";
import { useProjectPersistence } from "./useProjectPersistence";

function formatPoint(value: number) {
  return Number(value.toFixed(2));
}

export function useMaskEditor() {
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
  const [dragPoint, setDragPoint] = useState<{
    contourId: number;
    pointIndex: number;
  } | null>(null);
  const [toast, setToast] = useState("");

  const viewportRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const selectedContour = useMemo(
    () => contours.find((contour) => contour.id === selectedId) ?? null,
    [contours, selectedId],
  );
  const draftContour = useMemo(
    () => contours.find((contour) => !contour.closed) ?? null,
    [contours],
  );
  const completedCount = useMemo(
    () => contours.filter((contour) => contour.closed).length,
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

  const clearProject = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setImageUrl(null);
    setImageBlob(null);
    setImageName("");
    setImageSize({ width: 0, height: 0 });
    setContours([]);
    setSelectedId(null);
    setNextId(1);
    setZoom(100);
    setFillOpacity(28);
    setStrokeWidth(2);
    setShowImage(true);
    setShowGrid(true);
  }, []);

  const restoreProject = useCallback(
    (state: ProjectState, blob: Blob) => {
      displayImageBlob(blob);
      applyProjectState(state);
    },
    [applyProjectState, displayImageBlob],
  );

  const {
    projects,
    activeProjectId,
    saveStatus,
    savedAt,
    createProjects,
    createProjectFromBackup,
    selectProject,
    removeProject,
  } = useProjectPersistence({
    projectState,
    imageBlob,
    onRestore: restoreProject,
    onClear: clearProject,
    onToast: setToast,
  });

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

  const exportProjectFile = async () => {
    if (!imageBlob) return;
    try {
      await downloadProjectBackup(projectState, imageBlob, imageName);
      setToast("Резервная копия проекта скачана");
    } catch {
      setToast("Не удалось создать файл проекта");
    }
  };

  const importProjectFile = async (file?: File) => {
    if (!file) return;
    try {
      const project = await readProjectBackup(file);
      await createProjectFromBackup(
        project.state,
        project.imageBlob,
        project.state.imageName,
      );
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

  const stageScale = fitScale * (zoom / 100);
  const stageWidth = Math.max(1, imageSize.width * stageScale);
  const stageHeight = Math.max(1, imageSize.height * stageScale);

  return {
    imageUrl,
    imageBlob,
    imageName,
    imageSize,
    contours,
    selectedId,
    selectedContour,
    draftContour,
    completedCount,
    zoom,
    fillOpacity,
    strokeWidth,
    showImage,
    showGrid,
    toast,
    projects,
    activeProjectId,
    saveStatus,
    savedAt,
    viewportRef,
    stageScale,
    stageWidth,
    stageHeight,
    addImages: createProjects,
    selectProject,
    removeProject,
    exportProjectFile,
    importProjectFile,
    createContour,
    exportSvg,
    copySvg,
    closeDraft,
    undoLastPoint,
    deleteSelected,
    setSelectedId,
    setShowImage,
    setShowGrid,
    setFillOpacity,
    setStrokeWidth,
    setImageSize,
    setContourProperty,
    nudgeZoom,
    resetZoom: () => setZoom(100),
    endPointDrag: () => setDragPoint(null),
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handlePointPointerDown,
  };
}
