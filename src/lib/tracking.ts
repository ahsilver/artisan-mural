export function trackingUrl(carrier: string | null | undefined, num: string | null | undefined): string | null {
  if (!num) return null;
  const n = encodeURIComponent(num);
  switch ((carrier ?? "").toLowerCase()) {
    case "ups": return `https://www.ups.com/track?tracknum=${n}`;
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "dhl": return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`;
    default: return `https://www.google.com/search?q=${encodeURIComponent((carrier ?? "") + " tracking " + num)}`;
  }
}
