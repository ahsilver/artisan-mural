import { plainError } from "@/lib/original-source";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import "./bo.css";

export async function api(path: string, opts: { method?: string; body?: any; raw?: boolean } = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const r = await fetch("/backend/" + path, { method: opts.method ?? (opts.body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (opts.raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((typeof j.error === "string" && j.error) || (typeof j.message === "string" && j.message) || `Something went wrong (${r.status}). Please try again.`);
  return j;
}
export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError("");
    try { setData(await api(path)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
export const money = (n: any, cur = "USD") => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: cur });
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export function Pill({ tone, children }: { tone?: "ok" | "warn" | "bad" | "info"; children: any }) { return <span className={"bo-pill " + (tone ?? "")}>{children}</span>; }
export function Msg({ m }: { m: { ok?: boolean; text: string } | null }) { return m ? <div className={"bo-msg " + (m.ok ? "ok" : "bad")}>{m.text}</div> : null; }
export function Field({ label, children, hint }: { label: string; children: any; hint?: string }) {
  return <div className="bo-field"><label className="bo-lbl">{label}</label>{children}{hint && <div className="bo-sub" style={{ marginTop: 3 }}>{hint}</div>}</div>;
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <label className="bo-switch"><input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
export function Drawer({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: any; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  if (!open) return null;
  return <><div className="bo-drawer-bg" onClick={onClose} /><div className={"bo-drawer" + (wide ? " wide" : "")} role="dialog">{children}</div></>;
}
export function useSaver() {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>, okText = "Saved.") => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: okText }); return true; } catch (e: any) { setMsg({ ok: false, text: plainError(e, "Something went wrong. Please try again.") }); return false; } finally { setBusy(false); }
  };
  return { msg, setMsg, busy, run };
}
