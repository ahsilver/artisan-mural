import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { categories, roomLabels } from "@/lib/design-taxonomy";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { NotificationBell } from "@/components/projects";
import { getTaxonomy } from "@/lib/design-taxonomy";

const nav = [
  { to: "/browse", label: "Shop" },
  { to: "/designers", label: "Artists" },
  { to: "/custom-request", label: "Custom design" },
] as const;

const shopRooms = roomLabels;
const shopStyleItems = () => [{ label: "All categories", search: {} as Record<string, string> }, ...getTaxonomy().styles.slice(0, 11).map((c) => ({ label: c, search: { category: c } as Record<string, string> }))];

function MenuCol({ title, items, onPick }: { title: string; items: { label: string; search: Record<string, string> }[]; onPick?: () => void }) {
  return (
    <div>
      <p className="text-eyebrow text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link to="/browse" search={() => i.search} onClick={onPick} className="text-sm text-muted-foreground transition-colors hover:text-primary">{i.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const [shopOpen, setShopOpen] = useState(false);
  const count = useCart().length;
  const icons = (
    <>
      <NotificationBell />
      <Link to="/account" aria-label={session ? "Account" : "Sign in"} title={session ? "Account" : "Sign in"}><User className="size-[18px]" /></Link>
      <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative">
        <ShoppingBag className="size-[18px]" />
        {count > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{count}</span>}
      </Link>
    </>
  );
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link to="/" className="shrink-0 font-display text-2xl font-medium leading-none tracking-tight">
          Artisan Mural<span className="text-clay">.</span>
        </Link>
        <nav aria-label="Main navigation" className="ml-auto hidden items-center gap-5 lg:flex">
          {nav.map((item) =>
            item.to === "/browse" ? (
              <div key={item.to} className="group" onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
                <Link to="/browse" search={{}} onClick={() => setShopOpen(false)} className="flex h-[72px] items-center gap-1 text-[11px] tracking-[.08em] text-muted-foreground transition-colors hover:text-foreground">
                  {item.label} <ChevronDown className="size-3 transition-transform group-hover:rotate-180" />
                </Link>
                <div className={cn("absolute inset-x-5 top-full mx-auto max-w-3xl rounded-sm border border-border bg-background p-7 shadow-paper transition-all", shopOpen ? "visible opacity-100" : "invisible opacity-0 group-focus-within:visible group-focus-within:opacity-100")}>
                  <div className="grid grid-cols-3 gap-8">
                    <MenuCol title="Shop by room" onPick={() => setShopOpen(false)} items={shopRooms.map((r) => ({ label: r, search: { room: r } }))} />
                    <MenuCol title="Shop by style" onPick={() => setShopOpen(false)} items={shopStyleItems()} />
                    <MenuCol title="Type" onPick={() => setShopOpen(false)} items={[{ label: "All wallpaper", search: {} }, { label: "Murals", search: { kind: "mural" } }, { label: "Repeating patterns", search: { kind: "repeating" } }]} />
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="text-[11px] tracking-[.08em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ),
          )}
          <a href="/#how-it-works" className="text-[11px] tracking-[.08em] text-muted-foreground hover:text-foreground">
            How it works
          </a>
          <Link to="/browse" aria-label="Search designs" className="border-l border-border pl-7">
            <Search className="size-[18px]" />
          </Link>
          {icons}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:hidden">
          <Link to="/browse" aria-label="Search designs">
            <Search className="size-[18px]" />
          </Link>
          {icons}
          <Button
            variant="ghost" size="icon" type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      <div className={cn("max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-border bg-background lg:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-7xl flex-col px-5 py-3">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} search={{}} onClick={() => setOpen(false)} className="py-3 text-sm">
              {item.to === "/browse" ? "Shop all wallpapers" : item.label}
            </Link>
          ))}
          <div className="grid grid-cols-2 gap-6 border-t border-border py-4">
            <MenuCol title="Shop by room" onPick={() => setOpen(false)} items={shopRooms.map((r) => ({ label: r, search: { room: r } }))} />
            <MenuCol title="Shop by style" onPick={() => setOpen(false)} items={shopStyleItems()} />
          </div>
          <a href="/#how-it-works" onClick={() => setOpen(false)} className="py-3 text-sm">
            How it works
          </a>
        </nav>
      </div>
    </header>
  );
}
