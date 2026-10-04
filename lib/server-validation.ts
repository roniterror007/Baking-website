import { z } from "zod";
import type { Product } from "./catalog";

export const idSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().max(max);
export const customerSchema = z.object({
  fullName: text(100).min(2), phone: text(20).regex(/^[+\d][\d\s()-]{7,19}$/, "Enter a valid phone number"),
  address: text(1000).min(10), billingAddress: text(1000).optional().default(""),
}).strict();
export const profileSchema = customerSchema.extend({ savedPaymentMethod: z.enum(["cod", "upi"]).default("cod") });
export const orderItemSchema = z.object({
  productId: idSchema, quantity: z.number().int().min(1).max(10), weight: z.number().min(0.5).max(12),
  eggless: z.boolean(), instructions: text(1500).default(""), deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedPrice: z.number().finite().nonnegative().max(1000000).optional(),
}).strict();
export const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(20), customer: customerSchema,
  paymentMethod: z.literal("cod"), idempotencyKey: z.string().min(12).max(100).regex(/^[\w-]+$/),
  expectedTotal: z.number().finite().nonnegative().max(10000000).optional(),
}).strict();
export const customOrderSchema = z.object({
  inspiration: text(10000).min(5), bakingInstructions: text(10000).default(""),
  weight: z.number().refine((n) => [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].includes(n), "Choose a supported cake weight"),
  eggless: z.boolean(), deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceKey: z.string().max(160).regex(/^references\/[a-f0-9-]+\.(jpg|png|webp)$/).optional().nullable(),
  customer: customerSchema, idempotencyKey: z.string().min(12).max(100).regex(/^[\w-]+$/),
}).strict();

export const productSchema = z.object({
  id: idSchema, name: text(150).min(2), category: z.enum(["Cakes", "Brownies", "Blondies"]),
  collection: text(80).min(2), description: text(1500).min(3),
  price: z.number().finite().min(1).max(100000).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7, "Use at most two decimal places"),
  image: z.string().max(500).refine((s) => /^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/.test(s), "Use a local bakery image"),
  featured: z.boolean(), available: z.boolean(),
}).strict();
export const settingsSchema = z.object({ banner: text(200), columns: z.number().int().min(2).max(4) }).strict();
export const adminSchema = z.object({
  products: z.array(productSchema).min(1).max(200).optional(),
  settings: settingsSchema.optional(), categories: z.array(text(80).min(2)).min(1).max(30).optional(),
}).strict().refine((v) => v.products || v.settings || v.categories, "No changes supplied")
  .refine((v) => !v.products || new Set(v.products.map((p) => p.id)).size === v.products.length, "Product IDs must be unique")
  .refine((v) => !v.categories || new Set(v.categories).size === v.categories.length, "Categories must be unique");
export const statusSchema = z.object({
  orderId: idSchema,
  status: z.enum(["confirmed", "baking", "out_for_delivery", "delivered", "cancelled", "quote_sent"]),
  quoteTotal: z.number().finite().min(1).max(1000000).optional(),
}).strict();

export function minDeliveryDate(now = new Date()): string {
  // Explicit formatToParts makes this independent of host locale data variations.
  const dateParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => dateParts.find((p) => p.type === type)?.value ?? "";
  const date = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 2);
  return date.toISOString().slice(0, 10);
}

export function validateDeliveryDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const max = new Date(now); max.setUTCFullYear(max.getUTCFullYear() + 1);
  return value >= minDeliveryDate(now) && value <= max.toISOString().slice(0, 10);
}

export type PricedItem = z.infer<typeof orderItemSchema> & { name: string; unitCents: number };
export function priceOrder(items: z.infer<typeof orderItemSchema>[], products: Product[], now = new Date()) {
  const priced: PricedItem[] = items.map((item) => {
    const product = products.find((p) => p.id === item.productId && p.available);
    if (!product) throw new Error("A selected product is unavailable");
    if (product.category !== "Cakes" && !item.eggless) throw new Error("Brownies and blondies are always eggless");
    const allowed = product.category === "Cakes" ? [0.5, 1, 1.5, 2, 3] : [4, 6, 9, 12];
    if (!allowed.includes(item.weight)) throw new Error("Choose a supported weight or box size");
    if (!validateDeliveryDate(item.deliveryDate, now)) throw new Error("Choose a delivery date at least two days from today, within the next year");
    const multiplier = product.category === "Cakes" ? item.weight / 0.5 : item.weight / 4;
    return { ...item, name: product.name, unitCents: Math.round(Math.round(product.price * 100) * multiplier) };
  });
  const subtotalCents = priced.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  if (subtotalCents > 100000000) throw new Error("Order value is too large; request a custom quote");
  const deliveryCents = subtotalCents >= 150000 ? 0 : 9900;
  return { items: priced, subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents };
}

export function plainText(value: string): string {
  // Stored rich text is never injected into HTML. Strip markup for durable plain-text rendering.
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim();
}

export function imageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function ownerMatches(user: { userId: string; email: string } | null, ownerEmail?: string, ownerUserId?: string): boolean {
  if (!user) return false;
  const emails = (ownerEmail ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const ids = (ownerUserId ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return emails.includes(user.email.toLowerCase()) || ids.includes(user.userId);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && !["cross-site", "none"].includes(request.headers.get("sec-fetch-site") ?? "");
}

export type OrderCursor = { createdAt: number; id: string };
export function encodeOrderCursor(cursor: OrderCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
export function decodeOrderCursor(value: string): OrderCursor | null {
  if (value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const data: unknown = JSON.parse(atob(value.replace(/-/g,"+").replace(/_/g,"/")));
    const result = z.object({ createdAt:z.number().int().nonnegative().max(8640000000000000),id:idSchema }).strict().safeParse(data);
    return result.success ? result.data : null;
  } catch { return null; }
}
