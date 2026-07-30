import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  getProjectBucket,
  getSavedProject,
  projectImageKey,
  saveProjectImage,
} from "../../../../../db/projects";

const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function contourCount(stateJson: string) {
  try {
    const state = JSON.parse(stateJson) as {
      contours?: Array<{ closed?: boolean }>;
    };
    return state.contours?.filter((contour) => contour.closed).length ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { projectId } = await context.params;
    const project = await getSavedProject(user.email, projectId);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const image = await getProjectBucket().get(project.imageKey);
    if (!image) {
      return Response.json({ error: "Project image not found" }, { status: 404 });
    }

    const headers = new Headers();
    image.writeHttpMetadata(headers);
    headers.set(
      "Content-Type",
      project.imageType || headers.get("Content-Type") || "application/octet-stream",
    );
    headers.set("Cache-Control", "private, no-store");
    headers.set(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(project.imageName)}`,
    );
    if (image.size) headers.set("Content-Length", String(image.size));

    return new Response(image.body, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load project image";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  let replacementKey: string | null = null;
  try {
    const { projectId } = await context.params;
    const project = await getSavedProject(user.email, projectId);
    if (!project) return errorResponse("Project not found", 404);

    const formData = await request.formData();
    const state = formData.get("state");
    const image = formData.get("image");

    if (typeof state !== "string" || !state) {
      return errorResponse("Project state is required", 400);
    }
    if (new TextEncoder().encode(state).byteLength > MAX_STATE_BYTES) {
      return errorResponse("Project state is too large", 413);
    }
    JSON.parse(state);

    if (!(image instanceof File) || image.size === 0) {
      return errorResponse("Project image is required", 400);
    }
    if (!image.type.startsWith("image/")) {
      return errorResponse("Uploaded file must be an image", 400);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return errorResponse("Image is too large", 413);
    }

    const requestedImageName = formData.get("imageName");
    const imageName =
      typeof requestedImageName === "string" && requestedImageName
        ? requestedImageName.slice(0, 255)
        : image.name.slice(0, 255) || "Изображение";
    const imageType = image.type || "application/octet-stream";
    replacementKey = await projectImageKey(
      user.email,
      projectId,
      `source-${crypto.randomUUID()}`,
    );

    const bucket = getProjectBucket();
    await bucket.put(replacementKey, image.stream(), {
      httpMetadata: { contentType: imageType },
      customMetadata: { originalName: imageName },
    });

    const updatedAt = await saveProjectImage(
      user.email,
      projectId,
      state,
      replacementKey,
      imageName,
      imageType,
    );
    replacementKey = null;

    try {
      await bucket.delete(project.imageKey);
    } catch {
      // The replacement is already active; an orphaned object can be cleaned up later.
    }

    return Response.json({
      saved: true,
      title: project.title,
      imageName,
      imageType,
      contourCount: contourCount(state),
      updatedAt,
    });
  } catch (error) {
    if (replacementKey) {
      try {
        await getProjectBucket().delete(replacementKey);
      } catch {
        // The original error is more useful than a cleanup failure.
      }
    }
    const message =
      error instanceof Error ? error.message : "Unable to replace project image";
    return errorResponse(message, 500);
  }
}
