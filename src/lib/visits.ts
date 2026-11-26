/**
 * Visitor statistics, kept on our own site (no outside tracker, no cookies, no names, no IP addresses).
 * Each browser gets a random number in its own storage; each tab visit a session number. We count page views,
 * searches (and how many results they found), cart adds and orders, plus where the visit came from.
 */
type Hit = { kind: "view" | "search" | "cart" | "order"; path?: string; design?: string; q?: string; n?: number };

const rid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 16);
function ids() {
  let vid = "", sid = "", first = false;
  try { vid = localStorage.getItem("am-vid") || ""; if (!vid) { vid = rid(); localStorage.setItem("am-vid", vid); } } catch { vid = "anon"; }
  try { sid = sessionStorage.getItem("am-sid") || ""; if (!sid) { sid = rid(); sessionStorage.setItem("am-sid", sid); first = true; } } catch { sid = vid; }
  return { vid, sid, first };
}

/** Sends one event; never throws and never slows the page. Owner pages are not counted. */
export function track(h: Hit) {
  try {
    if (typeof window === "undefined" || navigator.webdriver && !(window as any).__amTrackTests) return;
    const path = h.path ?? location.pathname;
    if (/^\/(admin|studio|designer-upload)/.test(path)) return;
    const { vid, sid, first } = ids();
    const u = new URLSearchParams(location.search);
    const body = {
      kind: h.kind, path: path.slice(0, 200), design: h.design, q: h.q?.slice(0, 80), n: h.n, vid, sid,
      // where the visit came from: only on the first page of a visit
      ref: first ? document.referrer.slice(0, 300) : "", src: first ? u.get("utm_source") ?? u.get("ref") ?? "" : "", medium: first ? u.get("utm_medium") ?? "" : "", campaign: first ? u.get("utm_campaign") ?? "" : "",
      w: window.innerWidth,
    };
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (!navigator.sendBeacon?.("/backend/public/hit", blob)) void fetch("/backend/public/hit", { method: "POST", body: blob, keepalive: true }).catch(() => {});
  } catch {}
}
