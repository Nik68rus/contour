"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectState, SaveStatus } from "./types";

type ProjectPersistenceOptions = {
  projectState: ProjectState;
  imageBlob: Blob | null;
  imageName: string;
  onRestore: (state: ProjectState, imageBlob: Blob) => void;
  onToast: (message: string) => void;
};

export function useProjectPersistence({
  projectState,
  imageBlob,
  imageName,
  onRestore,
  onToast,
}: ProjectPersistenceOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("restoring");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const imageDirtyRef = useRef(false);
  const imageGenerationRef = useRef(0);
  const restoreCompleteRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const markImageDirty = useCallback(() => {
    imageGenerationRef.current += 1;
    imageDirtyRef.current = true;
    restoreCompleteRef.current = true;
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

          onRestore(payload.project.state, await imageResponse.blob());
          imageDirtyRef.current = false;
          setSavedAt(payload.project.updatedAt);
          setSaveStatus("saved");
          onToast("Проект восстановлен из облака");
        } else {
          setSaveStatus("idle");
        }
      } catch {
        if (!controller.signal.aborted) setSaveStatus("error");
      } finally {
        if (!controller.signal.aborted) restoreCompleteRef.current = true;
      }
    };

    void restoreProject();
    return () => controller.abort();
  }, [onRestore, onToast]);

  useEffect(() => {
    if (
      !restoreCompleteRef.current ||
      !imageBlob ||
      !projectState.imageSize.width ||
      !projectState.imageSize.height
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
  }, [imageBlob, imageName, projectState]);

  return { saveStatus, savedAt, markImageDirty };
}
