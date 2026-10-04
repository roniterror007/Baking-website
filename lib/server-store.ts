import { env } from "./vercel-bindings";
import type { PostgresStatement } from "./postgres-store";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { INITIAL_PRODUCTS, CATEGORIES, DEFAULT_SETTINGS, type Product } from "./catalog";
import catalogImport from "../supabase/catalog-import.json";
import { adminSchema } from "./server-validation";
import { decodeOrderCursor, encodeOrderCursor, isSameOrigin, ownerMatches, type OrderCursor } from "./server-validation";
import type { z } from "zod";
const startingCatalog = adminSchema.parse(catalogImport);

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: Record<string, unknown>) { super(message); }
}
export type SQLStatement = PostgresStatement;
export function database(): NonNullable<typeof env.DB> {
  if (!env.DB) throw new ApiError(503, "storage_unavailable", "The bakery's ordering service is not configured yet.");
  return env.DB;
}
export function bucket(): NonNullable<typeof env.BUCKET> {
  if (!env.BUCKET) throw new ApiError(503, "uploads_unavailable", "Reference image uploads are not configured yet.");
  return env.BUCKET;
}
export function isOwner(user: ChatGPTUser | null): boolean {
  return ownerMatches(user, env.OWNER_EMAIL, env.OWNER_USER_ID);
}
export async function identity(owner = false): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, "sign_in_required", "Sign in to continue.");
  if (owner && !env.OWNER_EMAIL?.trim() && !env.OWNER_USER_ID?.trim()) throw new ApiError(503,"owner_setup_required","The bakery owner account has not been configured yet.");
  if (owner && !isOwner(user)) throw new ApiError(403, "forbidden", "Owner access is required.");
  return user;
}
export function mutation(request: Request) {
  if (!isSameOrigin(request)) throw new ApiError(403, "invalid_origin", "This request must originate from this website.");
}
export async function boundedBytes(request: Request, maximum: number): Promise<Uint8Array> {
  const length = Number(request.headers.get("content-length"));
  if (length > maximum) throw new ApiError(413, "body_too_large", "The submitted content is too large.");
  if (!request.body) throw new ApiError(400, "invalid_body", "No content was submitted.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ApiError(413, "body_too_large", "The submitted content is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function body<T extends z.ZodTypeAny>(request: Request, schema: T, maximum = 32768): Promise<z.output<T>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "invalid_content_type", "Send JSON content.");
  let data: unknown;
  try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await boundedBytes(request, maximum))); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, "invalid_json", "The submitted JSON could not be read."); }
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError(400, "validation_error", result.error.issues[0]?.message ?? "Check the submitted fields.", { fields: result.error.flatten() });
  return result.data;
}
export async function rateLimit(userId: string, action: string, limit: number, windowSeconds = 60) {
  const start = Math.floor(Date.now() / (windowSeconds * 1000));
  const row = await database().prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
    window_start = excluded.window_start RETURNING count`).bind(`${action}:${userId}`, start).first<{ count: number }>();
  if (!row || row.count > limit) throw new ApiError(429, "rate_limited", "Please wait a minute before trying again.");
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function route(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((error: unknown) => {
    if (error instanceof ApiError) return json({ error: error.code, message: error.message, ...error.detail }, error.status);
    console.error("Bakery API request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "service_unavailable", message: "We couldn't complete this request. Please try again shortly." }, 503);
  });
}

type ProductRow = { id: string; name: string; category: Product["category"]; collection: string; description: string;
  price_cents: number; image: string; featured: number; available: number; updated_at: number };
export function fromProductRow(row: ProductRow): Product {
  return { id: row.id, name: row.name, category: row.category, collection: row.collection, description: row.description,
    price: row.price_cents / 100, image: row.image, featured: Boolean(row.featured), available: Boolean(row.available) };
}
export function productWrite(product: Product, now: number): SQLStatement {
  return database().prepare(`INSERT INTO products (id,name,category,collection,description,price_cents,image,featured,available,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,collection=excluded.collection,
    description=excluded.description,price_cents=excluded.price_cents,image=excluded.image,featured=excluded.featured,available=excluded.available,updated_at=excluded.updated_at`)
    .bind(product.id, product.name, product.category, product.collection, product.description, Math.round(product.price * 100), product.image, Number(product.featured), Number(product.available), now);
}
export async function ensureCatalog(): Promise<void> {
  const db = database();
  if (await db.prepare("SELECT key FROM shop_settings WHERE key='catalog_initialized'").first()) return;
  const now = Date.now();
  // Provision schema by migration; seeds use conflict-ignore inside an atomic batch.
  const statements = (startingCatalog.products ?? INITIAL_PRODUCTS).map((p) => db.prepare(`INSERT OR IGNORE INTO products
    (id,name,category,collection,description,price_cents,image,featured,available,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(p.id,p.name,p.category,p.collection,p.description,Math.round(p.price*100),p.image,Number(p.featured),Number(p.available),now));
  for (const [key, value] of Object.entries({ settings: startingCatalog.settings ?? DEFAULT_SETTINGS, categories: startingCatalog.categories ?? CATEGORIES, catalog_initialized: true })) {
    statements.push(db.prepare("INSERT OR IGNORE INTO shop_settings (key,value,updated_at) VALUES (?,?,?)").bind(key,JSON.stringify(value),now));
  }
  await db.batch(statements);
}
export async function catalog() {
  await ensureCatalog(); const db = database();
  const [rows, settingRows] = await Promise.all([
    db.prepare("SELECT * FROM products ORDER BY rowid").all<ProductRow>(),
    db.prepare("SELECT key,value FROM shop_settings WHERE key IN ('settings','categories')").all<{ key: string; value: string }>(),
  ]);
  const values = Object.fromEntries(settingRows.results.map((r) => [r.key, JSON.parse(r.value)]));
  return { products: rows.results.map(fromProductRow), settings: values.settings ?? DEFAULT_SETTINGS,
    categories: values.categories ?? CATEGORIES };
}
export async function profile(userId: string) {
  const row = await database().prepare("SELECT * FROM profiles WHERE user_id=?").bind(userId)
    .first<{ full_name: string; phone: string; address: string; billing_address: string; saved_payment_method: string }>();
  return row ? { fullName: row.full_name, phone: row.phone, address: row.address, billingAddress: row.billing_address, savedPaymentMethod: row.saved_payment_method } : null;
}
type OrderRow = { id: string; user_id: string; customer_json: string; status: string; kind: string; total_cents: number;
  delivery_cents: number; payment_method: string; custom_json: string | null; created_at: number; updated_at: number };
type ItemRow = { id: string; order_id: string; product_id: string; name: string; quantity: number; weight: string;
  eggless: number; instructions: string; delivery_date: string; unit_cents: number };
export async function orderSummary() {
  const row = await database().prepare(`SELECT COUNT(*) AS orders,
    COALESCE(SUM(CASE WHEN kind='custom' THEN 1 ELSE 0 END),0) AS requests,
    COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','quote_requested') THEN total_cents ELSE 0 END),0) AS booked,
    COALESCE(SUM(CASE WHEN status='delivered' THEN total_cents ELSE 0 END),0) AS delivered FROM orders`)
    .first<{ orders: number; requests: number; booked: number; delivered: number }>();
  return { orders: Number(row?.orders || 0), requests: Number(row?.requests || 0), booked: Number(row?.booked || 0)/100, delivered: Number(row?.delivered || 0)/100 };
}
export async function listOrders(userId?: string, before?: number | OrderCursor, limit = 30) {
  const db = database(); const params: (string | number)[] = []; const clauses: string[] = [];
  if (userId) { clauses.push("user_id=?"); params.push(userId); }
  if (typeof before === "number") { clauses.push("created_at<?"); params.push(before); }
  else if (before) { clauses.push("(created_at<? OR (created_at=? AND id<?))"); params.push(before.createdAt,before.createdAt,before.id); }
  params.push(Math.min(Math.max(limit,1),100));
  const rows = await db.prepare(`SELECT * FROM orders ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...params).all<OrderRow>();
  return hydrateOrders(rows.results);
}
export function cursorFromRequest(request: Request): number | OrderCursor | undefined {
  const search = new URL(request.url).searchParams;
  const cursor = search.get("cursor");
  if (cursor) { const parsed = decodeOrderCursor(cursor); if (!parsed) throw new ApiError(400,"invalid_cursor","This order history cursor is invalid."); return parsed; }
  const before = Number(search.get("before"));
  return Number.isFinite(before) && before > 0 ? before : undefined;
}
export function nextOrderCursor(rows: { id:string; createdAt:string }[], limit: number): string | null {
  const last = rows.at(-1);
  return rows.length === limit && last ? encodeOrderCursor({ createdAt:Date.parse(last.createdAt),id:last.id }) : null;
}
async function hydrateOrders(rows: OrderRow[]) {
  if (!rows.length) return [];
  const db = database();
  const itemRows = await db.prepare(`SELECT * FROM order_items WHERE order_id IN (${rows.map(() => "?").join(",")}) ORDER BY rowid`)
    .bind(...rows.map((r) => r.id)).all<ItemRow>();
  return rows.map((row) => ({ id: row.id, status: row.status, kind: row.kind, total: row.total_cents/100,
    deliveryFee: row.delivery_cents/100, paymentMethod: row.payment_method, customer: JSON.parse(row.customer_json),
    custom: row.custom_json ? JSON.parse(row.custom_json) : null, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    items: itemRows.results.filter((r) => r.order_id === row.id).map((r) => ({ id:r.id, productId:r.product_id, name:r.name, quantity:r.quantity,
      weight:Number(r.weight), eggless:Boolean(r.eggless), instructions:r.instructions, deliveryDate:r.delivery_date, price:r.unit_cents/100, unitPrice:r.unit_cents/100 })) }));
}
export async function orderById(id: string, userId?: string) {
  const row = await database().prepare(`SELECT * FROM orders WHERE id=? ${userId ? "AND user_id=?" : ""}`).bind(...(userId ? [id,userId] : [id])).first<OrderRow>();
  if (!row) return null;
  return (await hydrateOrders([row]))[0];
}
export async function priorOrder(userId: string, key: string) {
  const row = await database().prepare("SELECT id FROM orders WHERE user_id=? AND idempotency_key=?").bind(userId,key).first<{ id: string }>();
  return row ? orderById(row.id,userId) : null;
}
