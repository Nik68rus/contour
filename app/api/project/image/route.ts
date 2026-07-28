import { getChatGPTUser } from "../../../chatgpt-auth";
import { getProjectBucket, getSavedProject } from "../../../../db/projects";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const project = await getSavedProject(user.email);
    if (!project?.imageKey) {
      return Response.json({ error: "Project image not found" }, { status: 404 });
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
    if (project.imageName) {
      headers.set(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(project.imageName)}`,
      );
    }
    if (image.size) headers.set("Content-Length", String(image.size));

    return new Response(image.body, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load project image";
    return Response.json({ error: message }, { status: 500 });
  }
}
