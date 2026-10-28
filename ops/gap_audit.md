# Gap audit: Lovable (artisanmural.lovable.app + repo) vs our copy (artisan-mural.pages.dev)
Date 2026-10-25. Method: every route/component/server function in the Lovable repo diffed against ours (82 of 107 files identical), all 18 Lovable tables + 3 RPCs checked in our backend, and a guest walk of 11 pages on both live sites (ops/gap_walk.py) listing every link/button/heading that only Lovable shows.

| Feature | Lovable | Ours | Verdict |
|---|---|---|---|
| Home, browse, compare, collections, designers list/profile, sell, studio demo | yes | same code (+ cleaner pictures, colors) | same / better |
| Design page: size, finishes, sample, carousel | yes | same + color circles, finish close-ups | better |
| Wall preview tools (ruler / panels / person) | preview page only, icons over picture, all off | preview page + every design page, under the picture, panel widths strip, inches ruler, 5 ft 9 in person | better |
| Oversize popup ("Don't worry, we can fix it") | big modal + boxed alert | same wording, small modal / bottom sheet, blocks cart | better |
| Chat with the designer | "Chat with the designer" on design page | "Need changes? Ask the designer" + request chat + Messages inbox | same / better |
| Preview in my room | button in right column | one "See it in your room" (owner asked to keep one) | same |
| Card badge Mural / Repeat | badge on picture | text under the picture ("· Mural") | same (no text over pictures) |
| Custom request form | guest can send without account; fields: idea, room, rough wall size, budget, material, photo, send to | sign-in first (so chat + notifications work); same fields | MISSING "material you have in mind" -> ADDED as "Finish you have in mind"; guest (no account) sending: different by design |
| Sign in with Google | "Continue with Google" | email + password only | MISSING (BIG: needs a Google sign-in key from the owner's Google account) |
| Account: orders, requests, messages, designer studio link | yes | same + addresses, store credit, trade account | better |
| Checkout | address, notes | same + tax, coupons, saved addresses | better |
| Designer studio: upload (Drive), collections, design editor, offers, payouts, stats | yes | same code + seller dashboard, colors, story fields | same / better |
| Back office: All designs, Uploads to review, Orders, Custom requests, Messages, Payouts, Materials, Collections, Users | yes | Overview, Orders, Messages, Design requests, Designs, Collections, Designers, Payouts, Customers, Discount codes, Old custom requests, Homepage, Settings (Finishes), Emails | better |
| Back office: add an order from outside the website | simple form (design, customer, sq ft, total) | MISSING in new back office (old form only in classic page) -> BUILT as Orders > New order (job 3) |
| Order status / payment status / print file PDF | yes | yes | same |
| Designs on the live Lovable site | Blue Sky kid friendly, Blue sky flying airplanes, Peony Garden (Emerald, Ivory Bloom), The Vintage Grove (Burgundy, Green) | not on ours | MISSING (BIG: uploaded on Lovable after the copy; their print files are private there) |
| Designers on the live Lovable site | Hershy Friedman, libby reisz, "Artisan Mural designer" | not on ours | MISSING (BIG, same reason: they signed up on Lovable after the copy) |
| Soft Rain, Tide Marks | shown | in our catalog but hidden (Designs > hidden) | same data, owner can unhide |

## BIG items for the owner
1. Google sign-in: needs a Google sign-in key made in the owner's Google account (10 min with him), then ~1 hour to wire.
2. New designs and designers added on Lovable after the copy (6 designs incl. colors, 3 designers): the designers re-upload on the new site, or the owner exports them from Lovable; we cannot read their print files as a guest.
3. Guest custom requests without an account: possible (email link to the chat), but it weakens notifications; owner's call.
