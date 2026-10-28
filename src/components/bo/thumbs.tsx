import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getShopDesigns } from "@/lib/shop.functions";
import { liveDesigns, type Design } from "@/lib/catalog";
import { buildThumbs, needsThumbs } from "@/lib/pics";

/** Card pictures: small, fast versions of every design's pictures. Missing ones are made automatically when the owner opens Designs. */
export function ThumbsBar() {
  const [list, setList] = useState<Design[] | null>(null);
  const [state, setState] = useState<{ busy: boolean; text: string; ok?: boolean }>({ busy: false, text: "" });
  const auto = useRef(false);
  const load = async () => { const shop = await getShopDesigns(); const all = liveDesigns(shop).map((d) => (d.thumbs || !shop.thumbs?.[d.slug] ? d : { ...d, thumbs: shop.thumbs[d.slug] })); setList(all); return all; };
  const run = async (which: Design[]) => {
    if (!which.length) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setState({ busy: true, text: `Making card pictures 0/${which.length}…` });
    let done = 0, failed = 0;
    for (const d of which) {
      try { await buildThumbs(d, token); } catch (e) { failed++; console.warn(d.slug, e); }
      done++; setState({ busy: true, text: `Making card pictures ${done}/${which.length}…` });
    }
    await load();
    setState({ busy: false, ok: !failed, text: failed ? `${which.length - failed} done, ${failed} could not be made.` : `Card pictures ready for ${which.length} design${which.length > 1 ? "s" : ""}.` });
  };
  useEffect(() => { load().then((all) => { if (auto.current) return; auto.current = true; run(all.filter(needsThumbs)); }).catch(() => {}); }, []);
  if (!list) return null;
  const missing = list.filter(needsThumbs).length;
  return (
    <div className="bo-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <b>Card pictures</b> <span className="bo-sub">{state.text || (missing ? `${missing} of ${list.length} designs still need fast pictures` : `All ${list.length} designs have fast pictures (room + design, small WebP)`)}</span>
      </div>
      {missing > 0 && <button className="bo-btn sm pri" disabled={state.busy} onClick={() => run(list.filter(needsThumbs))}>Make missing</button>}
      <button className="bo-btn sm" disabled={state.busy} onClick={() => run(list)}>Remake all</button>
    </div>
  );
}
