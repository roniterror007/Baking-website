/* eslint-disable @next/next/no-img-element -- Owner-selected local photos retain their original asset paths. */
import type { Product } from "@/lib/catalog";
import { resolveProductImage } from "@/lib/product-images";
import "./product-photo.css";

type Props = { product: Product; className?: string; variant?: "card" | "detail" };

/** Presents an unchanged four-photo atlas with a viewport over one quadrant. */
export function ProductPhoto({ product, className = "", variant = "card" }: Props) {
  const { src, tile } = resolveProductImage(product);
  return <div className={`gd-product-visual ${className}`} data-variant={variant} role="img" aria-label={product.name}>
    {tile === null ? <img className="gd-product-visual-full" src={src} alt="" aria-hidden="true" loading="lazy" decoding="async"/> :
      <svg className="gd-product-visual-atlas" viewBox="0 0 768 512" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <image href={src} x={-(tile % 2) * 768} y={-Math.floor(tile / 2) * 512} width="1536" height="1024"/>
      </svg>}
  </div>;
}
