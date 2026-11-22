import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { roomLabels, getTaxonomy } from "@/lib/design-taxonomy";
import { useSession } from "@/hooks/use-session";
import { NotificationBell } from "@/components/projects";
import { BrandLogo } from "@/components/brand-logo";

/** Room photos used as pictures in the menu (built-in sample rooms). */
const ROOM_PIC: Record<string, string> = {
  Bedroom: "bedroom-1", "Living room": "living-1", "Kids & nursery": "kids-1", "Dining room": "dining-1", Kitchen: "kitchen-1",
  Bathroom: "bathroom-1", "Hallway & stairs": "entry-1", "Office & study": "office-1", Commercial: "lobby-1",
};
const roomPic = (r: string) => `/s/rooms/${ROOM_PIC[r] ?? "living-1"}-t-v1.jpg`;

type Item = { label: string; search?: Record<string, string>; to?: string; pic?: string };
type Group = { key: string; label: string; items: () => Item[] };
const GROUPS: Group[] = [
  { key: "type", label: "Type", items: () => [
    { label: "All designs", search: {}, pic: roomPic("Living room") },
    { label: "Murals", search: { kind: "mural" }, pic: roomPic("Bedroom") },
    { label: "Repeating patterns", search: { kind: "repeating" }, pic: roomPic("Dining room") },
    { label: "Made for you", to: "/custom-request", pic: roomPic("Office & study") },
  ] },
  { key: "rooms", label: "Rooms", items: () => roomLabels.map((r) => ({ label: r, search: { room: r }, pic: roomPic(r) })) },
  { key: "style", label: "Style", items: () => getTaxonomy().styles.slice(0, 16).map((c) => ({ label: c, search: { category: c } })) },
  { key: "theme", label: "Themes", items: () => getTaxonomy().themes.slice(0, 16).map((c) => ({ label: c, search: { theme: c } })) },
  { key: "designers", label: "Designers", items: () => [{ label: "All designers", to: "/designers" }, { label: "How it works for designers", to: "/designers/how-it-works" }, { label: "Sell your art", to: "/sell" }] },
];
const NAV_RIGHT = [
  { to: "/custom-request", label: "Your own image" },
  { to: "/custom-request", label: "Post a request" },
  { to: "/designers", label: "Designers" },
  { to: "/pro", label: "Artisan Pro" },
] as const;

function ItemLink({ i, onPick, className, children }: { i: Item; onPick?: () => void; className?: string; children: React.ReactNode }) {
  return i.to
    ? <Link to={i.to} onClick={onPick} className={className}>{children}</Link>
    : <Link to="/browse" search={() => i.search ?? {}} onClick={onPick} className={className}>{children}</Link>;
}

function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form role="search" className={cn("relative", className)} onSubmit={(e) => { e.preventDefault(); void navigate({ to: "/browse", search: q.trim() ? { q: q.trim() } : {} }); }}>
      <label htmlFor="site-search" className="sr-only">Search murals, colors, rooms</label>
      <input id="site-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search murals, colors, rooms"
        className="h-11 w-full rounded-full border border-border bg-secondary px-5 pr-11 text-sm outline-none transition focus:border-foreground/40 focus:bg-background" />
      <button type="submit" aria-label="Search" className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-foreground hover:bg-background"><Search className="size-[17px]" /></button>
    </form>
  );
}

function MegaMenu({ onPick }: { onPick: () => void }) {
  const [g, setG] = useState("type");
  const group = GROUPS.find((x) => x.key === g)!;
  const items = group.items();
  const withPics = items.some((i) => i.pic);
  return (
    <div className="grid grid-cols-[220px_1fr] gap-8">
      <ul className="border-r border-border pr-4">
        {GROUPS.map((x) => (
          <li key={x.key}>
            <button type="button" onMouseEnter={() => setG(x.key)} onFocus={() => setG(x.key)} onClick={() => setG(x.key)} aria-current={x.key === g}
              className={cn("flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition", x.key === g ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x.label}<ChevronRight className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {withPics ? (
        <ul className="grid grid-cols-3 gap-4 xl:grid-cols-4">
          {items.map((i) => (
            <li key={i.label}>
              <ItemLink i={i} onPick={onPick} className="group block">
                <span className="block aspect-[4/3] overflow-hidden rounded-md bg-secondary">
                  {i.pic && <img src={i.pic} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />}
                </span>
                <span className="mt-2 block text-sm font-medium">{i.label}</span>
              </ItemLink>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 content-start gap-x-8 gap-y-1 xl:grid-cols-4">
          {items.map((i) => (
            <li key={i.label}><ItemLink i={i} onPick={onPick} className="block py-2 text-sm text-muted-foreground transition hover:text-foreground">{i.label}</ItemLink></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Phone & tablet: slide-in menu from the left with open/close groups. */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden"; closeRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", k); };
  }, [open, onClose]);
  if (!open) return null;
  const sec = "px-5 py-3 border-b border-border";
  const k = "mb-1 mt-2 text-[10.5px] font-bold uppercase tracking-[.12em] text-muted-foreground";
  const row = "flex items-center justify-between py-2.5 text-[15px]";
  return (
    <div className="fixed inset-0 z-[90] lg:hidden">
      <div className="absolute inset-0 bg-foreground/35" onClick={onClose} aria-hidden="true" />
      <aside aria-label="Menu" className="absolute inset-y-0 left-0 flex w-[min(340px,86vw)] flex-col bg-background shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="font-display text-2xl">Menu</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close menu" className="grid size-9 place-items-center"><X className="size-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto pb-8">
          <div className={sec}>
            <p className={k}>Shop</p>
            {GROUPS.map((g) => (
              <details key={g.key} className="group">
                <summary className={cn(row, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>{g.label}<span className="text-lg text-muted-foreground group-open:hidden">+</span><span className="hidden text-lg text-muted-foreground group-open:inline">–</span></summary>
                <ul className="grid pb-2 pl-3">
                  {g.items().map((i) => <li key={i.label}><ItemLink i={i} onPick={onClose} className="block py-2 text-sm text-muted-foreground">{i.label}</ItemLink></li>)}
                </ul>
              </details>
            ))}
            <Link to="/browse" onClick={onClose} className={row}>New arrivals</Link>
          </div>
          <div className={sec}>
            <p className={k}>Made for you</p>
            <Link to="/custom-request" onClick={onClose} className={row}>Your own image</Link>
            <Link to="/custom-request" onClick={onClose} className={row}>Post a request</Link>
            <Link to="/designers" onClick={onClose} className={row}>Designers</Link>
          </div>
          <div className={sec}>
            <p className={k}>More</p>
            <Link to="/pro" onClick={onClose} className={row}>Artisan Pro</Link>
            <Link to="/sell" onClick={onClose} className={row}>Sell your art</Link>
            <Link to="/account" onClick={onClose} className={row}>My account</Link>
            <Link to="/messages" onClick={onClose} className={row}>Messages</Link>
          </div>
        </nav>
      </aside>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const { session } = useSession();
  const count = useCart().length;
  const megaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mega) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setMega(false); };
    const c = (e: MouseEvent) => { if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMega(false); };
    addEventListener("keydown", k); addEventListener("mousedown", c);
    return () => { removeEventListener("keydown", k); removeEventListener("mousedown", c); };
  }, [mega]);
  const icon = "grid size-10 place-items-center rounded-full transition hover:bg-secondary";
  const icons = (
    <>
      <span className={icon}><NotificationBell /></span>
      <Link to="/account" aria-label={session ? "My account" : "Sign in"} title={session ? "My account" : "Sign in"} className={cn(icon, "max-lg:hidden")}><User className="size-[19px]" /></Link>
      <Link to="/cart" aria-label={`Cart, ${count} items`} className={cn(icon, "relative")}>
        <ShoppingBag className="size-[19px]" />
        {count > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{count}</span>}
      </Link>
    </>
  );
  const navLink = "flex h-12 items-center text-[11.5px] font-semibold uppercase tracking-[.14em] text-foreground/80 transition hover:text-foreground";
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        {/* top row: phone/tablet = menu + account | logo | icons; desktop = logo | search | icons */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 lg:grid-cols-[auto_1fr_auto] lg:gap-8 lg:py-3">
          <div className="flex items-center gap-1 lg:hidden">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className={icon}><Menu className="size-5" /></button>
            <Link to="/account" aria-label={session ? "My account" : "Sign in"} className={icon}><User className="size-[19px]" /></Link>
          </div>
          <Link to="/" aria-label="Artisan Murals home" className="justify-self-center text-foreground lg:justify-self-start">
            <BrandLogo monoClass="h-7 w-8 lg:h-9 lg:w-10" wordClass="h-4 w-[132px] sm:h-5 sm:w-40 lg:h-6 lg:w-48" />
          </Link>
          <SearchBox className="mx-auto hidden w-full max-w-xl lg:block" />
          <div className="flex items-center justify-self-end">{icons}</div>
        </div>
        <SearchBox className="pb-3 lg:hidden" />
        {/* desktop menu row */}
        <div ref={megaRef} className="relative hidden border-t border-border lg:block">
          <nav aria-label="Main navigation" className="flex items-center justify-center gap-8">
            <button type="button" onClick={() => setMega((v) => !v)} aria-expanded={mega} className={cn(navLink, "gap-1.5")}>
              All designs <ChevronDown className={cn("size-3.5 transition-transform", mega && "rotate-180")} />
            </button>
            <Link to="/browse" className={navLink}>New arrivals</Link>
            <span className="h-6 w-px bg-border" aria-hidden="true" />
            {NAV_RIGHT.map((n) => <Link key={n.label} to={n.to} className={navLink}>{n.label}</Link>)}
          </nav>
          {mega && (
            <div className="absolute inset-x-0 top-full z-50 rounded-b-xl border border-t-0 border-border bg-background p-7 shadow-lift" onClick={(e) => e.stopPropagation()}>
              <MegaMenu onPick={() => setMega(false)} />
            </div>
          )}
        </div>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
