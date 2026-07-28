import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from ".";
import { projects } from "./schema";

export type SavedProject = typeof projects.$inferSelect;

type ProjectWrite = {
  userEmail: string;
  stateJson: string;
  imageKey: string | null;
  imageName: string | null;
  imageType: string | null;
};

type ProjectRuntimeEnv = {
  PROJECT_FILES?: R2Bucket;
};

export async function getSavedProject(
  userEmail: string,
): Promise<SavedProject | null> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.userEmail, userEmail))
    .limit(1);
  return project ?? null;
}

export async function saveProject(project: ProjectWrite) {
  const db = getDb();
  const updatedAt = new Date().toISOString();

  await db
    .insert(projects)
    .values({ ...project, updatedAt })
    .onConflictDoUpdate({
      target: projects.userEmail,
      set: {
        stateJson: project.stateJson,
        imageKey: project.imageKey,
        imageName: project.imageName,
        imageType: project.imageType,
        updatedAt,
      },
    });

  return updatedAt;
}

export function getProjectBucket(): R2Bucket {
  const bucket = (env as unknown as ProjectRuntimeEnv).PROJECT_FILES;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `PROJECT_FILES` is unavailable. Set the `r2` field in .openai/hosting.json to `PROJECT_FILES`.",
    );
  }
  return bucket;
}

export async function projectImageKey(userEmail: string) {
  const data = new TextEncoder().encode(userEmail.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `projects/${hash}/source`;
}
