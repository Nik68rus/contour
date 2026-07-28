import type { ProjectBackup, ProjectState } from "./types";

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

export async function downloadProjectBackup(
  state: ProjectState,
  imageBlob: Blob,
  imageName: string,
) {
  const backup: ProjectBackup = {
    product: "contour",
    formatVersion: 1,
    state,
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
}

export async function readProjectBackup(file: File) {
  const payload = JSON.parse(await file.text()) as unknown;
  if (!isProjectBackup(payload)) throw new Error("Invalid Contour project");

  const imageResponse = await fetch(payload.image.dataUrl);
  return {
    state: payload.state,
    imageBlob: await imageResponse.blob(),
  };
}
