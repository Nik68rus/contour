import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  deleteProject,
  getProjectBucket,
  getSavedProject,
  saveProject,
} from "../../../../db/projects";

const MAX_STATE_BYTES = 2 * 1024 * 1024;

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
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const { projectId } = await context.params;
    const project = await getSavedProject(user.email, projectId);
    if (!project) return errorResponse("Project not found", 404);

    return Response.json({
      project: {
        id: project.id,
        title: project.title,
        state: JSON.parse(project.stateJson) as unknown,
        imageName: project.imageName,
        imageType: project.imageType,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load project";
    return errorResponse(message, 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const { projectId } = await context.params;
    const project = await getSavedProject(user.email, projectId);
    if (!project) return errorResponse("Project not found", 404);

    const payload = (await request.json()) as {
      state?: unknown;
      title?: unknown;
    };
    const state =
      typeof payload.state === "string"
        ? payload.state
        : JSON.stringify(payload.state);
    if (!state) return errorResponse("Project state is required", 400);
    if (new TextEncoder().encode(state).byteLength > MAX_STATE_BYTES) {
      return errorResponse("Project state is too large", 413);
    }
    JSON.parse(state);

    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim().slice(0, 120)
        : project.title;
    const updatedAt = await saveProject(
      user.email,
      projectId,
      state,
      title,
    );

    return Response.json({
      saved: true,
      updatedAt,
      contourCount: contourCount(state),
      title,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save project";
    return errorResponse(message, 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const { projectId } = await context.params;
    const project = await deleteProject(user.email, projectId);
    if (!project) return errorResponse("Project not found", 404);

    try {
      await getProjectBucket().delete(project.imageKey);
    } catch {
      // The project is already removed; an orphaned object can be cleaned up later.
    }
    return Response.json({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete project";
    return errorResponse(message, 500);
  }
}
