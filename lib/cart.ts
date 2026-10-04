import type { Product } from "./catalog";

export type CartLine = { key: string; product: Product; quantity: number; weight: number; eggless: boolean; instructions: string; deliveryDate: string };
type PriceableLine = { product: Pick<Product, "category" | "price">; quantity: number; weight: number };

/** Every calculation stays in integer paise until the caller formats a value. */
export function unitPricePaise(product: Pick<Product, "category" | "price">, weight: number): number {
  const multiplier = weight / (product.category === "Cakes" ? 0.5 : 4);
  return Math.round(Math.round(product.price * 100) * multiplier);
}
export function cartTotals(lines: PriceableLine[]) {
  const subtotalPaise = lines.reduce((sum, line) => sum + unitPricePaise(line.product, line.weight) * line.quantity, 0);
  const deliveryPaise = !lines.length || subtotalPaise >= 150000 ? 0 : 9900;
  return { subtotalPaise, deliveryPaise, totalPaise: subtotalPaise + deliveryPaise };
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, min: number, max: number): value is string { return typeof value === "string" && value.length >= min && value.length <= max; }
function savedLine(value: unknown, now: Date): value is CartLine {
  if (!record(value) || !record(value.product)) return false;
  const product = value.product;
  if (!text(value.key, 1, 100) || !text(product.id, 1, 80) || !/^[a-zA-Z0-9_-]+$/.test(product.id)) return false;
  if (!text(product.name, 2, 150) || !text(product.collection, 2, 80) || !text(product.description, 3, 1500)) return false;
  if (typeof product.category !== "string" || !["Cakes", "Brownies", "Blondies"].includes(product.category)) return false;
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 1 || product.price > 100000) return false;
  if (Math.abs(product.price * 100 - Math.round(product.price * 100)) > 1e-7) return false;
  if (!text(product.image, 1, 500) || !/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/.test(product.image)) return false;
  if (typeof product.featured !== "boolean" || typeof product.available !== "boolean") return false;
  if (typeof value.quantity !== "number" || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 10) return false;
  if (typeof value.weight !== "number" || !(product.category === "Cakes" ? [0.5, 1, 1.5, 2, 3] : [4, 6, 9, 12]).includes(value.weight)) return false;
  if (typeof value.eggless !== "boolean" || !text(value.instructions, 0, 1500)) return false;
  if (!text(value.deliveryDate, 10, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(value.deliveryDate)) return false;
  const delivery = new Date(`${value.deliveryDate}T00:00:00Z`);
  const max = new Date(now); max.setUTCFullYear(max.getUTCFullYear() + 1);
  return Number.isFinite(delivery.getTime()) && delivery.toISOString().slice(0, 10) === value.deliveryDate && value.deliveryDate <= max.toISOString().slice(0, 10);
}
/** Old valid dates stay visible so a customer can remove/reconfigure expired items. */
export function parseSavedCart(value: unknown, now = new Date()): CartLine[] {
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>();
  return value.filter((line): line is CartLine => {
    if (!savedLine(line, now) || keys.has(line.key)) return false;
    keys.add(line.key); return true;
  }).slice(0, 20).map(line => ({ ...line, eggless: line.product.category === "Cakes" ? line.eggless : true }));
}
