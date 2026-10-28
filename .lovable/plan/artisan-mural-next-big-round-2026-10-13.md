# Artisan Mural — next big round

## 1. Product page back to how it was
- Put the "Chat with the designer" box back at the top (beside the artwork on desktop, right under the title on phone).
- Remove the "Good design should give back" card.
- In the "Let's get the fit right" box: remove the small "Your wall" picture and the "Pick a part" link.
- Keep only the wall size, price, **Continue with this design** and **Preview in my room**.
- **Murals only:** the designer's size (e.g. 20 ft x 20 ft) is the biggest a customer can order; smaller is fine (they crop). If someone types a bigger wall, a clear message pops up right away: "This mural is made for up to 20 x 20 ft. Don't worry, the designer can make it fit your wall for a fee," with a big **Contact the designer** button. Repeating patterns stay as they are now.
- Check every step at phone size so it's clean and easy to tap.

## 2. A proper messenger (real one, not just the demo)
- Same style as the demo messenger: chat list on the left with photo, last message, time and unread dot; the open chat on the right; full screen on phone with a back arrow.
- Photos both ways, the chosen wall part attached as a card, price offers inside the chat.
- Unread counts, "seen" marks, newest chats on top, search and filters (Customers / Company).
- Messages appear on their own without refreshing.
- Contact details stay blocked so everything stays on Artisan Mural.

## 3. Designer sign-up like Fiverr
- After creating an account, a step-by-step form: name, studio name, country, short bio, profile photo, portfolio links, design styles, and how they want to be paid (PayPal email or bank details).
- After sending, they see "Waiting for approval" — they can't upload designs until the owner approves them.
- On the upload form, designers can write **the story behind the design**. It shows in its own section on the product page.

## 4. Owner portal (only the owner can open it)
- **Designers**: everyone who signed up, their info and payout details; Approve / Reject.
- **Designs**: every uploaded design with its room photos; Approve (goes live in the shop) / Reject with a reason. Nothing goes live without approval.
- **Orders**: all orders and sample requests, with status (awaiting payment, printing, shipped).
- **Messages**: every conversation between customers and designers.
- **Payouts**: what each designer has earned (per-sq-ft royalties + 90% of custom jobs), what was paid, what's owed; a "Mark as paid" button.
- **Users**: everybody who signed up.

## About paying designers
For now the owner pays designers himself (PayPal or bank transfer) using the details from sign-up, then marks it paid in the portal. Taking card payments from customers can be added later with built-in payments; automatic payouts to designers can come after that.

## What you need to do
- Sign up on the site with your own email so I can make that account the owner.

## Technical section
- New tables: designer_profiles (status pending/approved/rejected, payout method), design approval status + review reason on artwork_uploads, payouts, message read receipts; RLS with has_role('admin') for owner reads/writes, designer self-read/insert only.
- Upload server functions refuse unapproved designers; published designs come only from approved uploads.
- Owner pages under an admin-gated route; all reads via requireSupabaseAuth server functions with role checks.
- Messenger polling + realtime; reuse contact guard and existing offer logic.
