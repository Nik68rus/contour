import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("supports a componentized multi-project editor", async () => {
  const [page, projectsPanel, workspace, persistence, collapsiblePanel] =
    await Promise.all([
      source("app/page.tsx"),
      source("app/editor/ProjectsPanel.tsx"),
      source("app/editor/Workspace.tsx"),
      source("app/editor/useProjectPersistence.ts"),
      source("app/editor/CollapsiblePanel.tsx"),
    ]);

  assert.match(page, /<ProjectsPanel/);
  assert.match(page, /multiple/);
  assert.match(page, /editor\.addImages/);
  assert.match(page, /editor\.selectProject/);
  assert.match(projectsPanel, /project\.contourCount/);
  assert.match(projectsPanel, /Удалить проект/);
  assert.match(workspace, /Для каждого файла будет создан отдельный проект/);
  assert.match(persistence, /createProjects/);
  assert.match(persistence, /selectProject/);
  assert.match(persistence, /removeProject/);
  assert.match(page, /projects-collapsed/);
  assert.match(page, /layers-collapsed/);
  assert.match(page, /inspector-collapsed/);
  assert.match(page, /toggleFocusMode/);
  assert.match(collapsiblePanel, /CollapsedPanelRail/);
  assert.match(collapsiblePanel, /PanelCollapseButton/);
});

test("keeps every project scoped to its authenticated owner", async () => {
  const [database, collectionRoute, projectRoute, imageRoute] =
    await Promise.all([
      source("db/projects.ts"),
      source("app/api/projects/route.ts"),
      source("app/api/projects/[projectId]/route.ts"),
      source("app/api/projects/[projectId]/image/route.ts"),
    ]);

  assert.match(database, /eq\(projects\.userEmail, userEmail\)/);
  assert.match(database, /eq\(projects\.id, projectId\)/);
  assert.match(collectionRoute, /getChatGPTUser/);
  assert.match(projectRoute, /getSavedProject\(user\.email, projectId\)/);
  assert.match(imageRoute, /getSavedProject\(user\.email, projectId\)/);
});

test("migrates the previous single project without losing its image", async () => {
  const [schema, migration] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0001_chemical_captain_cross.sql"),
  ]);

  assert.match(schema, /sqliteTable\(\s*"mask_projects"/);
  assert.match(schema, /mask_projects_user_updated_idx/);
  assert.match(migration, /CREATE TABLE `mask_projects`/);
  assert.match(migration, /INSERT INTO `mask_projects`/);
  assert.match(migration, /FROM `projects`/);
  assert.match(migration, /WHERE `image_key` IS NOT NULL/);
});
