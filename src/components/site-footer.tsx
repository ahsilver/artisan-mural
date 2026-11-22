import { Link } from "@tanstack/react-router";
import { useProSettings } from "@/lib/pro";
import { PRICE_PER_SQFT, money } from "@/lib/catalog";
import { BrandLogo } from "@/components/brand-logo";

function ProName() { const p = useProSettings(); return <>{p.name}</>; }

const COLS: { title: string; links: { to: string; label: React.ReactNode }[] }[] = [
  { title: "Shop", links: [{ to: "/browse", label: "All designs" }, { to: "/browse", label: "New arrivals" }, { to: "/designers", label: "Designers" }, { to: "/compare", label: "Compare designs" }] },
  { title: "Made for you", links: [{ to: "/custom-request", label: "Your own image" }, { to: "/custom-request", label: "Post a request" }, { to: "/pro", label: <><ProName /> for professionals</> }] },
  { title: "Designers", links: [{ to: "/sell", label: "Sell your art" }, { to: "/designers/how-it-works", label: "How it works & FAQ" }, { to: "/account", label: "Sign in / Your studio" }] },
  { title: "Help", links: [{ to: "/account", label: "My account" }, { to: "/messages", label: "Messages" }, { to: "/cart", label: "Cart" }] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link to="/" aria-label="Artisan Murals home"><BrandLogo monoClass="h-9 w-10" wordClass="h-5 w-44" /></Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
            Murals and wallpaper drawn by independent artists, printed to the exact size of your wall.
            From {money(PRICE_PER_SQFT)} per square foot.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#D3C3A2]">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l, i) => <li key={i}><Link to={l.to} className="text-primary-foreground/75 transition hover:text-primary-foreground">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-foreground/15">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-primary-foreground/60 sm:px-8">© {new Date().getFullYear()} Artisan Murals. Printed to order.</p>
      </div>
    </footer>
  );
}
