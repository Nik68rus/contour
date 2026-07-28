import { getChatGPTUser } from "../../chatgpt-auth";
import {
  createProject,
  getProjectBucket,
  listProjects,
  projectImageKey,
} from "../../../db/projects";

const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

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

function projectSummary(project: Awaited<ReturnType<typeof listProjects>>[number]) {
  return {
    id: project.id,
    title: project.title,
    imageName: project.imageName,
    imageType: project.imageType,
    contourCount: contourCount(project.stateJson),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const projects = await listProjects(user.email);
    return Response.json({ projects: projects.map(projectSummary) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load projects";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  let imageKey: string | null = null;
  try {
    const formData = await request.formData();
    const state = formData.get("state");
    const image = formData.get("image");
    const requestedTitle = formData.get("title");

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

    const id = crypto.randomUUID();
    const imageName =
      typeof formData.get("imageName") === "string"
        ? String(formData.get("imageName")).slice(0, 255)
        : image.name.slice(0, 255) || "Изображение";
    const title =
      typeof requestedTitle === "string" && requestedTitle.trim()
        ? requestedTitle.trim().slice(0, 120)
        : imageName.replace(/\.[^/.]+$/, "").slice(0, 120) || "Новый проект";
    const imageType = image.type || "application/octet-stream";
    imageKey = await projectImageKey(user.email, id);

    await getProjectBucket().put(imageKey, image.stream(), {
      httpMetadata: { contentType: imageType },
      customMetadata: { originalName: imageName },
    });

    const createdAt = await createProject({
      id,
      userEmail: user.email,
      title,
      stateJson: state,
      imageKey,
      imageName,
      imageType,
    });

    return Response.json(
      {
        project: {
          id,
          title,
          imageName,
          imageType,
          contourCount: contourCount(state),
          createdAt,
          updatedAt: createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (imageKey) {
      try {
        await getProjectBucket().delete(imageKey);
      } catch {
        // The original error is more useful than a cleanup failure.
      }
    }
    const message =
      error instanceof Error ? error.message : "Unable to create project";
    return errorResponse(message, 500);
  }
}
