import { Icon } from "./Icon";
import { PanelHeading } from "./PanelHeading";
import type { ProjectSummary, SaveStatus } from "./types";

type ProjectsPanelProps = {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  saveStatus: SaveStatus;
  onAdd: () => void;
  onSelect: (projectId: string) => void;
  onDelete: (project: ProjectSummary) => void;
};

function contourLabel(count: number) {
  if (count === 1) return "1 контур";
  if (count > 1 && count < 5) return `${count} контура`;
  return `${count} контуров`;
}

export function ProjectsPanel({
  projects,
  activeProjectId,
  saveStatus,
  onAdd,
  onSelect,
  onDelete,
}: ProjectsPanelProps) {
  return (
    <aside className="projects-panel panel">
      <PanelHeading eyebrow="Библиотека" title="Проекты">
        <button
          className="icon-action add-project-icon"
          onClick={onAdd}
          disabled={saveStatus === "restoring"}
          aria-label="Добавить изображения"
          title="Добавить изображения"
        >
          +
        </button>
      </PanelHeading>

      <div className="project-list">
        {projects.length ? (
          projects.map((project) => (
            <div
              key={project.id}
              className={`project-card ${
                activeProjectId === project.id ? "selected" : ""
              }`}
            >
              <button
                className="project-open"
                onClick={() => onSelect(project.id)}
                disabled={
                  saveStatus === "restoring" &&
                  activeProjectId !== project.id
                }
              >
                <span className="project-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/projects/${encodeURIComponent(project.id)}/image?updated=${encodeURIComponent(project.updatedAt)}`}
                    alt=""
                  />
                </span>
                <span className="project-card-copy">
                  <strong>{project.title}</strong>
                  <small>{contourLabel(project.contourCount)}</small>
                </span>
              </button>
              <button
                className="project-delete"
                aria-label={`Удалить проект ${project.title}`}
                title="Удалить проект"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(project);
                }}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="empty-projects">
            <span className="empty-projects-icon">
              <Icon>▧</Icon>
            </span>
            <strong>
              {saveStatus === "restoring"
                ? "Загружаем проекты…"
                : "Проектов пока нет"}
            </strong>
            <p>Добавьте одно или сразу несколько изображений.</p>
          </div>
        )}
      </div>

      <button
        className="add-projects"
        onClick={onAdd}
        disabled={saveStatus === "restoring"}
      >
        <Icon>＋</Icon>
        Добавить изображения
      </button>

      <div className="projects-tip">
        <span className="tip-icon">i</span>
        <p>Маска и изображение сохраняются отдельно для каждого проекта.</p>
      </div>
    </aside>
  );
}
