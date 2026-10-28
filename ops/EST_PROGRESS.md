# Estimates worker 311e80c5 progress (2026-10-25)
- DONE code: backend/estimates-api.ts (new), schema-estimates.sql (APPLIED to D1), invoices-api.ts exports + orderDraft + estimate link, app-api.ts route + defaults,
  billing.tsx (EstStatus, InvoiceEditor est prop, Estimates/EstimateList/EstimatePage/CreateEstimateButton, InvoiceDoc+PDF estimate mode, customer page estimates),
  orders.tsx + projects.tsx CreateEstimateButton, admin.tsx nav, settings.tsx est fields, new-order.tsx uses admin/crm/customers.
- Build OK 01:44Z. NEXT: deploy, live test (ops/t41.py), cleanup, screenshots, WORKNOTES, milestone.
- QUEUED JOB 2 (steer): categories All + fuller taxonomy (admin editable, designers pick, multi-select filters), shop size filter only if fits, shop page background very light brand pattern on light-blue + stronger card lift. Shots am-shop-bg-1440/390, am-categories-1440.

- 01:52Z ESTIMATES DONE, verified, cleaned, WORKNOTES written. Milestone sent next. Then JOB 2.
- 01:54Z JOB 2 handed to a fresh worker (brief ops/JOB2_BRIEF.md) to avoid context overflow; 311e80c5 no longer deploys.
