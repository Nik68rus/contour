"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProjectState,
  ProjectSummary,
  SaveStatus,
} from "./types";

type ProjectPersistenceOptions = {
  projectState: ProjectState;
  imageBlob: Blob | null;
  onRestore: (state: ProjectState, imageBlob: Blob) => void;
  onClear: () => void;
  onToast: (message: string) => void;
};

type CreatedProject = {
  summary: ProjectSummary;
  state: ProjectState;
  image: Blob;
};

function initialProjectState(imageName: string): ProjectState {
  return {
    version: 1,
    imageName,
    imageSize: { width: 0, height: 0 },
    contours: [],
    selectedId: null,
    nextId: 1,
    zoom: 100,
    fillOpacity: 28,
    strokeWidth: 2,
    showImage: true,
    showGrid: true,
  };
}

function sortProjects(projects: ProjectSummary[]) {
  return [...projects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function useProjectPersistence({
  projectState,
  imageBlob,
  onRestore,
  onClear,
  onToast,
}: ProjectPersistenceOptions) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("restoring");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const activeProjectIdRef = useRef<string | null>(null);
  const projectsRef = useRef<ProjectSummary[]>([]);
  const projectStateRef = useRef(projectState);
  const imageBlobRef = useRef(imageBlob);
  const lastSavedStateRef = useRef("");
  const autosaveTimerRef = useRef<number | null>(null);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    projectsRef.current = projects;
    projectStateRef.current = projectState;
    imageBlobRef.current = imageBlob;
  }, [imageBlob, projectState, projects]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const saveCurrentProject = useCallback(async () => {
    const projectId = activeProjectIdRef.current;
    const currentImage = imageBlobRef.current;
    const currentState = projectStateRef.current;
    if (
      !projectId ||
      !currentImage ||
      !currentState.imageSize.width ||
      !currentState.imageSize.height
    ) {
      return true;
    }

    const stateJson = JSON.stringify(currentState);
    if (stateJson === lastSavedStateRef.current) return true;

    setSaveStatus("saving");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: stateJson }),
        },
      );
      if (!response.ok) throw new Error("Cloud save unavailable");

      const payload = (await response.json()) as {
        updatedAt: string;
        contourCount: number;
        title: string;
      };
      lastSavedStateRef.current = stateJson;
      setProjects((items) =>
        sortProjects(
          items.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  title: payload.title,
                  imageName: currentState.imageName,
                  contourCount: payload.contourCount,
                  updatedAt: payload.updatedAt,
                }
              : item,
          ),
        ),
      );

      if (activeProjectIdRef.current === projectId) {
        setSavedAt(payload.updatedAt);
        setSaveStatus("saved");
      }
      return true;
    } catch {
      if (activeProjectIdRef.current === projectId) setSaveStatus("error");
      return false;
    }
  }, []);

  const flushCurrentProject = useCallback(async () => {
    clearAutosaveTimer();
    return saveCurrentProject();
  }, [clearAutosaveTimer, saveCurrentProject]);

  const activateLocalProject = useCallback(
    (project: CreatedProject, announce = true) => {
      loadGenerationRef.current += 1;
      clearAutosaveTimer();
      activeProjectIdRef.current = project.summary.id;
      lastSavedStateRef.current = JSON.stringify(project.state);
      setActiveProjectId(project.summary.id);
      setSavedAt(project.summary.updatedAt);
      onRestore(project.state, project.image);
      setSaveStatus("saved");
      if (announce) onToast(`Открыт проект «${project.summary.title}»`);
    },
    [clearAutosaveTimer, onRestore, onToast],
  );

  const selectProject = useCallback(
    async (
      projectId: string,
      options: { skipSave?: boolean; announce?: boolean } = {},
    ) => {
      if (projectId === activeProjectIdRef.current) return;

      const loadGeneration = ++loadGenerationRef.current;
      if (!options.skipSave) await flushCurrentProject();
      if (loadGeneration !== loadGenerationRef.current) return;

      setSaveStatus("restoring");
      try {
        const [projectResponse, imageResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/image`, {
            cache: "no-store",
          }),
        ]);
        if (!projectResponse.ok || !imageResponse.ok) {
          throw new Error("Project restore unavailable");
        }

        const payload = (await projectResponse.json()) as {
          project: {
            id: string;
            title: string;
            state: ProjectState;
            updatedAt: string;
          };
        };
        const image = await imageResponse.blob();
        if (loadGeneration !== loadGenerationRef.current) return;

        activeProjectIdRef.current = projectId;
        lastSavedStateRef.current = JSON.stringify(payload.project.state);
        setActiveProjectId(projectId);
        setSavedAt(payload.project.updatedAt);
        onRestore(payload.project.state, image);
        setSaveStatus("saved");
        if (options.announce !== false) {
          onToast(`Открыт проект «${payload.project.title}»`);
        }
      } catch {
        if (loadGeneration === loadGenerationRef.current) {
          setSaveStatus("error");
          onToast("Не удалось открыть проект");
        }
      }
    },
    [flushCurrentProject, onRestore, onToast],
  );

  const createRemoteProject = useCallback(
    async (
      image: Blob,
      imageName: string,
      state: ProjectState,
    ): Promise<CreatedProject> => {
      const formData = new FormData();
      formData.append("state", JSON.stringify(state));
      formData.append("image", image, imageName || "image");
      formData.append("imageName", imageName || "image");

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Project creation unavailable");

      const payload = (await response.json()) as {
        project: ProjectSummary;
      };
      return { summary: payload.project, state, image };
    },
    [],
  );

  const createProjects = useCallback(
    async (files: File[]) => {
      const images = files
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, 20);
      if (!images.length) {
        onToast("Выберите файлы изображений");
        return;
      }

      await flushCurrentProject();
      setSaveStatus("saving");

      const created: CreatedProject[] = [];
      for (const file of images) {
        try {
          const state = initialProjectState(file.name);
          created.push(await createRemoteProject(file, file.name, state));
        } catch {
          // Continue uploading the other selected images.
        }
      }

      if (!created.length) {
        setSaveStatus("error");
        onToast("Не удалось добавить изображения");
        return;
      }

      setProjects((items) =>
        sortProjects([
          ...created.map((project) => project.summary),
          ...items.filter(
            (item) =>
              !created.some((project) => project.summary.id === item.id),
          ),
        ]),
      );
      activateLocalProject(created[0], false);
      onToast(
        created.length === 1
          ? "Новый проект создан"
          : `Добавлено проектов: ${created.length}`,
      );
    },
    [
      activateLocalProject,
      createRemoteProject,
      flushCurrentProject,
      onToast,
    ],
  );

  const createProjectFromBackup = useCallback(
    async (state: ProjectState, image: Blob, backupImageName: string) => {
      await flushCurrentProject();
      setSaveStatus("saving");
      try {
        const created = await createRemoteProject(
          image,
          backupImageName,
          state,
        );
        setProjects((items) =>
          sortProjects([
            created.summary,
            ...items.filter((item) => item.id !== created.summary.id),
          ]),
        );
        activateLocalProject(created, false);
        onToast("Проект импортирован в библиотеку");
      } catch {
        setSaveStatus("error");
        onToast("Не удалось импортировать проект");
      }
    },
    [
      activateLocalProject,
      createRemoteProject,
      flushCurrentProject,
      onToast,
    ],
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      const isActive = activeProjectIdRef.current === projectId;
      if (isActive) {
        clearAutosaveTimer();
        loadGenerationRef.current += 1;
      }

      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Project deletion unavailable");

        const remaining = projectsRef.current.filter(
          (project) => project.id !== projectId,
        );
        setProjects(remaining);
        if (isActive) {
          activeProjectIdRef.current = null;
          lastSavedStateRef.current = "";
          setActiveProjectId(null);
          setSavedAt(null);
          onClear();
          if (remaining[0]) {
            await selectProject(remaining[0].id, {
              skipSave: true,
              announce: false,
            });
          } else {
            setSaveStatus("idle");
          }
        }
        onToast("Проект удалён");
      } catch {
        setSaveStatus("error");
        onToast("Не удалось удалить проект");
      }
    },
    [clearAutosaveTimer, onClear, onToast, selectProject],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreLibrary = async () => {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) throw new Error("Project library unavailable");
        const payload = (await response.json()) as {
          projects: ProjectSummary[];
        };
        if (cancelled) return;

        setProjects(payload.projects);
        if (payload.projects[0]) {
          await selectProject(payload.projects[0].id, {
            skipSave: true,
            announce: false,
          });
          if (!cancelled) onToast("Последний проект восстановлен из облака");
        } else {
          setSaveStatus("idle");
        }
      } catch {
        if (!cancelled) setSaveStatus("error");
      }
    };

    void restoreLibrary();
    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
    };
  }, [onToast, selectProject]);

  useEffect(() => {
    const projectId = activeProjectIdRef.current;
    if (
      !projectId ||
      !imageBlob ||
      !projectState.imageSize.width ||
      !projectState.imageSize.height
    ) {
      return;
    }

    const stateJson = JSON.stringify(projectState);
    if (stateJson === lastSavedStateRef.current) return;

    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveCurrentProject();
    }, 900);

    return clearAutosaveTimer;
  }, [
    clearAutosaveTimer,
    imageBlob,
    projectState,
    saveCurrentProject,
  ]);

  return {
    projects,
    activeProjectId,
    saveStatus,
    savedAt,
    createProjects,
    createProjectFromBackup,
    selectProject,
    removeProject,
  };
}
