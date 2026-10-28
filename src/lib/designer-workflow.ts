export function canSubmitArtwork(upload: { status: string; submitted_at: string | null; colors: number; mockups: number }) {
  return !upload.submitted_at && upload.colors > 0;
}
export function artworkReviewLabel(upload: { review_status: string; submitted_at: string | null }) {
  if (!upload.submitted_at) return "Draft · not submitted";
  return upload.review_status === "approved" ? "Approved" : upload.review_status === "rejected" ? "Not approved" : "Waiting for approval";
}
export function summarizeDesignOrders(rows: readonly { status: string; square_feet: number | string; created_at: string }[]) {
  const ordered = rows.filter(r => r.status !== "cancelled");
  const printed = ordered.filter(r => ["printing", "shipped", "delivered"].includes(r.status));
  const total = (items: typeof ordered) => Math.round(items.reduce((n, r) => n + Number(r.square_feet), 0) * 10) / 10;
  return { orders: ordered.length, sqft: total(ordered), printedSqft: total(printed), lastOrder: ordered.map(r => r.created_at).sort().at(-1) ?? null };
}
export function canApproveArtwork(upload: { status: string; submitted_at: string | null }) {
  return upload.status === "ready" && Boolean(upload.submitted_at);
}
