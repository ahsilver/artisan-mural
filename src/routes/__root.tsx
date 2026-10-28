import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FirstOrderPopup } from "@/components/first-order-popup";
import { CompareTray } from "@/components/compare-tray";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Artisan Mural — wallpaper printed to your exact wall" },
      {
        name: "description",
        content:
          "Designs from independent artists worldwide, printed to the exact size of your wall at $4.50 per sq ft.",
      },
      { property: "og:title", content: "Artisan Mural" },
      {
        property: "og:description",
        content: "Wallpaper printed to the exact size of your wall, by artists worldwide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preload", href: "/fonts/inter-tight-latin-v9.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/cormorant-garamond-latin-v21.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "icon", href: "/favicon.ico?v=2", type: "image/x-icon" },
      { rel: "icon", href: "/icon-256.png", type: "image/png", sizes: "256x256" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteBanner() {
  const [b, setB] = useState<{ enabled?: boolean; text?: string; link?: string } | null>(null);
  useEffect(() => { fetch("/backend/public/settings").then((r) => r.json()).then((s) => setB(s?.homepage?.banner ?? null)).catch(() => {}); }, []);
  if (!b?.enabled || !b.text) return null;
  const inner = <span>{b.text}</span>;
  return <div className="w-full bg-foreground px-4 py-2 text-center text-xs tracking-wide text-background">{b.link ? <a href={b.link} className="underline-offset-4 hover:underline">{inner}</a> : inner}</div>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const bare = path === "/admin" || path.startsWith("/dashboard");
  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        const next = sessionStorage.getItem("artisan-return");
        if (data.session && next?.startsWith("/") && !next.startsWith("//")) {
          sessionStorage.removeItem("artisan-return");
          window.location.assign(next);
        }
      });
    });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {bare ? <Outlet /> : <div className="flex min-h-screen flex-col">
        <SiteBanner />
        <SiteHeader />
        <main className="flex-1">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        <SiteFooter />
        <CompareTray />
        <FirstOrderPopup />
      </div>}
    </QueryClientProvider>
  );
}

