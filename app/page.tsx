"use client";

import { useRef, type ChangeEvent } from "react";
import { InspectorPanel } from "./editor/InspectorPanel";
import { LayersPanel } from "./editor/LayersPanel";
import { ProjectsPanel } from "./editor/ProjectsPanel";
import { Topbar } from "./editor/Topbar";
import type { ProjectSummary } from "./editor/types";
import { useMaskEditor } from "./editor/useMaskEditor";
import { Workspace } from "./editor/Workspace";

export default function Home() {
  const editor = useMaskEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    void editor.addImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleProjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    void editor.importProjectFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDeleteProject = (project: ProjectSummary) => {
    const confirmed = window.confirm(
      `Удалить проект «${project.title}» вместе с изображением и маской?`,
    );
    if (confirmed) void editor.removeProject(project.id);
  };

  return (
    <main className="app-shell">
      <Topbar
        imageName={editor.imageName}
        imageSize={editor.imageSize}
        hasImage={Boolean(editor.imageUrl)}
        completedCount={editor.completedCount}
        saveStatus={editor.saveStatus}
        savedAt={editor.savedAt}
        onAddImages={() => fileInputRef.current?.click()}
        onExportSvg={editor.exportSvg}
      />

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        aria-label="Добавить изображения"
      />
      <input
        ref={projectInputRef}
        className="visually-hidden"
        type="file"
        accept=".contour,application/json"
        onChange={handleProjectChange}
        aria-label="Открыть файл проекта Contour"
      />

      <section className="editor-grid">
        <ProjectsPanel
          projects={editor.projects}
          activeProjectId={editor.activeProjectId}
          saveStatus={editor.saveStatus}
          onAdd={() => fileInputRef.current?.click()}
          onSelect={(projectId) => void editor.selectProject(projectId)}
          onDelete={handleDeleteProject}
        />

        <LayersPanel
          imageUrl={editor.imageUrl}
          imageName={editor.imageName}
          hasImageBlob={Boolean(editor.imageBlob)}
          showImage={editor.showImage}
          contours={editor.contours}
          selectedId={editor.selectedId}
          completedCount={editor.completedCount}
          hasDraft={Boolean(editor.draftContour)}
          saveStatus={editor.saveStatus}
          onSelect={editor.setSelectedId}
          onToggleImage={() =>
            editor.setShowImage((visible) => !visible)
          }
          onToggleContour={(contour) =>
            editor.setContourProperty(contour.id, {
              visible: !contour.visible,
            })
          }
          onCreateContour={() => editor.createContour()}
          onExportProject={() => void editor.exportProjectFile()}
          onOpenProject={() => projectInputRef.current?.click()}
        />

        <Workspace
          viewportRef={editor.viewportRef}
          imageUrl={editor.imageUrl}
          imageName={editor.imageName}
          imageSize={editor.imageSize}
          showImage={editor.showImage}
          showGrid={editor.showGrid}
          saveStatus={editor.saveStatus}
          zoom={editor.zoom}
          stageWidth={editor.stageWidth}
          stageHeight={editor.stageHeight}
          stageScale={editor.stageScale}
          contours={editor.contours}
          selectedId={editor.selectedId}
          draftContour={editor.draftContour}
          fillOpacity={editor.fillOpacity}
          strokeWidth={editor.strokeWidth}
          onOpenImages={() => fileInputRef.current?.click()}
          onFilesDrop={(files) => void editor.addImages(files)}
          onToggleGrid={() => editor.setShowGrid((visible) => !visible)}
          onZoomReset={editor.resetZoom}
          onZoomIn={() => editor.nudgeZoom(1)}
          onZoomOut={() => editor.nudgeZoom(-1)}
          onImageLoad={editor.setImageSize}
          onCanvasPointerDown={editor.handleCanvasPointerDown}
          onCanvasPointerMove={editor.handleCanvasPointerMove}
          onCanvasPointerEnd={editor.endPointDrag}
          onSelectContour={editor.setSelectedId}
          onPointPointerDown={editor.handlePointPointerDown}
          onUndoLastPoint={editor.undoLastPoint}
          onCloseDraft={editor.closeDraft}
        />

        <InspectorPanel
          selectedContour={editor.selectedContour}
          fillOpacity={editor.fillOpacity}
          strokeWidth={editor.strokeWidth}
          completedCount={editor.completedCount}
          onDelete={editor.deleteSelected}
          onCloseDraft={editor.closeDraft}
          onChangeContour={editor.setContourProperty}
          onFillOpacityChange={editor.setFillOpacity}
          onStrokeWidthChange={editor.setStrokeWidth}
          onCopySvg={() => void editor.copySvg()}
        />
      </section>

      {editor.toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {editor.toast}
        </div>
      )}
    </main>
  );
}
