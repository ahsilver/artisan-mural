# Homepage concept (preview)

A standalone design concept for a new Artisan Mural home page and a "For designers" page — plain HTML, CSS and vanilla JavaScript, no build step, no frameworks.

## Live links
- **Current live site:** https://artisan-mural.pages.dev

- `site/index.html` — full-screen hero (rooms cross-fading with a slow zoom), scroll storytelling (headlines type/rise in as you scroll), specialties, design strip, how it works, call to action. Links point to https://artisan-mural.pages.dev.
- `site/designers/` — the designer sign-up story page, with two scroll effects to compare (Option A: wallpaper rolls down the wall; Option B: the wall darkens/enriches).
- `site/media/` — the large room pictures. `site/img/` — the smaller pictures.
- Respects "reduce motion" settings; works at phone and desktop widths.

Run locally: `cd site && python3 -m http.server 8080` then open http://localhost:8080
Test: `node --test test/site.test.cjs`
Host anywhere static (Cloudflare Pages: upload the `site` folder).
