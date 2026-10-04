import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(), name: text("name").notNull(), category: text("category").notNull(),
  collection: text("collection").notNull(), description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(), image: text("image").notNull(),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("products_category_idx").on(table.category, table.available)]);

export const shopSettings = sqliteTable("shop_settings", {
  key: text("key").primaryKey(), value: text("value").notNull(), updatedAt: integer("updated_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(), fullName: text("full_name").notNull(), phone: text("phone").notNull(),
  address: text("address").notNull(), billingAddress: text("billing_address").notNull(),
  savedPaymentMethod: text("saved_payment_method").notNull().default("cod"), updatedAt: integer("updated_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), idempotencyKey: text("idempotency_key").notNull(),
  customerJson: text("customer_json").notNull(), status: text("status").notNull(), kind: text("kind").notNull(),
  totalCents: integer("total_cents").notNull(), deliveryCents: integer("delivery_cents").notNull(),
  paymentMethod: text("payment_method").notNull(), customJson: text("custom_json"), createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("orders_user_idempotency_idx").on(table.userId, table.idempotencyKey),
  index("orders_user_created_idx").on(table.userId, table.createdAt), index("orders_status_created_idx").on(table.status, table.createdAt)]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(), name: text("name").notNull(), quantity: integer("quantity").notNull(),
  weight: text("weight").notNull(), eggless: integer("eggless", { mode: "boolean" }).notNull(),
  instructions: text("instructions").notNull(), deliveryDate: text("delivery_date").notNull(), unitCents: integer("unit_cents").notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const uploads = sqliteTable("uploads", {
  key: text("key").primaryKey(), userId: text("user_id").notNull(), contentType: text("content_type").notNull(),
  size: integer("size").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [index("uploads_user_idx").on(table.userId)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), windowStart: integer("window_start").notNull(), count: integer("count").notNull(),
}, (table) => [index("rate_limits_window_idx").on(table.windowStart)]);
