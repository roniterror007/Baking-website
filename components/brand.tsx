import Link from "next/link";
import "./site-header.css";

/** A drawn, interlaced GD signature framed like a foil-stamped maker's mark. */
function MakerMark() {
  return <svg className="gd-identity-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <g className="gd-identity-frame" stroke="currentColor" strokeWidth=".6">
      <path d="M6 21V8h14M44 8h14v13M58 43v13H44M20 56H6V43"/>
      <path d="M23 8h18M23 56h18" opacity=".38"/>
    </g>
    <g stroke="currentColor" strokeLinecap="square" strokeLinejoin="round">
      <path d="M32 17c-3.7-4-9.3-5.8-14.7-2.5C10.5 18.7 8.3 27.2 10.5 35c2.2 7.8 7.7 12.3 14.4 12.3 5.3 0 9.1-1.9 12.3-5.9" strokeWidth="1.7"/>
      <path d="M25.8 31.4h13.7v12M35 43.4h8" strokeWidth="1.4"/>
      <path d="M29.3 13.8h6.2c11.4 0 18.2 6.2 18.2 17.1 0 11.4-6.8 18.1-18.2 18.1h-6.2V13.8Z" strokeWidth="1.45"/>
      <path d="M25 13.8h11.5M25 49h11.5" strokeWidth="1.1"/>
      <path d="M34.2 18.3h2.1c8 0 12.9 4.7 12.9 12.8 0 8.5-4.9 13.2-12.9 13.2h-2.1" strokeWidth=".55" opacity=".72"/>
    </g>
  </svg>;
}

export function Brand({ footer = false }: { footer?: boolean }) {
  return <Link href="/#top" className={`gd-identity ${footer ? "gd-identity-footer" : ""}`} aria-label="Golden Delights, artisan bakery in Bangalore — home">
    <MakerMark/>
    <span className="gd-identity-type" aria-hidden="true"><span className="gd-identity-golden">Golden</span><span className="gd-identity-delights">Delights</span><span className="gd-identity-caption">ARTISAN CAKE ATELIER</span></span>
  </Link>;
}
