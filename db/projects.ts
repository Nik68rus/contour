import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from ".";
import { projects } from "./schema";

export type SavedProject = typeof projects.$inferSelect;

type ProjectWrite = {
  id: string;
  userEmail: string;
  title: string;
  stateJson: string;
  imageKey: string;
  imageName: string;
  imageType: string;
};

type ProjectRuntimeEnv = {
  PROJECT_FILES?: R2Bucket;
};

export async function listProjects(userEmail: string) {
  return getDb()
    .select()
    .from(projects)
    .where(eq(projects.userEmail, userEmail))
    .orderBy(desc(projects.updatedAt));
}

export async function getSavedProject(
  userEmail: string,
  projectId: string,
): Promise<SavedProject | null> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.userEmail, userEmail), eq(projects.id, projectId)),
    )
    .limit(1);
  return project ?? null;
}

export async function createProject(project: ProjectWrite) {
  const db = getDb();
  const createdAt = new Date().toISOString();

  await db.insert(projects).values({
    ...project,
    createdAt,
    updatedAt: createdAt,
  });

  return createdAt;
}

export async function saveProject(
  userEmail: string,
  projectId: string,
  stateJson: string,
  title: string,
) {
  const db = getDb();
  const updatedAt = new Date().toISOString();

  await db
    .update(projects)
    .set({ stateJson, title, updatedAt })
    .where(
      and(eq(projects.userEmail, userEmail), eq(projects.id, projectId)),
    );
  return updatedAt;
}

export async function saveProjectImage(
  userEmail: string,
  projectId: string,
  stateJson: string,
  imageKey: string,
  imageName: string,
  imageType: string,
) {
  const updatedAt = new Date().toISOString();

  await getDb()
    .update(projects)
    .set({
      stateJson,
      imageKey,
      imageName,
      imageType,
      updatedAt,
    })
    .where(
      and(eq(projects.userEmail, userEmail), eq(projects.id, projectId)),
    );
  return updatedAt;
}

export async function deleteProject(userEmail: string, projectId: string) {
  const project = await getSavedProject(userEmail, projectId);
  if (!project) return null;

  await getDb()
    .delete(projects)
    .where(
      and(eq(projects.userEmail, userEmail), eq(projects.id, projectId)),
    );
  return project;
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

export async function projectImageKey(
  userEmail: string,
  projectId: string,
  objectName = "source",
) {
  const data = new TextEncoder().encode(userEmail.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `projects/${hash}/${projectId}/${objectName}`;
}
