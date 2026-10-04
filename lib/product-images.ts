import type { Product } from "./catalog";

export type ProductImage = { src: string; tile: number | null };

// Reading order is top-left, top-right, bottom-left, bottom-right.
const PRODUCT_IDS = [
  "vanilla-sponge", "chocolate-sponge", "mango-cake", "orange-nugget",
  "pineapple-cake", "new-york-cheesecake", "biscoff-cheesecake", "mango-cheesecake",
  "blueberry-cheesecake", "ferrero-cheesecake", "lemon-cheesecake", "tiramisu-cheesecake",
  "gulab-jamun-cheesecake", "rasmalai-fusion", "rose-nuts-blondies", "almond-rose-blondies",
  "mango-blondies", "pistachio-almond-blondies", "walnut-brownie", "red-velvet-brownie",
  "biscoff-brownie", "cream-cheese-brownie", "oreo-brownie", "monster-brownie",
  "sizzler-brownie", "coconut-brownie", "triple-chocolate-brownie", "healthy-brownie",
] as const;

const LEGACY_IMAGES = new Set([
  "/images/hero-cake.webp", "/images/bakery-selection.webp",
  "/images/strawberry-vanilla-hero.webp", "/images/bakery-collection.webp",
]);

/** Upgrade persisted default photos while respecting images chosen by the owner. */
export function resolveProductImage(product: Pick<Product, "id" | "image">): ProductImage {
  const index = PRODUCT_IDS.indexOf(product.id as (typeof PRODUCT_IDS)[number]);
  if (index !== -1 && (!product.image || LEGACY_IMAGES.has(product.image))) {
    return { src: `/images/catalog-${String(Math.floor(index / 4) + 1).padStart(2, "0")}.webp`, tile: index % 4 };
  }
  return { src: product.image || "/images/bakery-selection.webp", tile: null };
}
