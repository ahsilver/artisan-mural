# Direct print originals and a connected designer workspace

## 1. Private print originals
- Add a separate original-file upload for each color version, alongside the smaller shop preview.
- Accept high-resolution JPG/PNG and supported print PDFs. Keep originals private; never download them during ordinary browsing.
- Clearly require at least 250 DPI at the stated print size for raster artwork. Check actual pixel dimensions against mural size or repeating tile size, not just the DPI label.
- Display upload progress and actionable quality errors. Establish a tested file-size limit rather than retaining the current 20 MB restriction without explanation.
- Connect each order to its selected original version and saved wall geometry. Replacing or removing a design must not lose the source for an existing order.
- Generate the exact crop/repeat PDF on demand from that saved original. Unsupported or unverified PDFs must show a preflight requirement, never a false “print-ready” claim.

## 2. Requests and quotes inspired by your sample
- Add a request board showing the customer brief, room, wall measurements, budget, reference pictures, status and a View request action.
- Let approved designers quote with three fields: price, delivery days and message.
- Support both customization of an existing design and new custom-design requests; preserve the originating artwork and wall selection.
- Keep request details, conversation, quotes and delivered proof together in a project view.
- Customer accepts a quote, designer delivers a proof, customer approves the finished design, then payment becomes due. Do not label accepted quotes or approved proofs as paid.
- Preserve the studio's 10% custom-job share and the designer's 90% share. Keep wallpaper printing charges distinct from the custom-design fee.

## 3. One designer work area
- Reuse the shared account and existing studio rather than introducing another sign-in.
- Provide clear views for requests, active projects, messages, uploaded designs, collections and associated printing orders.
- Show a project's quote, delivery commitment, proof approval and payment status separately from printing/shipping status.
- Let customers revisit their own requests and respond through their account.

## 4. Expected event emails
- Send individual event notices for designer approval, a new request, a quote, quote acceptance, proof delivery/approval and confirmed sale/order progress.
- Send only to the relevant participant for that event, with a link back to their account or project.
- Prevent duplicate notices on retries and avoid emailing for every insignificant edit.
- **Needs your action:** configure a sender domain you own. Emails cannot send before it is verified.

## 5. Payments
- Preserve your previously requested Sola provider; do not silently replace it.
- **Needs your action:** provide Sola's integration documentation or connect the service securely. Never request private credentials in chat.
- Wire real payment confirmation only after the provider is connected; until then show payment as unavailable/awaiting payment, not a working demo checkout.

## Technical approach
- Extend the existing requests, conversations, offers and artwork records additively, with participant-scoped access and owner-only print exports.
- Use private storage and short-lived signed access; keep preview assets separate from print originals.
- Use direct storage uploads for larger masters instead of passing huge files through ordinary page submissions. Validate the stored original before allowing submission for approval.
- Reuse shared wall geometry and the existing print-quality helpers. Evaluate a large-file/preflight service if the hosted runtime cannot safely process the supported originals.
- Use Lovable's managed event-email infrastructure; do not create an email queue or marketing sender.

## Verification
- Test concrete 250-DPI boundaries, price/commission calculation, delivery-day validation, source-version retention and allowed status transitions.
- Exercise upload → submit → owner approval → customer request → designer quote → customer acceptance → proof approval → order linkage with real accounts.
- Check the request board and project view on phone and desktop.
- Verify actual email delivery and payment confirmation only after their prerequisites are available; explicitly report anything still blocked.