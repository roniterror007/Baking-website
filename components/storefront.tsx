"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, Check, Heart, Leaf, MapPin, Moon, Search, SlidersHorizontal, Sun, UserRound, X } from "lucide-react";
import { CommercePanels, CommerceProvider, useCommerce } from "./commerce";
import { CakeJourney } from "./cake-journey";
import { ProductPhoto } from "./product-photo";
import { Brand } from "./brand";
import SiteHeader from "./site-header";
import { INITIAL_PRODUCTS, type Product } from "@/lib/catalog";

type Category = "All delights" | "Cakes" | "Brownies" | "Blondies";
type SiteSettings = { banner: string; columns: number };
const categories: Category[] = ["All delights", "Cakes", "Brownies", "Blondies"];
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
function themeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  try { return localStorage.getItem("golden-theme") === "light" ? "light" : "dark"; }
  catch { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
}
function subscribeTheme(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener("golden-theme-change", update);
  return () => { window.removeEventListener("storage", update); window.removeEventListener("golden-theme-change", update); };
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { openProduct } = useCommerce();
  return <button className="product-card" onClick={() => openProduct(product)} aria-label={`Customize ${product.name}, from ${money(product.price)}`}>
    <div className="product-image-wrap"><ProductPhoto product={product} className="product-photo" />{product.featured && <span className="product-tag">{index === 0 ? "THE SIGNATURE" : "BAKER’S PICK"}</span>}<span className="product-add"><ArrowUpRight size={20} /></span></div>
    <div className="product-meta"><span>{product.collection}</span><span>{product.category === "Cakes" ? "FROM 500 G" : "BOX OF 4"}</span></div>
    <h3>{product.name}</h3>
    <div className="product-bottom"><span>From <strong>{money(product.price)}</strong></span><span className="eggless-note"><Leaf size={12} /> {product.category === "Cakes" ? "Eggless available" : "Always eggless"}</span></div>
  </button>;
}

function CakeSketch() {
  return <div className="design-paper">
    <div className="paper-heading"><span>GOLDEN DELIGHTS / ATELIER</span><span>YOUR NEXT CELEBRATION</span></div>
    <svg viewBox="0 0 500 390" className="cake-sketch" role="img" aria-label="A three-tier celebration cake design sketch">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="240" cy="333" rx="163" ry="25" /><path d="M87 333v9c0 33 306 33 306 0v-9" />
        <path d="M112 241v69c0 39 256 39 256 0v-69" /><ellipse cx="240" cy="241" rx="128" ry="24" />
        <path d="M140 167v69c0 33 200 33 200 0v-69" /><ellipse cx="240" cy="167" rx="100" ry="20" />
        <path d="M173 98v65c0 24 134 24 134 0V98" /><ellipse cx="240" cy="98" rx="67" ry="16" />
        <path d="M112 249c12 18 23-6 35 12s25-4 38 11 24-7 36 10 25-10 39 0 24-15 38-9 24-16 38-11 22-19 32-13M140 177c12 17 24-3 35 10s25-3 38 8 25-6 38 0 26-12 39-8 34-15 50-10M173 108c13 17 27-1 40 8s24-1 37 0 24-13 37-8 12-10 20-6" />
        <path d="M224 80c-23-16-11-33 6-23 3-20 25-20 25 0 24-7 24 16-5 28M225 80c3-16 13-15 16 2M203 91c-21-12-30-5-18 6M270 94c22-21 38-14 24 1" />
        <path d="M147 288c13-17 30-11 22 8-2 14-23 16-22-8M172 303c20-10 30 0 16 15M303 298c18-16 30-9 18 8M320 319c19-10 33-4 19 6" />
        <path strokeDasharray="3 6" opacity=".5" d="M240 26v319M408 75v248M406 75h-78M406 323h-14M80 240H30M79 324H30" />
        <path d="m403 82 5-7 5 7m-10 233 5 8 5-8M369 191l45-31h28M293 56l55-23h34M82 271l-39-26H17" />
      </g>
      <g fontFamily="Georgia,serif" fontSize="12" fill="currentColor" opacity=".7"><text x="365" y="26">a little flourish</text><text x="386" y="150">your favourite flavour</text><text x="28" y="233">made with love</text></g>
    </svg>
    <div className="paper-foot"><span>01 / DREAM IT</span><span>02 / MAKE IT YOURS</span><span>03 / CELEBRATE</span></div>
    <span className="paper-signature">Made just for you.</span>
  </div>;
}

function Shop() {
  const commerce = useCommerce();
  const theme = useSyncExternalStore<"light" | "dark">(subscribeTheme, themeSnapshot, () => "dark");
  const [category, setCategory] = useState<Category>("All delights");
  const [collection, setCollection] = useState("All collections");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [expanded, setExpanded] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [settings, setSettings] = useState<SiteSettings>({ banner: "Handcrafted in Bangalore. Made for your sweetest moments.", columns: 4 });
  const [catalogError, setCatalogError] = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [loadVersion, setLoadVersion] = useState(0);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try { const res = await fetch("/api/catalog", { cache: "no-store" }); if (!res.ok) throw new Error("catalog"); const data = await res.json() as { products: Product[]; settings: SiteSettings; categories?: string[] }; if (!live) return; setProducts(data.products); setSettings(data.settings); setExtraCategories(data.categories || []); setCatalogError(false); }
      catch { if (live) setCatalogError(true); }
    };
    refresh(); const interval = setInterval(refresh, 30000); window.addEventListener("focus", refresh);
    return () => { live = false; clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [loadVersion]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } }), { threshold: .12 });
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (sideOpen) drawer.current?.showModal(); else drawer.current?.close();
    if (sideOpen) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [sideOpen]);
  const toggleTheme = () => { const next = theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = next; try { localStorage.setItem("golden-theme", next); } catch {} window.dispatchEvent(new Event("golden-theme-change")); };
  const chooseCategory = (next: Category) => { setCategory(next); setCollection("All collections"); setExpanded(true); setSideOpen(false); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); };
  const collections = Array.from(new Set([...products.map(p => p.collection), ...extraCategories]));
  const matches = useMemo(() => products.filter(p => p.available && (category === "All delights" || p.category === category) && (collection === "All collections" || p.collection === collection) && `${p.name} ${p.description} ${p.collection}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured)), [products, category, collection, query, sort]);
  const shown = expanded || category !== "All delights" || collection !== "All collections" || query ? matches : matches.slice(0, 4);

  return <><span id="top" aria-hidden="true" /><a className="skip-link" href="#main">Skip to content</a>
    {settings.banner && <div className="announcement"><span className="status-dot" /><span>{settings.banner}</span><span className="announcement-end">A LITTLE EVERYDAY EXTRAORDINARY</span></div>}
    <SiteHeader theme={theme} onToggleTheme={toggleTheme} onOpenMenu={() => setSideOpen(true)} />
    <main id="main">
      <CakeJourney theme={theme} />
      <div className="craft-ribbon"><div className="content-width"><span><span className="ribbon-star">✳</span> MADE BY HAND</span><span><span className="ribbon-star">✳</span> BAKED TO ORDER</span><span><span className="ribbon-star">✳</span> EGGLESS OPTIONS</span><span><span className="ribbon-star">✳</span> BANGALORE DELIVERY</span></div></div>
      <section id="menu" className="menu-section content-width" aria-labelledby="menu-title">
        <div className="section-heading reveal"><div><span className="eyebrow">01 / THE COLLECTION</span><h2 id="menu-title">A taste of <em>delight.</em></h2></div><p>From the classics you love<br />to the flavours you’ll fall for.</p></div>
        <div className="menu-toolbar"><div className="category-tabs" role="group" aria-label="Filter by treat">{categories.map(c => <button key={c} className={category === c ? "selected" : ""} aria-pressed={category === c} onClick={() => { setCategory(c); setCollection("All collections"); setExpanded(c !== "All delights"); }}>{c}<span>{products.filter(p => p.available && (c === "All delights" || p.category === c)).length}</span></button>)}</div><div className="search-and-filter"><label className="menu-search"><Search size={16} /><input aria-label="Search the menu" placeholder="Find your favourite" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="icon-button filter-button" onClick={() => setSideOpen(true)} aria-label="More menu filters"><SlidersHorizontal size={17} /></button></div></div>
        {(expanded || category !== "All delights" || query || collection !== "All collections") && <div className="collection-filters"><label>Collection<select value={collection} onChange={e => setCollection(e.target.value)}><option>All collections</option>{collections.map(c => <option key={c}>{c}</option>)}</select></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Baker’s picks</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label><span>{matches.length} made-to-order delights</span></div>}
        {catalogError && <div className="catalog-alert" role="status">The live menu is temporarily unavailable. Prices are checked again at checkout. <button onClick={() => setLoadVersion(n => n + 1)}>Try again</button></div>}
        <div className="product-grid" style={{ "--menu-columns": settings.columns || 4 } as React.CSSProperties}>{shown.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
        {shown.length === 0 && <div className="empty-menu"><Search size={27} /><h3>A new craving awaits.</h3><p>Try another flavour or explore the whole collection.</p><button className="button-primary" onClick={() => { setQuery(""); setCategory("All delights"); setCollection("All collections"); }}>See all delights</button></div>}
        <div className="menu-bottom"><span><Leaf size={13} /> Your flavour. Your size. Your finishing touches.</span>{!expanded && !query && category === "All delights" && <button className="button-outline" onClick={() => setExpanded(true)}>View the full collection <ArrowUpRight size={17} /></button>}{expanded && !query && category === "All delights" && collection === "All collections" && <button className="button-text" onClick={() => { setExpanded(false); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }}>Back to baker’s picks <ArrowUpRight size={16} /></button>}</div>
      </section>
      <section className="bespoke-section" aria-labelledby="custom-title"><div className="bespoke-inner content-width">
        <div className="bespoke-copy reveal"><span className="eyebrow">02 / THE BESPOKE EXPERIENCE</span><h2 id="custom-title">Your imagination.<br /><em>Our next creation.</em></h2><p>That saved picture. A favourite colour. A wonderfully wild idea. Bring us your inspiration, and let’s create a cake that could only be yours.</p><button className="button-primary" onClick={commerce.openCustom}>Let’s create something <ArrowUpRight size={18} /></button><div className="bespoke-features"><span><Check size={13} /> Share a reference</span><span><Check size={13} /> Choose your weight</span><span><Check size={13} /> Make every detail yours</span></div></div>
        <div className="sketch-wrap reveal"><CakeSketch /><span className="sketch-label">EVERY GREAT CAKE BEGINS WITH AN IDEA.</span></div>
      </div></section>
      <section id="story" className="story-section content-width" aria-labelledby="story-title">
        {/* eslint-disable-next-line @next/next/no-img-element -- This real film frame is already optimized as a 60 KB WebP. */}
        <div className="story-image reveal"><img src="/images/baker-craft.webp" alt="A baker carefully piping the finishing details onto a handcrafted cake" loading="lazy" /><div className="story-image-caption"><span>THE HUMAN TOUCH</span><span>Made with care, every day.</span></div><span className="story-seal"><Sun strokeWidth={.7} /><span>CRAFTED<br />FROM THE HEART</span></span></div>
        <div className="story-copy reveal"><span className="eyebrow">03 / BEHIND THE APRON</span><h2 id="story-title">A passion for cakes.<br /><em>A love for smiles.</em></h2><p className="story-lead">The best part of baking isn’t the first perfect swirl. It’s the smile that comes after the first bite.</p><p>Golden Delights began with a love for building beautiful cakes, layer by layer, by hand. There’s a special joy in knowing something made in our kitchen will become part of your happiest memory.</p><p>My dream is simple: to put a smile on thousands of faces. So every sponge, every flavour and every little flourish gets a little piece of my heart.</p><span className="baker-signature"><span>With love,</span><em>Your baker</em><Heart size={18} strokeWidth={1} /></span></div>
      </section>
      <section className="last-invite"><div className="content-width"><span className="eyebrow">FOR BIG DAYS. SMALL WINS. AND JUST BECAUSE.</span><h2>Make room for<br /><em>something wonderful.</em></h2><a className="button-primary" href="#menu">Find your next delight <ArrowUpRight size={18} /></a><span className="invite-star" aria-hidden="true">✳</span></div></section>
    </main>
    <footer className="site-footer content-width"><div className="footer-top"><div><Brand footer /><p>A little everyday extraordinary.<br />Handcrafted in Bangalore.</p></div><div className="footer-links"><span>THE COLLECTION</span><button onClick={() => chooseCategory("Cakes")}>Cakes & cheesecakes</button><button onClick={() => chooseCategory("Brownies")}>Brownies</button><button onClick={() => chooseCategory("Blondies")}>Blondies</button></div><div className="footer-links"><span>YOUR GOLDEN MOMENTS</span><button onClick={commerce.openCustom}>Bespoke cakes</button><button onClick={commerce.openAccount}>Your account & orders</button><a href="#story">Meet the baker</a></div><div className="footer-city"><MapPin size={20} strokeWidth={1.2} /><span>BAKED IN BANGALORE</span><p>From our kitchen.<br />To your celebration.</p></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Golden Delights.</span><span>Imagery is flavour inspiration. Every order is made for you.</span><button className="footer-theme" onClick={toggleTheme}>{theme === "light" ? <Moon size={13} /> : <Sun size={13} />}{theme === "light" ? "Dark mode" : "Light mode"}</button></div></footer>
    <p className="gd-render-credit content-width">Cake animation adapted from <a href="https://sketchfab.com/3d-models/wedding-cake-69be5c0c0d404113a227d9ba19d78447" target="_blank" rel="noopener noreferrer">Wedding Cake</a> by <a href="https://sketchfab.com/Mekokishvili" target="_blank" rel="noopener noreferrer">Mekokishvili</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Colours, styling and motion adapted for Golden Delights.</p>
    <dialog ref={drawer} className="navigation-drawer" onCancel={() => setSideOpen(false)} onClick={e => { if (e.target === e.currentTarget) setSideOpen(false); }} aria-labelledby="drawer-title">
      <div className="drawer-heading"><Brand /><button className="icon-button" onClick={() => setSideOpen(false)} aria-label="Close menu"><X size={21} /></button></div><h2 id="drawer-title">Find your<br /><em>delight.</em></h2><nav aria-label="Full menu">{categories.map(c => <button className={category === c ? "active" : ""} onClick={() => chooseCategory(c)} key={c}>{c}<ArrowUpRight size={17} /></button>)}</nav>
      <div className="drawer-filters"><span className="eyebrow">REFINE YOUR CRAVING</span><label>Collection<select value={collection} onChange={e => { setCollection(e.target.value); setExpanded(true); }}><option>All collections</option>{collections.map(c => <option key={c}>{c}</option>)}</select></label><label>Sort the menu<select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Baker’s picks</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label><button className="button-outline" onClick={() => { setSideOpen(false); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }}>Explore collection <ArrowRight size={16} /></button></div>
      <div className="drawer-account"><button onClick={() => { setSideOpen(false); commerce.openAccount(); }}><UserRound size={16} /> Your account & orders <ArrowUpRight size={15} /></button><button onClick={() => { setSideOpen(false); commerce.openCustom(); }}>Design your own cake <ArrowUpRight size={15} /></button></div><span className="drawer-location"><MapPin size={14} /> Handcrafted in Bangalore</span>
    </dialog>
    <CommercePanels />
  </>;
}

export default function Storefront() { return <CommerceProvider><Shop /></CommerceProvider>; }
