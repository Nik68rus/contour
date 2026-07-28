import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const legacyProjects = sqliteTable("projects", {
  userEmail: text("user_email").primaryKey(),
  stateJson: text("state_json").notNull(),
  imageKey: text("image_key"),
  imageName: text("image_name"),
  imageType: text("image_type"),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable(
  "mask_projects",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    stateJson: text("state_json").notNull(),
    imageKey: text("image_key").notNull(),
    imageName: text("image_name").notNull(),
    imageType: text("image_type").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("mask_projects_user_updated_idx").on(
      table.userEmail,
      table.updatedAt,
    ),
  ],
);
