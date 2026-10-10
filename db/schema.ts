import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const phoneListings = sqliteTable("phone_listings", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  storage: text("storage").notNull().default(""),
  color: text("color").notNull().default(""),
  condition: text("condition", { enum: ["excellent", "good", "fair"] }).notNull(),
  priceCents: integer("price_cents").notNull(),
  battery: integer("battery"),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["draft", "published", "sold"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  version: integer("version").notNull().default(1),
  writeToken: text("write_token").notNull().default(""),
}, (table) => [
  index("phone_listings_status_updated_idx").on(table.status, table.updatedAt),
  check("phone_price_range", sql`${table.priceCents} BETWEEN 1 AND 1000000`),
  check("phone_battery_range", sql`${table.battery} IS NULL OR ${table.battery} BETWEEN 0 AND 100`),
  check("phone_condition_values", sql`${table.condition} IN ('excellent','good','fair')`),
  check("phone_status_values", sql`${table.status} IN ('draft','published','sold')`),
]);

export const phoneImages = sqliteTable("phone_images", {
  id: text("id").primaryKey(),
  phoneId: text("phone_id").notNull().references(() => phoneListings.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  position: integer("position").notNull(),
}, (table) => [index("phone_images_phone_idx").on(table.phoneId)]);

export const tradeInRequests = sqliteTable("trade_in_requests", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  reference: text("reference").notNull().unique(),
  fingerprint: text("fingerprint").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
  state: text("state", { enum: ["active", "deleting", "deleted"] }).notNull().default("active"),
}, (table) => [
  index("trade_in_requests_state_created_idx").on(table.state, table.createdAt),
  check("trade_in_request_state_values", sql`${table.state} IN ('active','deleting','deleted')`),
]);

export const tradeInImages = sqliteTable("trade_in_images", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => tradeInRequests.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  side: text("side", { enum: ["front", "back", "additional1", "additional2"] }).notNull(),
}, (table) => [
  index("trade_in_images_request_idx").on(table.requestId),
  uniqueIndex("trade_in_images_request_side_idx").on(table.requestId, table.side),
  check("trade_in_image_side_values", sql`${table.side} IN ('front','back','additional1','additional2')`),
  check("trade_in_image_mime_values", sql`${table.mimeType} IN ('image/jpeg','image/png','image/webp')`),
]);
