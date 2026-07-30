export const MAX_SAFE_IMAGE_UPLOAD_BYTES = 800 * 1024;

const MAX_CANVAS_PIXELS = 24_000_000;
const MAX_CANVAS_DIMENSION = 12_000;
const QUALITY_STEPS = [0.82, 0.68, 0.54, 0.4, 0.28];
const SCALE_STEP = 0.82;
const MAX_SCALE_ATTEMPTS = 7;

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

function loadHtmlImage(blob: Blob) {
  return new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to decode image"));
    };
    image.src = url;
  });
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // SVG and a few browser-specific formats can require an HTML image.
    }
  }
  return loadHtmlImage(blob);
}

export async function getImageDimensions(image: Blob) {
  const decoded = await decodeImage(image);
  try {
    return { width: decoded.width, height: decoded.height };
  } finally {
    decoded.dispose();
  }
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Browser cannot encode this image")),
      "image/webp",
      quality,
    );
  });
}

function initialScale(width: number, height: number) {
  return Math.min(
    1,
    MAX_CANVAS_DIMENSION / Math.max(width, height),
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
  );
}

export async function compressImageForUpload(
  image: Blob,
  targetBytes = MAX_SAFE_IMAGE_UPLOAD_BYTES,
): Promise<CompressedImage> {
  const decoded = await decodeImage(image);
  const canvas = document.createElement("canvas");

  try {
    let scale = initialScale(decoded.width, decoded.height);

    for (let attempt = 0; attempt < MAX_SCALE_ATTEMPTS; attempt += 1) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Canvas is unavailable");
      context.clearRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await canvasToWebp(canvas, quality);
        if (blob.size <= targetBytes) {
          return {
            blob,
            width,
            height,
            originalSize: image.size,
            compressedSize: blob.size,
          };
        }
      }

      scale *= SCALE_STEP;
    }

    throw new Error("Unable to reach the upload size limit");
  } finally {
    decoded.dispose();
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
