import { Link } from "@tanstack/react-router";
import { useProSettings } from "@/lib/pro";
function ProName() { const p = useProSettings(); return <>{p.name} for professionals</>; }

import { PRICE_PER_SQFT, money } from "@/lib/catalog";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl">Artisan Mural</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            We print wallpaper to the exact size of your wall, from designs made by independent
            artists around the world. {money(PRICE_PER_SQFT)} per square foot, printed and shipped
            from our own press.
          </p>
        </div>
        <div>
          <p className="text-eyebrow text-muted-foreground">Shop</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/browse" className="text-muted-foreground hover:text-foreground">
                All designs
              </Link>
            </li>
            <li>
              <Link to="/designers" className="text-muted-foreground hover:text-foreground">
                Designers
              </Link>
            </li>
            <li>
              <Link to="/custom-request" className="text-muted-foreground hover:text-foreground">
                Request a custom design
              </Link>
            </li>
            <li><a href="/pro" className="text-muted-foreground hover:text-foreground"><ProName /></a></li>
          </ul>
        </div>
        <div>
          <p className="text-eyebrow text-muted-foreground">Designers</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/account" className="text-muted-foreground hover:text-foreground">Sign in / Your studio</Link></li>
            <li>
              <Link to="/sell" className="text-muted-foreground hover:text-foreground">
                Sell your work
              </Link>
            </li>
            <li>
              <Link to="/designers/how-it-works" className="text-muted-foreground hover:text-foreground">
                How it works & FAQ
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} Artisan Mural. Printed to order.
        </p>
      </div>
    </footer>
  );
}
