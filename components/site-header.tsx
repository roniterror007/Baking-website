"use client";

import { ShoppingBag, UserRound } from "lucide-react";
import { Brand } from "./brand";
import { useCommerce } from "./commerce";
import "./site-header.css";

type SiteHeaderProps = { theme: "light" | "dark"; onToggleTheme: () => void; onOpenMenu: () => void };

function MenuLines() {
  return <svg viewBox="0 0 22 22" width="20" height="20" fill="none" aria-hidden="true"><path d="M2 7h18M2 15h12" stroke="currentColor" strokeWidth="1.25"/></svg>;
}
function ThemeDial({ theme }: { theme: "light" | "dark" }) {
  return <svg className="gd-masthead-theme-dial" data-mode={theme} viewBox="0 0 22 22" width="19" height="19" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.1"/><path d="M11 3.5a7.5 7.5 0 0 1 0 15v-15Z" fill="currentColor"/><path d="M11 .8v1.2M11 20v1.2M.8 11H2M20 11h1.2" stroke="currentColor" strokeWidth=".8"/></svg>;
}

export function SiteHeader({ theme, onToggleTheme, onOpenMenu }: SiteHeaderProps) {
  const { openCustom, openAccount, openCart, cartCount } = useCommerce();
  return <header className="gd-masthead" data-mode={theme}>
    <div className="gd-masthead-inner">
      <nav className="gd-masthead-left" aria-label="Bakery navigation">
        <button className="gd-masthead-menu" type="button" onClick={onOpenMenu} aria-label="Open menu and collection filters" aria-haspopup="dialog"><MenuLines/><span>Menu</span></button>
        <span className="gd-masthead-divider" aria-hidden="true"/>
        <div className="gd-masthead-navigation"><a href="#menu">Collection</a><button type="button" onClick={openCustom}>Bespoke</button><a href="#story">Our story</a></div>
      </nav>
      <div className="gd-masthead-signature"><Brand/></div>
      <div className="gd-masthead-actions">
        <button className="gd-masthead-control" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><ThemeDial theme={theme}/></button>
        <button className="gd-masthead-control" type="button" onClick={openAccount} aria-label="Your account and orders" aria-haspopup="dialog" title="Your account"><UserRound size={19} strokeWidth={1.3}/></button>
        <span className="gd-masthead-action-divider" aria-hidden="true"/>
        <button className="gd-masthead-bag" type="button" onClick={openCart} aria-label={`Open bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}><ShoppingBag size={19} strokeWidth={1.3}/><span className="gd-masthead-bag-label">Bag</span><span className="gd-masthead-count">{cartCount}</span></button>
      </div>
    </div>
  </header>;
}
export default SiteHeader;
