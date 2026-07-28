import { text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  userEmail: text("user_email").primaryKey(),
  stateJson: text("state_json").notNull(),
  imageKey: text("image_key"),
  imageName: text("image_name"),
  imageType: text("image_type"),
  updatedAt: text("updated_at").notNull(),
});
