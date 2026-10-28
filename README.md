# Artisan Mural — wallpaper & mural marketplace

## Live links
- **Live site:** https://artisan-mural.pages.dev
- **Homepage concept:** source in [`homepage-concept/`](homepage-concept/)
A marketplace for custom-printed wallpaper and murals: independent designers upload designs, customers customize them to their exact wall size (true-scale preview with panels, person and ruler; see it in your own room; finishes; mural vs. repeating pattern), ask the designer for changes, order samples or full prints, and pay. The owner's back office covers orders, customers, invoices, estimates, designers and payouts, categories, finishes, pricing and settings.

## Tech stack
- **Frontend + server:** TanStack Start (React 19, TanStack Router), Vite, TypeScript, Tailwind CSS, Radix UI / shadcn components.
- **Hosting:** Cloudflare Pages (built with the Nitro `cloudflare-pages` preset; server code runs as Pages Functions).
- **Database:** Cloudflare D1 (SQLite), binding `DB`. `src/backend/` implements a small PostgREST-compatible REST layer (`pgrest.ts`), auth (`auth.ts`), row-level policies (`policies.ts`) and APIs for admin, designers, accounts, invoices, estimates and messages. Schema: `src/backend/schema*.sql` (+ older `drizzle/migrations/`).
- **File storage:** Cloudflare R2, binding `FILES` (design files, previews, photos).
- **Package manager:** Bun (npm also works).

## Run locally
```bash
bun install            # or: npm install
bun run dev            # Vite dev server
bun run build          # production build into dist/
bun run test           # unit tests (vitest)
```
Pages that read data need the D1/R2 bindings. The simplest full local run: `bun run build` then
`npx wrangler pages dev dist --d1 DB=<your-d1-database-id> --r2 FILES=<your-bucket>` with the variables below in a `.dev.vars` file.

## Deploy (Cloudflare Pages + D1 + R2)
1. `npx wrangler d1 create artisan-mural-db` and apply the schema: `npx wrangler d1 execute artisan-mural-db --remote --file=src/backend/schema.sql` (then `schema-2.sql`, `schema-3.sql`, and the other `schema-*.sql` files).
2. `npx wrangler r2 bucket create artisan-mural-files`
3. Create a Pages project (e.g. `artisan-mural`); under Settings > Bindings add D1 `DB` and R2 `FILES`; under Variables add the environment variables below.
4. Build and deploy: `python3 ops/build_deploy.py both` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your environment), or `bun run build && npx wrangler pages deploy dist --project-name artisan-mural`.

## Environment variables (names only — see `.env.example`)
- `PUBLIC_ORIGIN` — the site's public URL
- `JWT_SECRET` — secret for signing login sessions
- `SERVICE_KEY` — internal service key for server-side calls
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — legacy, from the original prototype; not needed on Cloudflare
- Deploy scripts only: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Also in this repo
- `ops/build_deploy.py`, `ops/cf.py` — build and deploy helpers (read the Cloudflare token from your environment); the other `ops/*.py` files are speed/screenshot/check helpers used during development.
- `ops/mockups/` — Python script that renders product mockups (wall with peeling panels, half-unrolled roll) from any repeat design; see its README.
- `homepage-concept/` — static HTML/CSS/JS concept for a new home page and designers page.
- `DEVELOPER.md` — architecture notes and feature-by-feature change log.

Card payments and customer emails are in test mode until live keys are connected.
