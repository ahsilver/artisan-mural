# Artisan Mural — roadmap

## October 23 — customize page and front page
- [x] Front-page moving strip lists wallpaper categories (all twelve shared categories, each opening the filtered browse list) instead of individual designs; verified on computer and phone.
- [x] Keep artwork preview bounded with wall measurements, finishes and checkout beside it.
- [x] Improve designer-scale reset and extend repeat zoom-out with shared geometry tests (22 focused tests passed).
- [x] Verified reset, zoom to 32, unchanged 10 × 8 ft wall/$360 estimate, and cart handoff; phone layout has no horizontal overflow.

## October 21 — completed
- [x] Shared account now separates My orders, Requests & projects, and Messages; approved designers have a clear studio entry.
- [x] Designer sign-in appears directly on the designer login page; studio opens on owned designs with accessible workspace tabs.
- [x] Hide original replacement forms until expanded; missing artwork uses a clean placeholder rather than a broken image.
- [x] Verified signed-in owner account → studio designs, messages, requests, orders and collections; 390px studio has no horizontal page overflow.
- [x] Tested whole-wall repeating PDF and TIFF with a 2500px tile: 20 × 16 inches, 250 DPI, TIFF 5000 × 4000 pixels; inspected output for blank edges.
- [x] Downloaded a real existing order PDF through the owner UI: exact 120 × 96 inches from a supplied vector original. Existing demo orders have no saved original and correctly request manual artwork.
- [x] Added full 10 × 8 foot repeat coverage/250-DPI regression test; 25 focused tests passed and preview build passed.
- [x] Audited content-page metadata and completed unavailable designer/collection metadata.
- [x] Reconciled obsolete notes: approved uploads enter the live shop; public Drive imports do not require an API key, personal Drive connection, or separate website picture.

## Previously implemented and verified
- [x] One customer/designer account; applications and design approval; owner portal, design editing, material controls, SKU search, collections and designer reviews.
- [x] Single source per color: direct high-resolution original or publicly shared Drive link, up to 250 MB; private retained originals and automatic website previews, measured pixels and 250-DPI size limits.
- [x] Submit verified artwork before room photos finish; submission and owner approval remain separate.
- [x] Custom briefs/photos, price and delivery-day quotes, messages, quote acceptance, finished-proof approval and related print-order linkage.
- [x] Product/preview separation, compact finishes, room photos, shared crop/repeat geometry, removal of two-inch detail and calibration controls.
- [x] Owner PDF and lossless RGB TIFF use shared geometry; TIFF rejects more than 160 million pixels or width above 32,767 pixels without reducing resolution. Vector PDFs require specialist TIFF conversion.
- [x] Order insert trigger snapshots originals and artwork geometry for uploaded designs; original versions are private and retained.

## Remaining external setup or representative input
- [ ] Sola payment collection — needs owner's Sola connection/details; checkout and approved quotes remain awaiting payment. Designer payouts are manual for now.
- [ ] App approval/sale/request/progress emails — needs an owner-controlled verified sender domain; no sender domain is configured.
- [ ] Production-scale original → upload → completed mockups → publication → order → saved-original PDF/TIFF verification — needs a representative production original and sample order; no near-250 MB file has been exercised. Existing demo orders lack saved originals.
- [ ] Real large public Drive import stress test — needs a representative publicly downloadable file; blocked/restricted Google downloads cannot be bypassed.
- [ ] Large TIFF/PDF preflight beyond browser limits — requires a specialist print renderer; no silent shrinking or DPI certification of embedded raster PDFs.
- [ ] Custom GoDaddy domain — needs owner's exact domain name.
- [ ] Live shipping-carrier updates — needs an owner-connected shipping service.
- [ ] Publishing current edits — waits for an explicit publish request.
