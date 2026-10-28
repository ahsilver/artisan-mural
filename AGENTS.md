<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep artwork crop geometry in the shared wall-selection module and pass it through product, room preview, and designer messages so all surfaces reference the same print area.
- No scale-calibration widget on the preview page; screen size never affects print or price.
- Restore designer physical scale without resetting customer measurements; shared zoom bounds validate links/orders consistently, while the bounded customizer uses logarithmic size controls to keep options reachable.
- Home photos use permanent asset pointers rather than document URLs so preview and published deployments serve the same images.
- Render the shared artwork selector as a fixed wall viewport whose frame size depends only on wall proportions; zoom scales only the artwork and dragging maps to normalized crop coordinates, so every surface keeps identical print geometry.
- Product details live in the design index leaf; a sibling preview leaf owns cropping, finishes, and room photos, and a checkout route places orders; validated URL search carries wall selection, view, and finish between them.
- Sample and order requests are anon write-only rows readable only by the studio, with server-recomputed prices and an awaiting-payment status; do not present them as paid until card payments are connected.
- Persistent chats use participant RLS and privileged designer assignments, never self-selected slugs, to prevent impersonation.
- Guest designer chats need no email: a browser-held random key (stored only as a SHA-256 hash) unlocks the conversation through security-definer functions; all chat bodies pass the shared contact-details guard so customers and designers stay on the platform.
- Guest room previews use same-origin routes and server-held keys; mask walls minus foreground, composite only masked pixels, and cache per session to preserve photos.
- Shared styling uses semantic global tokens and the existing Button component to keep the storefront and design tools visually consistent.
- Home merchandising stays in index with catalog entries and validated browse filters; visual refreshes preserve ordering and crop logic.
- Material photos/prices live in catalog; the shared selector shows unprinted photos and approximate artwork/texture close-ups in preview/checkout, without changing print files or crops.
- Keep panel width, overlap, and usable-coverage calculations in the shared wall-selection module; rulers, panel guides, and the scale silhouette are visual aids only and must not change crop geometry or pricing.
- Personal room photos live in a browser-local IndexedDB gallery (max six); demo rooms use the same masked preview flow.
- Designer artwork submissions are owner-readable private drafts with separate uploaded colorways and idempotent mockup rows; generation advances one database-leased item per request and pauses on terminal AI failures, so uploads cannot self-publish or duplicate fan-out work.
- Chats are read and written through verified server functions (account via row security, guests via hashed browser key); photos live in a private bucket served by short-lived signed links, and price offers are server-only rows so senders and prices can't be spoofed.
- Designers apply through designer_profiles (pending until the owner approves); uploads require approval and every upload carries its own review_status, so nothing self-publishes. Owner-only server functions verify has_role(admin) before privileged access.
- Murals cap orders at the designer's size with no stretch (shared wall-selection limits, also enforced on order creation); oversize walls route to the designer chat.
- Owner design edits live in design_overrides, applied via applyOverride/designRate everywhere incl. server order totals, so prices never drift.
- Designer ratings come only from designer_reviews, aggregated server-side into shop data.
- Keep room/style taxonomy and aliases in design-taxonomy and reuse it for upload, navigation, shop matching and mockup selection so legacy tags remain searchable.
- Submit verified originals before mockups finish; keep submitted_at independent of generation. Edits revert to private drafts; publication requires completed, approved work.
- Derive designer sales from owned upload IDs, not public catalog visibility; count printed square feet separately from placed orders so hidden artwork retains sales history.
- One account owns purchases and designer work; separate orders, requests and messages with accessible tabs. Approved designers enter the studio from their account; studio defaults to owned designs.
- Originals are private/versioned; orders snapshot source/geometry. A shared Drive/direct-file flow makes browser previews to avoid server decoding; public Drive imports use bounded streams and allowlisted redirects without credentials or blocked-download bypasses.
- Owner PDF/TIFF exports use signed originals and printGeometry; lossless RGB strip TIFFs enforce browser limits without shrinking print files.
- Verified request projections omit contact data; quote acceptance locks requests. Proof approval, payment and print-order linkage are separate; designer approval assigns protected chat ownership.
