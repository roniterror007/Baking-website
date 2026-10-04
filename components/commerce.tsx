"use client";
/* eslint-disable react-hooks/set-state-in-effect -- These effects hydrate browser storage and saved server profiles after the initial render. */
/* eslint-disable @next/next/no-img-element -- Bakery assets are pre-optimized WebP files served directly by the edge runtime. */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bold, CalendarDays, Check, CheckCircle2, ChevronRight, CreditCard, Heart, Italic, List, LoaderCircle, Minus, Plus, ShoppingBag, Trash2, Upload, UserRound, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { cartTotals, parseSavedCart, unitPricePaise, type CartLine } from "@/lib/cart";
import Link from "next/link";
import { ProductPhoto } from "./product-photo";
import "./commerce.css";

type Panel = "cart" | "checkout" | "custom" | "account" | "product" | null;
type Customer = { fullName: string; phone: string; address: string; billingAddress: string };
type AccountOrder = { kind?: string; custom?: { weight: number; deliveryDate: string }; id: string; status: string; total: number; createdAt?: string; deliveryDate?: string; items?: { name?: string; productName?: string; quantity: number }[] };
type Account = { user: null | { userId: string; displayName?: string; email?: string }; profile?: Partial<Customer>; orders?: AccountOrder[]; isAdmin?: boolean; nextCursor?: string | null };
type CommerceContextValue = { openProduct: (product: Product) => void; openCart: () => void; openCustom: () => void; openAccount: () => void; cartCount: number; panel: Panel; product: Product | null; cart: CartLine[]; close: () => void; setPanel: (panel: Panel) => void; addLine: (line: CartLine) => Promise<void>; changeQuantity: (key: string, change: number) => void; removeLine: (key: string) => void; clearCart: () => void; refreshPrices: () => Promise<void> };
const CommerceContext = createContext<CommerceContextValue | null>(null);
const CART_KEY = "golden-delights-cart-v1";
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const linePrice = (line: CartLine) => unitPricePaise(line.product, line.weight) / 100;
const lineTotal = (line: CartLine) => unitPricePaise(line.product, line.weight) * line.quantity / 100;
const totalPrice = (cart: CartLine[]) => cartTotals(cart).subtotalPaise / 100;
const deliveryFee = (cart: CartLine[]) => cartTotals(cart).deliveryPaise / 100;
const grandTotal = (cart: CartLine[]) => cartTotals(cart).totalPaise / 100;
const loginHref = "/sign-in?return_to=/";
function deliveryMinimum() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (name: string) => parts.find(part => part.type === name)?.value || "";
  const date = new Date(`${value("year")}-${value("month")}-${value("day")}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 2);
  return date.toISOString().slice(0, 10);
}
function deliveryMaximum() { const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() + 1); return date.toISOString().slice(0, 10); }
function validDeliveryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= deliveryMinimum() && value <= deliveryMaximum();
}
function submittedDeliveryDate(form: HTMLFormElement) {
  const value = new FormData(form).get("deliveryDate");
  return typeof value === "string" ? value : "";
}
function dateLabel(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(typeof result.message === "string" ? result.message : "Something went wrong. Please try again."), { status: response.status });
  return result as T;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
function isStatus(error: unknown, status: number) { return typeof error === "object" && error !== null && "status" in error && error.status === status; }

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setCart(parseSavedCart(saved));
    } catch { try { localStorage.removeItem(CART_KEY); } catch { /* A disabled storage API does not prevent ordering. */ } }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* The current bag remains available in memory. */ } } }, [cart, loaded]);
  const openProduct = useCallback((value: Product) => { setProduct(value); setPanel("product"); }, []);
  const close = useCallback(() => setPanel(null), []);
  const refreshPrices = useCallback(async () => {
    const result = await request<{ products: Product[] }>("/api/catalog");
    setCart(current => current.map(line => ({ ...line, product: result.products.find(item => item.id === line.product.id) || { ...line.product, available: false } })));
  }, []);
  const value: CommerceContextValue = {
    openProduct, openCart: () => setPanel("cart"), openCustom: () => setPanel("custom"), openAccount: () => setPanel("account"),
    cartCount: cart.reduce((sum, line) => sum + line.quantity, 0), panel, product, cart, close, setPanel,
    addLine: async line => {
      const result = await request<Account>("/api/account");
      if (!result.user) throw new Error("Create an account or sign in before adding items to your bag.");
      setCart(current => [...current, { ...line, eggless: line.product.category === "Cakes" ? line.eggless : true }]); setPanel("cart");
    },
    changeQuantity: (key, change) => setCart(current => current.map(line => line.key === key ? { ...line, quantity: Math.min(10, Math.max(1, line.quantity + change)) } : line)),
    removeLine: key => setCart(current => current.filter(line => line.key !== key)), clearCart: () => setCart([]), refreshPrices,
  };
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}
export function useCommerce() { const context = useContext(CommerceContext); if (!context) throw new Error("useCommerce requires CommerceProvider"); return context; }

function Dialog({ children, title, wide = false }: { children: ReactNode; title: string; wide?: boolean }) {
  const { close } = useCommerce();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex="0"]') || []).filter(item => item.getClientRects().length > 0);
    (focusables()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const items = focusables();
        const first = items[0]; const last = items[items.length - 1];
        if (!first) { event.preventDefault(); ref.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [close]);
  return <div className="gd-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className={`gd-dialog ${wide ? "gd-dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><button className="gd-close gd-icon-button" onClick={close} aria-label="Close dialog"><X size={21}/></button>{children}</div></div>;
}
function ErrorNote({ message }: { message: string }) { return message ? <p className="gd-error" role="alert">{message}</p> : null; }
function SignInNotice() { return <div className="gd-signin-notice"><UserRound size={19}/><span>Create an account or sign in before adding items or ordering.</span><a href={loginHref} target="_top">Sign in / Register <ArrowRight size={14}/></a></div>; }
function savedCustomer(current: Customer, account: Account): Customer {
  return { fullName: account.profile?.fullName || account.user?.displayName || current.fullName, phone: account.profile?.phone || current.phone, address: account.profile?.address || current.address, billingAddress: account.profile?.billingAddress || current.billingAddress };
}
function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reload = useCallback(async () => { try { const result = await request<Account>("/api/account"); setAccount(result); setHasMore(Boolean(result.nextCursor)); setError(""); } catch (error) { setError(errorText(error)); } }, []);
  const loadMore = async () => {
    const cursor = account?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await request<{ orders: AccountOrder[]; nextCursor: string | null }>(`/api/orders?cursor=${encodeURIComponent(cursor)}`);
      setAccount(current => current ? { ...current, nextCursor: result.nextCursor, orders: [...(current.orders || []), ...result.orders.filter(order => !current.orders?.some(item => item.id === order.id))] } : current);
      setHasMore(Boolean(result.nextCursor));
    } catch (error) { setError(errorText(error)); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => { void reload(); }, [reload]);
  return { account, error, reload, hasMore, loadingMore, loadMore };
}
function Dietary({ eggless, setEggless }: { eggless: boolean; setEggless: (value: boolean) => void }) {
  return <fieldset className="gd-field"><legend>Made your way</legend><div className="gd-segmented"><button type="button" aria-pressed={eggless} onClick={() => setEggless(true)}><span className="gd-veg-dot"/>Eggless</button><button type="button" aria-pressed={!eggless} onClick={() => setEggless(false)}>With egg</button></div></fieldset>;
}
function DeliveryField({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="gd-field"><span><CalendarDays size={15}/> Delivery date</span><input type="date" name="deliveryDate" value={value} onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.currentTarget.value)} min={deliveryMinimum()} max={deliveryMaximum()} required/><small>Freshly made to order. Please allow 2 days.</small></label>; }

function ProductPanel({ product }: { product: Product }) {
  const { addLine, cart } = useCommerce();
  const { account } = useAccount();
  const [adding, setAdding] = useState(false);
  const [eggless, setEggless] = useState(true);
  const [weight, setWeight] = useState(product.category === "Cakes" ? 0.5 : 4);
  const [instructions, setInstructions] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const cake = product.category === "Cakes";
  const sizes = cake ? [0.5, 1, 1.5, 2, 3] : [4, 6, 9, 12];
  const amount = unitPricePaise(product, weight) / 100;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const selectedDate = submittedDeliveryDate(event.currentTarget);
    if (!validDeliveryDate(selectedDate)) { setError("Choose a valid delivery date, at least two days from today and within the next year."); return; }
    setDate(selectedDate);
    setAdding(true);
    try { await addLine({ key: crypto.randomUUID(), product, weight, eggless: cake ? eggless : true, instructions: instructions.trim(), deliveryDate: selectedDate, quantity: 1 }); }
    catch (failure) { setError(errorText(failure)); } finally { setAdding(false); }
  };
  return <Dialog title={product.name} wide><div className="gd-product-panel"><div className="gd-product-photo"><ProductPhoto product={product} className="gd-detail-image" variant="detail"/><span className="gd-photo-note">Made with love. Baked for you.</span></div><form className="gd-product-content" onSubmit={submit}><p className="gd-eyebrow">{product.collection}</p><h2>{product.name}</h2><p className="gd-description">{product.description}</p><p className="gd-product-price">{product.price > 0 ? money(amount) : "Pricing coming soon"}<span>{cake ? `${weight} kg` : `Box of ${weight}`}</span></p>{cake ? <Dietary eggless={eggless} setEggless={setEggless}/> : <p className="gd-micro"><span className="gd-veg-dot"/>Always eggless  -  Made with care</p>}{!account?.user && <SignInNotice/>}<fieldset className="gd-field"><legend>{cake ? "Choose your weight" : "Choose your box"}</legend><div className="gd-sizes">{sizes.map(size => <button type="button" key={size} aria-pressed={weight === size} onClick={() => setWeight(size)}>{cake ? `${size} kg` : `${size} pieces`}</button>)}</div></fieldset><DeliveryField value={date} onChange={setDate}/><label className="gd-field"><span>A little personal touch <span className="gd-optional">Optional</span></span><textarea maxLength={1000} rows={3} placeholder="A message on the cake, favourite colours, or allergy information…" value={instructions} onChange={event => setInstructions(event.target.value)}/></label><ErrorNote message={error}/><button className="gd-button gd-button-primary" type="submit" disabled={adding || !account?.user || !product.available || product.price <= 0 || cart.length >= 20}><ShoppingBag size={18}/>{adding ? "Adding - " : !account?.user ? "Sign in to add to bag" : cart.length >= 20 ? "Bag limit reached · 20 items" : !product.available ? "Currently unavailable" : product.price <= 0 ? "Awaiting owner pricing" : `Add to bag · ${money(amount)}`}</button><p className="gd-micro">Handcrafted in Bangalore · Every order baked fresh</p></form></div></Dialog>;
}
function CartPanel() {
  const { cart, changeQuantity, removeLine, setPanel, close } = useCommerce();
  const invalid = cart.some(line => !line.product.available || line.deliveryDate < deliveryMinimum());
  return <Dialog title="Your bag"><div className="gd-panel-padding"><p className="gd-eyebrow">Something sweet awaits</p><h2>Your bag <span className="gd-title-count">{cart.length}</span></h2>{!cart.length ? <div className="gd-empty"><ShoppingBag size={44} strokeWidth={1}/><h3>A little room for joy.</h3><p>Your next favourite treat is waiting in our collection.</p><button className="gd-button gd-button-primary" onClick={close}>Explore the collection <ArrowRight size={16}/></button></div> : <><div className="gd-cart-lines">{cart.map(line => <article className="gd-cart-line" key={line.key}><ProductPhoto product={line.product} className="gd-cart-photo"/><div className="gd-cart-line-content"><h3>{line.product.name}</h3><p>{line.product.category === "Cakes" ? `${line.weight} kg` : `Box of ${line.weight}`} · {line.eggless ? "Eggless" : "With egg"}</p><p>{dateLabel(line.deliveryDate)}</p>{line.instructions && <p className="gd-line-instructions">{line.instructions}</p>}{!line.product.available && <p className="gd-inline-error">This item is currently unavailable.</p>}{line.deliveryDate < deliveryMinimum() && <p className="gd-inline-error">Choose this item again with a later delivery date.</p>}<div className="gd-line-bottom"><div className="gd-quantity"><button aria-label={`Decrease ${line.product.name} quantity`} onClick={() => changeQuantity(line.key, -1)} disabled={line.quantity === 1}><Minus size={13}/></button><span>{line.quantity}</span><button aria-label={`Increase ${line.product.name} quantity`} onClick={() => changeQuantity(line.key, 1)} disabled={line.quantity >= 10}><Plus size={13}/></button></div><strong>{money(lineTotal(line))}</strong><button className="gd-icon-button" aria-label={`Remove ${line.product.name}`} onClick={() => removeLine(line.key)}><Trash2 size={16}/></button></div></div></article>)}</div><div className="gd-fee"><span>Subtotal</span><span>{money(totalPrice(cart))}</span></div><div className="gd-fee"><span>Bangalore delivery</span><span>{deliveryFee(cart) ? money(deliveryFee(cart)) : "On us"}</span></div><div className="gd-total"><span>Total</span><strong>{money(grandTotal(cart))}</strong></div><p className="gd-micro">Free delivery on orders of ₹1,500 or more. The bakery confirms delivery details after ordering.</p>{invalid && <ErrorNote message="Please remove unavailable items or items with expired delivery dates before checkout."/>}<button className="gd-button gd-button-primary" disabled={invalid} onClick={() => setPanel("checkout")}>Continue to checkout <ArrowRight size={18}/></button><button className="gd-button gd-button-text" onClick={close}>Keep exploring</button></>}</div></Dialog>;
}
function CustomerFields({ customer, setCustomer, billing = false }: { customer: Customer; setCustomer: (value: Customer) => void; billing?: boolean }) {
  const change = (key: keyof Customer, value: string) => setCustomer({ ...customer, [key]: value });
  return <><div className="gd-fields-two"><label className="gd-field"><span>Full name</span><input autoComplete="name" value={customer.fullName} maxLength={100} onChange={event => change("fullName", event.target.value)} required placeholder="Your full name"/></label><label className="gd-field"><span>Phone number</span><input type="tel" autoComplete="tel" inputMode="tel" pattern="[+]?[0-9 ()-]{10,18}" title="Enter a valid phone number with 10 to 15 digits" value={customer.phone} maxLength={18} onChange={event => change("phone", event.target.value)} required placeholder="+91 98765 43210"/></label></div><label className="gd-field"><span>Delivery address</span><textarea autoComplete="street-address" value={customer.address} minLength={10} maxLength={1000} rows={3} onChange={event => change("address", event.target.value)} required placeholder="House / flat, building, street, area, Bangalore and PIN code"/></label>{billing && <label className="gd-field"><span>Billing address <span className="gd-optional">Optional</span></span><textarea value={customer.billingAddress} maxLength={1000} rows={2} onChange={event => change("billingAddress", event.target.value)} placeholder="Leave blank to use your delivery address"/></label>}</>;
}
function CheckoutPanel() {
  const { cart, clearCart, setPanel, refreshPrices } = useCommerce();
  const { account, error: accountError } = useAccount();
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<Customer>({ fullName: "", phone: "", address: "", billingAddress: "" });
  const [saveDetails, setSaveDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<{ id: string } | null>(null);
  const key = useRef("");
  useEffect(() => { if (account?.profile) setCustomer(current => savedCustomer(current, account)); }, [account]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (step < 2) { setStep(step + 1); return; }
    if (!account?.user) { setError("Please sign in to place your order."); return; }
    if (cart.some(line => !line.product.available || line.deliveryDate < deliveryMinimum())) { setError("An item is unavailable or its delivery date has passed. Return to your bag and update it."); return; }
    setBusy(true);
    try {
      if (!key.current) key.current = crypto.randomUUID();
      const result = await request<{ order?: { id: string }; id?: string }>("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map(line => ({ productId: line.product.id, quantity: line.quantity, weight: line.weight, eggless: line.eggless, instructions: line.instructions, deliveryDate: line.deliveryDate, expectedPrice: linePrice(line) })), customer: { ...customer, billingAddress: customer.billingAddress || customer.address }, paymentMethod: "cod", expectedTotal: grandTotal(cart), idempotencyKey: key.current }) });
      setOrder({ id: result.order?.id || result.id || "Your order" }); clearCart();
      if (saveDetails) void request("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customer) }).catch(() => undefined);
    } catch (error) {
      if (isStatus(error, 409)) { try { await refreshPrices(); key.current = ""; setError("The bakery updated its menu or prices. Your bag now reflects the latest prices. Review the new total before placing your order again."); } catch { setError("Prices have changed. Please close checkout, refresh the site and review your bag."); } }
      else setError(errorText(error));
    } finally { setBusy(false); }
  };
  return <Dialog title="Checkout"><div className="gd-panel-padding">{order ? <div className="gd-success"><CheckCircle2 size={58} strokeWidth={1.3}/><p className="gd-eyebrow">A little joy is on its way</p><h2>Your order is in.</h2><p>The bakery will confirm your order and delivery details. Payment is due on delivery.</p><div className="gd-order-code">Order reference <strong>{order.id}</strong></div><button className="gd-button gd-button-primary" onClick={() => setPanel("account")}>Track your order <ArrowRight size={16}/></button></div> : <><button className="gd-back" onClick={() => step ? setStep(step - 1) : setPanel("cart")}><ArrowLeft size={16}/>{step ? "Previous step" : "Your bag"}</button><p className="gd-eyebrow">Made personal, from here on</p><h2>A sweeter checkout.</h2><ol className="gd-steps">{["Your details", "Delivery & billing", "Review"].map((name, index) => <li key={name} className={index === step ? "active" : index < step ? "complete" : ""}><span>{index < step ? <Check size={13}/> : index + 1}</span>{name}</li>)}</ol>{!account?.user && <SignInNotice/>}<ErrorNote message={error || accountError}/><form onSubmit={submit}>{step === 0 && <><h3>Where should we send the joy?</h3><CustomerFields customer={customer} setCustomer={setCustomer}/><label className="gd-checkbox"><input type="checkbox" checked={saveDetails} onChange={event => setSaveDetails(event.target.checked)}/>Save these details to my account</label></>}{step === 1 && <><h3>Everything, just right.</h3><div className="gd-summary-card"><CalendarDays size={20}/><div><strong>Fresh delivery in Bangalore</strong><p>{Array.from(new Set(cart.map(line => line.deliveryDate))).map(dateLabel).join(" · ")}</p><small>Your chosen date is sent to the bakery for confirmation.</small></div></div><label className="gd-field"><span>Billing address <span className="gd-optional">Optional</span></span><textarea rows={3} maxLength={1000} placeholder="Leave blank to use your delivery address" value={customer.billingAddress} onChange={event => setCustomer({ ...customer, billingAddress: event.target.value })}/></label><div className="gd-summary-card"><CreditCard size={20}/><div><strong>Pay on delivery</strong><p>Pay the bakery when your order arrives.</p><small>No online payment is collected on this website.</small></div><Check size={17}/></div></>}{step === 2 && <><h3>One last look.</h3><div className="gd-review-lines">{cart.map(line => <div key={line.key}><span>{line.quantity} × {line.product.name}<small>{line.product.category === "Cakes" ? `${line.weight} kg` : `${line.weight} pieces`} · {line.eggless ? "Eggless" : "With egg"} · {dateLabel(line.deliveryDate)}</small></span><strong>{money(lineTotal(line))}</strong></div>)}</div><div className="gd-review-address"><strong>{customer.fullName}</strong><p>{customer.phone}</p><p>{customer.address}</p>{customer.billingAddress && <p>Billing: {customer.billingAddress}</p>}</div><div className="gd-fee"><span>Bangalore delivery</span><span>{deliveryFee(cart) ? money(deliveryFee(cart)) : "On us"}</span></div><div className="gd-total"><span>Total · Pay on delivery</span><strong>{money(grandTotal(cart))}</strong></div><p className="gd-micro">By placing your order, you agree to be contacted by Golden Delights to confirm preparation and delivery.</p></>}<button type="submit" className="gd-button gd-button-primary" disabled={busy || (step === 2 && (!account?.user || !cart.length))}>{busy ? <LoaderCircle className="gd-spin" size={18}/> : null}{step === 2 ? busy ? "Placing your order…" : `Place order · ${money(grandTotal(cart))}` : "Continue"}{!busy && <ArrowRight size={17}/>}</button></form></>}</div></Dialog>;
}

function RichField({ label, placeholder, onChange }: { label: string; placeholder: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const format = (command: string) => { editor.current?.focus(); document.execCommand(command, false); onChange(editor.current?.innerText || ""); };
  return <div className="gd-field"><label>{label}</label><div className="gd-rich-editor"><div className="gd-rich-toolbar" aria-label={`${label} formatting`}><button type="button" aria-label="Bold" onMouseDown={event => event.preventDefault()} onClick={() => format("bold")}><Bold size={15}/></button><button type="button" aria-label="Italic" onMouseDown={event => event.preventDefault()} onClick={() => format("italic")}><Italic size={15}/></button><button type="button" aria-label="Bullet list" onMouseDown={event => event.preventDefault()} onClick={() => format("insertUnorderedList")}><List size={15}/></button><small>Make it yours</small></div><div contentEditable role="textbox" aria-label={label} aria-multiline="true" data-placeholder={placeholder} ref={editor} onInput={() => onChange(editor.current?.innerText.slice(0, 3000) || "")} onPaste={event => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain").slice(0, 3000)); }} suppressContentEditableWarning/></div></div>;
}
function CustomPanel() {
  const { setPanel } = useCommerce();
  const { account, error: accountError } = useAccount();
  const [inspiration, setInspiration] = useState("");
  const [instructions, setInstructions] = useState("");
  const [weight, setWeight] = useState(1);
  const [eggless, setEggless] = useState(true);
  const [date, setDate] = useState("");
  const [customer, setCustomer] = useState<Customer>({ fullName: "", phone: "", address: "", billingAddress: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const requestKey = useRef("");
  useEffect(() => { if (account?.profile) setCustomer(current => savedCustomer(current, account)); }, [account]);
  useEffect(() => { if (!file) { setPreview(""); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const chooseFile = (value: File | undefined) => { setError(""); if (!value) return; if (!["image/jpeg", "image/png", "image/webp"].includes(value.type)) { setError("Choose a PNG, JPG or WebP reference image."); return; } if (value.size > 4 * 1024 * 1024) { setError("Your reference image needs to be smaller than 4 MB."); return; } setFile(value); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const selectedDate = submittedDeliveryDate(event.currentTarget);
    if (!validDeliveryDate(selectedDate)) { setError("Choose a valid delivery date, at least two days from today and within the next year."); return; }
    setDate(selectedDate);
    if (!account?.user) { setError("Please sign in to send a custom cake request."); return; }
    if (inspiration.trim().length < 10 || instructions.trim().length < 5) { setError("Tell us a little more about your inspiration and baking instructions."); return; }
    setBusy(true);
    try {
      let referenceKey: string | undefined;
      if (file) { const form = new FormData(); form.append("file", file); const upload = await request<{ key?: string; referenceKey?: string }>("/api/uploads", { method: "POST", body: form }); referenceKey = upload.referenceKey || upload.key; }
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const result = await request<{ order: { id: string } }> ("/api/custom-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inspiration: inspiration.trim(), bakingInstructions: instructions.trim(), weight, eggless, deliveryDate: selectedDate, referenceKey, customer, idempotencyKey: requestKey.current }) });
      setSuccess(result.order.id);
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  };
  return <Dialog title="Design your cake"><div className="gd-panel-padding">{success ? <div className="gd-success"><Heart size={54} strokeWidth={1.2}/><p className="gd-eyebrow">Your imagination, our craft</p><h2>Let’s make it yours.</h2><p>Your custom cake request has reached the bakery. We’ll contact you to discuss the design, price and delivery before you commit.</p><div className="gd-order-code">Request reference <strong>{success}</strong></div><button className="gd-button gd-button-primary" onClick={() => setPanel("account")}>Back to my account <ArrowRight size={16}/></button></div> : <><p className="gd-eyebrow">Dream it. We’ll bake it.</p><h2>A cake as unique as you.</h2><p className="gd-description">Tell us what you have in mind. We’ll turn your occasion into something deliciously personal.</p>{!account?.user && <SignInNotice/>}<form onSubmit={submit}><label className={`gd-upload ${preview ? "has-image" : ""}`}>{preview ? <img src={preview} alt="Your cake inspiration reference"/> : <Upload size={27} strokeWidth={1.3}/>}<span><strong>{file ? file.name : "Share your inspiration"}</strong><small>{file ? "Click to choose a different image" : "Upload a reference image · JPG, PNG, WebP · Up to 4 MB"}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => chooseFile(event.target.files?.[0])}/></label><RichField label="Your inspiration" placeholder="A garden party, a favourite character, a beautiful colour palette…" onChange={setInspiration}/><RichField label="Instructions on how to bake" placeholder="Flavours, filling, frosting, decorations, message, dietary needs…" onChange={setInstructions}/><div className="gd-fields-two"><label className="gd-field"><span>Exact weight</span><select value={weight} onChange={event => setWeight(Number(event.target.value))}>{[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(value => <option key={value} value={value}>{value} kg</option>)}</select></label><DeliveryField value={date} onChange={setDate}/></div><Dietary eggless={eggless} setEggless={setEggless}/><div className="gd-form-divider"/><CustomerFields customer={customer} setCustomer={setCustomer}/><ErrorNote message={error || accountError}/><button className="gd-button gd-button-primary" type="submit" disabled={busy || !account?.user}>{busy ? <LoaderCircle size={18} className="gd-spin"/> : <ArrowRight size={17}/>} {busy ? "Sending your inspiration…" : "Request my custom cake"}</button><p className="gd-micro">This is a quote request. The bakery will confirm the design, price and availability with you.</p></form></>}</div></Dialog>;
}
function AccountPanel() {
  const { account, error, reload, hasMore, loadingMore, loadMore } = useAccount();
  const [customer, setCustomer] = useState<Customer>({ fullName: "", phone: "", address: "", billingAddress: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (account?.profile) setCustomer(current => savedCustomer(current, account)); }, [account]);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setSaveError(""); setSaved(false); try { await request("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customer) }); setSaved(true); } catch (error) { setSaveError(errorText(error)); } finally { setSaving(false); } };
  return <Dialog title="Your account"><div className="gd-panel-padding"><p className="gd-eyebrow">Your own little corner</p><h2>{account?.user ? `Hello, ${account.user.displayName?.split(" ")[0] || "sweet friend"}.` : "More joy, less effort."}</h2><ErrorNote message={error}/>{!account && !error && <p className="gd-loading"><LoaderCircle className="gd-spin" size={18}/>Loading your account…</p>}{account && !account.user && <div className="gd-empty"><UserRound size={44} strokeWidth={1}/><h3>Welcome to Golden Delights.</h3><p>Create an account or sign in to track orders and save delivery details.</p><a className="gd-button gd-button-primary" href={loginHref} target="_top">Sign in / Create account <ArrowRight size={17}/></a><p className="gd-micro">Your saved profile includes addresses and a pay-on-delivery preference.</p></div>}{error && <button className="gd-button gd-button-secondary" onClick={() => void reload()}>Try again</button>}{account?.user && <><div className="gd-account-heading"><h3>Your orders</h3><button type="button" className="gd-account-refresh" onClick={() => void reload()}>Refresh orders</button>{account.isAdmin && <Link href="/admin">Owner dashboard <ChevronRight size={14}/></Link>}</div>{!account.orders?.length ? <div className="gd-order-empty"><ShoppingBag size={23}/><span>Your sweet story starts with your first order.</span></div> : <div className="gd-order-list">{account.orders.map(order => <article className="gd-order-card" key={order.id}><div><strong>{order.id}</strong><span className="gd-status">{order.status.replaceAll("_", " ")}</span></div><p>{order.kind === "custom" ? `Custom cake · ${order.custom?.weight || ""} kg · ${order.custom?.deliveryDate ? dateLabel(order.custom.deliveryDate) : "Design consultation"}` : order.items?.map(item => `${item.quantity} × ${item.name || item.productName || "Bakery treat"}`).join(", ") || "Handcrafted bakery order"}</p><footer><span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Order received"}</span><strong>{order.kind === "custom" && !order.total ? "Awaiting quote" : money(order.total)}</strong></footer></article>)}</div>}{hasMore && <button className="gd-button gd-button-secondary" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <LoaderCircle className="gd-spin" size={16}/> : null}Load older orders</button>}<div className="gd-form-divider"/><h3>Saved delivery details</h3><form onSubmit={save}><CustomerFields customer={customer} setCustomer={setCustomer} billing/><div className="gd-summary-card"><CreditCard size={19}/><div><strong>Payment preference</strong><p>Pay on delivery</p></div></div><ErrorNote message={saveError}/>{saved && <p className="gd-saved" role="status"><Check size={16}/>Your details have been saved.</p>}<button className="gd-button gd-button-primary" disabled={saving}>{saving ? <LoaderCircle className="gd-spin" size={17}/> : <Check size={17}/>}Save my details</button></form><a className="gd-account-signout" href="/sign-out?return_to=/" target="_top">Sign out of my account</a></>}</div></Dialog>;
}
export function CommercePanels() {
  const { panel, product } = useCommerce();
  if (panel === "product" && product) return <ProductPanel key={product.id} product={product}/>;
  if (panel === "cart") return <CartPanel/>;
  if (panel === "checkout") return <CheckoutPanel/>;
  if (panel === "custom") return <CustomPanel/>;
  if (panel === "account") return <AccountPanel/>;
  return null;
}
