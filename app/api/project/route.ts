import { getChatGPTUser } from "../../chatgpt-auth";
import {
  getProjectBucket,
  getSavedProject,
  projectImageKey,
  saveProject,
} from "../../../db/projects";

const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const project = await getSavedProject(user.email);
    if (!project) return Response.json({ project: null });

    return Response.json({
      project: {
        state: JSON.parse(project.stateJson) as unknown,
        imageName: project.imageName,
        imageType: project.imageType,
        hasImage: Boolean(project.imageKey),
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load project";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  try {
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
    const previous = await getSavedProject(user.email);
    let imageKey = previous?.imageKey ?? null;
    let imageName = previous?.imageName ?? null;
    let imageType = previous?.imageType ?? null;

    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith("image/")) {
        return errorResponse("Uploaded file must be an image", 400);
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return errorResponse("Image is too large", 413);
      }

      imageKey = await projectImageKey(user.email);
      imageName =
        typeof formData.get("imageName") === "string"
          ? String(formData.get("imageName"))
          : "image";
      imageType = image.type || "application/octet-stream";
      await getProjectBucket().put(imageKey, image.stream(), {
        httpMetadata: { contentType: imageType },
        customMetadata: { originalName: imageName },
      });
    }

    const updatedAt = await saveProject({
      userEmail: user.email,
      stateJson: state,
      imageKey,
      imageName,
      imageType,
    });

    return Response.json({ saved: true, updatedAt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save project";
    return errorResponse(message, 500);
  }
}
