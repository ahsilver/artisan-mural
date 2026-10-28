import { useEffect, useRef, useState } from "react";
import { MatchLabel } from "./match-info";
import { X, UploadCloud } from "lucide-react";
import { api, Msg, Field, Pill, useSaver } from "@/components/bo/common";
import { uploadFile, driveImport, driveFolder, makePreview, previewFromStored, fmtBytes, readDims } from "@/lib/designer-files";
import { checkRepeat, type RepeatResult } from "@/lib/repeat-check";
import { pickRooms, makeMockup, makeSampleMockup, defaultMockupRooms, resolveMockupRoom } from "@/lib/auto-mockup";
import { MockupRoomPicker, remakeRoomMockups, sceneMockup } from "@/components/mockup-rooms";
import { DriveFolderPicker } from "@/components/designer/drive-folder";
import { dominantColor } from "@/lib/designer-files";
import { loadSite } from "@/lib/site-settings";
import { getTaxonomy, setTaxonomy, canonicalCategories, canonicalRooms } from "@/lib/design-taxonomy";
import { useQuery } from "@tanstack/react-query";
import { shopQuery } from "@/lib/shop";
import { resolvedMaterials, swatchStyle } from "@/lib/catalog";

const UNITS: Record<string, number> = { ft: 30.48, in: 2.54, cm: 1 };
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Vector files scale to any wall: the largest wall we take (about 160 ft). */
const VECTOR_MAX_CM = 4876.8;

export type RepeatType = "full" | "sideways" | "mural";
export const repeatTypeOf = (kind: string, repeat: string): RepeatType => (kind === "mural" ? "mural" : repeat === "horizontal" ? "sideways" : "full");
const REPEAT_TYPES: { id: RepeatType; title: string; sub: string }[] = [
  { id: "full", title: "Repeats all sides", sub: "Tiles sideways and up and down. Fits any wall." },
  { id: "sideways", title: "Repeats sideways only", sub: "Tiles across. Its height is the tallest wall it fits." },
  { id: "mural", title: "Mural, no repeat", sub: "One scene with a set width and height." },
];
export function RepeatIcon({ t, size = 44 }: { t: RepeatType; size?: number }) {
  const h = Math.round(size * 0.72);
  const st = { fill: "none", stroke: "currentColor", strokeWidth: 1.4 } as const;
  return <svg width={size} height={h} viewBox="0 0 44 32" aria-hidden="true" className="de-ico">
    <rect x="1" y="1" width="42" height="30" rx="3" {...st} opacity=".35" />
    {t === "full" && [0, 1, 2].flatMap((c) => [0, 1].map((r) => <g key={`${c}${r}`}><rect x={4 + c * 12.5} y={4 + r * 12.5} width="11" height="11" rx="1.5" {...st} /><circle cx={9.5 + c * 12.5} cy={9.5 + r * 12.5} r="2.4" fill="currentColor" /></g>))}
    {t === "sideways" && [0, 1, 2].map((c) => <g key={c}><rect x={4 + c * 12.5} y="4" width="11" height="24" rx="1.5" {...st} /><path d={`M${5.5 + c * 12.5} 20 q2.5 -6 4 -2 q2 4 4 -3`} {...st} /></g>)}
    {t === "mural" && <><rect x="4" y="4" width="36" height="24" rx="1.5" {...st} /><path d="M5 24 L14 15 L20 20 L28 11 L39 22" {...st} /><circle cx="33" cy="9" r="2.4" fill="currentColor" /></>}
  </svg>;
}
/** The design as it lands on a wall: tiled all ways, tiled across at full height, or one scene. */
export function RepeatPreview({ src, type, halfDrop, label }: { src?: string; type: RepeatType; halfDrop?: boolean; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.5);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!; const W = c.width, H = c.height;
    ctx.fillStyle = "#efece8"; ctx.fillRect(0, 0, W, H);
    if (!src) { // no artwork yet: a soft sample motif shows how this repeat type lands on a wall
      const t = document.createElement("canvas"); t.width = 120; t.height = 120; const x = t.getContext("2d")!;
      x.fillStyle = "#e8e3db"; x.fillRect(0, 0, 120, 120); x.strokeStyle = "#c9bfb0"; x.lineWidth = 5;
      if (type === "mural") { x.fillStyle = "#ddd5c8"; ctx.fillStyle = "#e6e0d6"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#d8cfc1"; ctx.beginPath(); ctx.moveTo(0, H * 0.75); ctx.lineTo(W * 0.25, H * 0.45); ctx.lineTo(W * 0.42, H * 0.62); ctx.lineTo(W * 0.66, H * 0.3); ctx.lineTo(W, H * 0.68); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.8, H * 0.22, 26, 0, 7); ctx.fill(); return; }
      if (type === "sideways") { x.beginPath(); x.moveTo(10, 100); x.quadraticCurveTo(40, 20, 60, 70); x.quadraticCurveTo(80, 110, 110, 30); x.stroke(); const th = H, tw = th * 0.5; for (let X = 0; X < W; X += tw) ctx.drawImage(t, 0, 0, 120, 120, X, 0, tw, th); return; }
      x.beginPath(); x.arc(60, 60, 30, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 14, 0, 7); x.arc(120, 0, 14, 0, 7); x.stroke();
      const tw = W / 6; for (let i = 0, X = 0; X < W; i++, X += tw) for (let Y = halfDrop && i % 2 ? -tw / 2 : 0; Y < H; Y += tw) ctx.drawImage(t, X, Y, tw, tw);
      return;
    }
    let dead = false; const img = new Image(); img.src = src;
    img.onload = () => {
      if (dead) return;
      const r = img.naturalWidth / img.naturalHeight; setRatio(r);
      ctx.fillStyle = "#efece8"; ctx.fillRect(0, 0, W, H);
      if (type === "mural") { const k = Math.max(W / img.naturalWidth, H / img.naturalHeight); const w = img.naturalWidth * k, h = img.naturalHeight * k; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); return; }
      const th = type === "sideways" ? H : Math.min(H / 2, (W / 3.2) / r), tw = th * r;
      for (let i = 0, x = 0; x < W; i++, x += tw) {
        const off = type === "full" && halfDrop && i % 2 ? -th / 2 : 0;
        for (let y = off; y < H; y += th) { ctx.drawImage(img, x, y, tw, th); if (type === "sideways") break; }
      }
    };
    return () => { dead = true; };
  }, [src, type, halfDrop]);
  void ratio;
  return <figure className="de-prev"><canvas ref={ref} width={720} height={450} aria-label="How the design repeats on a wall" />
    <figcaption>{label ?? (type === "full" ? `Repeats in every direction${halfDrop ? " (half-drop match)" : ""}` : type === "sideways" ? "Repeats sideways; one copy covers the wall's full height" : "Mural: one scene, printed once, never tiled")}</figcaption></figure>;
}

export function DesignEditor({ design, rules, onChanged, onClose, ensure, page }: { design: any; rules: any; onChanged: () => void; onClose?: () => void; ensure?: () => Promise<string>; page?: boolean }) {
  const s = useSaver();
  const meta = design.meta ?? {};
  const [tax, setTax] = useState(getTaxonomy());
  useEffect(() => { loadSite().then((site: any) => { if (site?.taxonomy) { setTaxonomy(site.taxonomy); setTax(getTaxonomy()); } }).catch(() => {}); }, []);
  const ROOMS = tax.rooms, STYLES = tax.styles, THEMES = tax.themes, CATS = [...STYLES, ...THEMES];
  const [suggest, setSuggest] = useState<string>(meta.suggestedPrice ? String(meta.suggestedPrice) : "");
  const [rec, setRec] = useState<{ ids: string[]; note: string }>({ ids: design.recommendedFinish?.ids ?? [], note: design.recommendedFinish?.note ?? "" });
  const [basic, setBasic] = useState({ title: design.title === "Untitled design" ? "" : design.title, madeFor: canonicalRooms(design.madeFor ?? []), categories: canonicalCategories(design.categories ?? []), story: design.story ?? "", description: design.description ?? "", notes: design.notes ?? "", tags: (design.tags ?? []).join(", "), palette: design.palette ?? "" });
  const rtServer = repeatTypeOf(design.kind, design.repeat);
  const [rt, setRt] = useState<RepeatType>(rtServer);
  const [halfDrop, setHalfDrop] = useState(design.repeat === "halfdrop");
  useEffect(() => { setRt(rtServer); setHalfDrop(design.repeat === "halfdrop"); }, [design.kind, design.repeat]);
  const locked = design.review === "approved";
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(design.colors.length === 0);
  useEffect(() => { if (design.colors.length === 0) setAdding(true); if (active >= design.colors.length && design.colors.length) setActive(design.colors.length - 1); }, [design.colors.length]);
  const [tagAi, setTagAi] = useState<any>(null);
  const [tagMsg, setTagMsg] = useState("");
  useEffect(() => { api("ai/status").then(setTagAi).catch(() => setTagAi(null)); }, []);
  const designRef = useRef(design); designRef.current = design;
  const getId = async () => designRef.current.id || (ensure ? await ensure() : "");
  // autosave: every change to the fields is saved a moment after typing stops
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved("saving");
    const t = setTimeout(async () => {
      try {
        const id = await getId(); if (!id) return;
        const m = designRef.current.meta ?? {};
        const sp = Number(suggest) > 0 ? Number(suggest) : null;
        const rf = designRef.current.recommendedFinish ?? { ids: [], note: "" };
        const recChanged = JSON.stringify(rf.ids ?? []) !== JSON.stringify(rec.ids) || (rf.note ?? "") !== rec.note.replace(/\s+/g, " ").trim();
        await api(`designer/uploads/${id}`, { body: { title: basic.title || "Untitled design", madeFor: basic.madeFor, categories: basic.categories, story: basic.story, description: basic.description, notes: basic.notes, tags: basic.tags, palette: basic.palette, ...((m.suggestedPrice ?? null) !== sp ? { meta: { ...m, suggestedPrice: sp } } : {}), ...(recChanged ? { recommendedFinish: rec } : {}) } });
        setSaved("saved"); onChanged();
      } catch { setSaved("error"); }
    }, 900);
    return () => clearTimeout(t);
  }, [basic, suggest, rec]);
  async function chooseType(t: RepeatType, hd = halfDrop) {
    if (locked) return;
    if (t !== "full") hd = false; // half-drop only exists for a tile that repeats on all sides
    setRt(t); setHalfDrop(hd);
    const repeat = t === "mural" ? "none" : t === "sideways" ? "horizontal" : hd ? "halfdrop" : "both";
    try {
      const id = await getId(); if (!id) return;
      const m = designRef.current.meta ?? {};
      const changed = repeatTypeOf(designRef.current.kind, designRef.current.repeat) !== t || (designRef.current.repeat === "halfdrop") !== hd;
      const d = m.autoDetect;
      const autoOk = !!d && ((t === "full" && !hd && d.seamless) || (t === "sideways" && (d.seamless || d.sideways)));
      const check = changed ? (autoOk ? { confirmed: true, auto: true, style: repeat, at: new Date().toISOString() } : null) : undefined;
      await api(`designer/uploads/${id}`, { body: { kind: t === "mural" ? "mural" : "repeating", repeat, meta: { ...m, repeatChosen: true, ...(check !== undefined ? { repeatCheck: check } : {}) } } });
      onChanged();
    } catch (e: any) { s.setMsg({ ok: false, text: e.message || "Could not save the repeat type." }); }
  }
  async function autoTag(silent = false) {
    const src = design.colors[0]?.preview; if (!src) { if (!silent) setTagMsg("Upload the artwork first."); return; }
    try {
      setTagMsg("Looking at your design…");
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = src; await img.decode();
      const c = document.createElement("canvas"); const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight)); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const r = await api("ai/tag", { body: { image: c.toDataURL("image/jpeg", 0.82), rooms: ROOMS, styles: CATS, madeFor: basic.madeFor.join(", ") } });
      const rooms = canonicalRooms(r.rooms ?? []).filter((x: string) => ROOMS.includes(x));
      if (r.kidsFriendly && ROOMS.includes("Kids & nursery") && !rooms.includes("Kids & nursery")) rooms.push("Kids & nursery");
      const cats = canonicalCategories(r.styles ?? []).filter((x: string) => CATS.includes(x));
      if (r.kidsFriendly && CATS.includes("Kids & nursery") && !cats.includes("Kids & nursery")) cats.push("Kids & nursery");
      setBasic((b: any) => ({ ...b, madeFor: [...new Set([...b.madeFor, ...rooms])], categories: [...new Set([...b.categories, ...cats])], story: b.story || r.summary || "" }));
      setTagMsg(`Filled in: rooms ${rooms.join(", ") || "-"}; style ${cats.join(", ") || "-"}. Change anything you like.`);
    } catch (e: any) { setTagMsg(silent ? "" : (e.message || "Auto-tagging failed.")); }
  }
  useEffect(() => { if (tagAi?.tagging && hasArtNow() && !basic.categories.length && !basic.madeFor.length && !meta.aiTagged) void autoTag(true); }, [tagAi?.tagging, design.colors.length]);
  function hasArtNow() { return design.colors.length > 0 && !!design.colors[0]?.preview; }
  const hasArt = design.colors.length > 0 && design.colors.every((c: any) => c.original);
  const sizeSet = !!design.widthCm;
  const repeatOk = design.kind === "mural" || !!meta.repeatCheck?.confirmed;
  const mocksOk = design.colors.some((c: any) => c.mockups.length > 0);
  const submitted = !!design.submittedAt;
  const cur = design.colors[active];
  const [localPrev, setLocalPrev] = useState<string | null>(null);
  const basicRef = useRef(basic); basicRef.current = basic;
  // the first file arrived (maybe on a freshly made draft): show its colorway, not an empty upload box
  const hadColors = useRef(design.colors.length > 0);
  useEffect(() => { if (!hadColors.current && design.colors.length > 0) { hadColors.current = true; setAdding(false); setActive(0); } }, [design.colors.length]);
  // the name typed or taken from the file name shows up after a reload of the draft too
  useEffect(() => { if (!basic.title && design.title && design.title !== "Untitled design") setBasic((b: any) => ({ ...b, title: design.title })); }, [design.title]);
  // every colorway gets a swatch ball cut from its own picture: a nice-size piece from the middle, movable later
  const cropDone = useRef(new Set<string>());
  useEffect(() => {
    for (const c of design.colors) {
      if (c.swatchCrop || !c.original?.width || !c.original?.height || cropDone.current.has(c.id)) continue;
      cropDone.current.add(c.id);
      api(`designer/colorways/${c.id}`, { body: { swatchCrop: defaultCrop(c.original.width / c.original.height, design.kind === "mural") } }).then(() => onChanged()).catch(() => {});
    }
  }, [design.colors.map((c: any) => c.id + (c.swatchCrop ? 1 : 0)).join()]);
  const chips = (list: string[], on: (x: string) => boolean, flip: (x: string) => void) => <div className="de-chips">{list.map((r) => <button key={r} type="button" aria-pressed={on(r)} className={"de-chip" + (on(r) ? " on" : "")} onClick={() => flip(r)}>{r}</button>)}</div>;
  const flipRoom = (r: string) => setBasic((b: any) => ({ ...b, madeFor: b.madeFor.includes(r) ? b.madeFor.filter((x: string) => x !== r) : [...b.madeFor, r] }));
  const flipCat = (r: string) => setBasic((b: any) => ({ ...b, categories: b.categories.includes(r) ? b.categories.filter((x: string) => x !== r) : [...b.categories, r] }));
  const det = meta.autoDetect;
  const detType: RepeatType | null = det ? (det.seamless ? "full" : det.sideways ? "sideways" : "mural") : null;
  const todo = [[hasArt, "Artwork"], [!!basic.title?.trim(), "Name"], [sizeSet, "Size"], ...(rt !== "mural" ? [[repeatOk, "Repeat check"]] : []), [mocksOk, "Room pictures"]] as [boolean, string][];
  return <div className="de" data-testid="design-form">
    <div className="de-head">
      <div className="de-head-main">{!page && <h2 className="de-title">{basic.title || (design.id ? "Untitled design" : "New design")}</h2>}
        <div className="bo-sub de-meta"><span className={"de-pill " + (submitted ? (design.review === "approved" ? "ok" : design.review === "rejected" ? "bad" : "rev") : "draft")}>{submitted ? (design.review === "approved" ? "Live in the shop" : design.review === "rejected" ? "Changes needed" : "In review") : "Draft"}</span>{design.sku ? <span className="de-sku">{design.sku}</span> : null}{design.reviewNote ? <span className="de-note">Studio note: {design.reviewNote}</span> : null}</div></div>
      <span className={"de-saved" + (saved ? " " + saved : "")} role="status">{saved === "saving" ? "Saving…" : saved === "saved" ? "All changes saved" : saved === "error" ? "Not saved, check your connection" : ""}</span>
      {onClose && !page && <button type="button" className="bo-btn sm de-close" onClick={onClose}><X size={16} aria-hidden="true" /><span>Close</span></button>}
    </div>
    <Msg m={s.msg} />
    <div className="de-grid">
      <section className="de-art" aria-label="Artwork and colorways">
        <RepeatPreview src={cur?.preview ?? localPrev ?? undefined} type={rt} halfDrop={halfDrop} />
        <div className="de-lbl de-lbl-cw">Colorways <span className="bo-sub">({design.colors.length} of 6{design.colors.length > 1 ? ", the first is the main picture" : ""})</span></div>
        <div className="de-cws" role="tablist">
          {design.colors.map((c: any, i: number) => <button key={c.id} type="button" role="tab" aria-selected={!adding && i === active} className={"de-cw" + (!adding && i === active ? " on" : "")} onClick={() => { setActive(i); setAdding(false); }} title={c.name}>
            {c.preview ? <b className="de-ball" style={ballStyle(c)} /> : <span className="de-cw-empty" />}<span>{c.name}</span></button>)}
          {design.colors.length < 6 && <button type="button" className={"de-cw add" + (adding ? " on" : "")} onClick={() => setAdding(true)} data-testid="add-colorway"><span className="de-cw-plus">+</span><span>Add colorway</span></button>}
        </div>
        {adding || !cur
          ? <div className="de-panel"><ColorRow key={"new" + design.colors.length} design={design} color={null} index={design.colors.length} getId={getId} rules={rules} onLocal={setLocalPrev} onFirstFile={(fn) => { if (basicRef.current.title?.trim()) return; const t = niceFileName(fn); setBasic((b: any) => ({ ...b, title: t })); getId().then((id) => id && api(`designer/uploads/${id}`, { body: { title: t } })).catch(() => {}); }} onChanged={() => { setActive(design.colors.length); setAdding(false); onChanged(); }} />
              {design.colors.length < 6 && (design.id ? <DriveFolderPicker design={design} onChanged={onChanged} /> : <p className="bo-sub" style={{ marginTop: 6 }}>Have several colorways in a Google Drive folder? Upload the first one, then import the folder here.</p>)}</div>
          : <div className="de-panel"><ColorRow key={cur.id} design={design} color={cur} index={active} getId={getId} rules={rules} onLocal={setLocalPrev} onChanged={onChanged} /></div>}
        {det && detType && detType !== rt && !locked && <div className="bo-msg" style={{ marginTop: 8 }}>The edges of your file look like <b>{REPEAT_TYPES.find((x) => x.id === detType)!.title.toLowerCase()}</b>. <button type="button" className="bo-link" onClick={() => chooseType(detType)}>Use that</button></div>}
      </section>
      <section className="de-fields" aria-label="Design details">
        <div className="de-box de-basics"><div className="de-h">Name and repeat</div>
        <Field label="Design name"><input className="bo-in" value={basic.title} onChange={(e) => setBasic({ ...basic, title: e.target.value })} placeholder="e.g. Cranes at Dusk" /></Field>
        <div className="de-lbl">Repeat type{locked ? <span className="bo-sub"> · live designs: ask the studio to change it</span> : null}</div>
        <div className="de-types" role="radiogroup" aria-label="Repeat type">{REPEAT_TYPES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={rt === t.id} disabled={locked && rt !== t.id} data-testid={`rt-${t.id}`} className={"de-type" + (rt === t.id ? " on" : "")} onClick={() => chooseType(t.id)}><RepeatIcon t={t.id} /><b>{t.title}</b><span>{t.sub}</span></button>)}</div>
        {rt !== "mural" && <div className="de-seg" role="radiogroup" aria-label="Match" data-testid="match-control"><MatchLabel />{[["straight", "Straight"], ["halfdrop", "Half-drop"]].map(([v, l]) => { const hdBlocked = v === "halfdrop" && rt !== "full"; const on = rt === "full" ? (v === "halfdrop") === halfDrop : v === "straight"; return <button key={v} type="button" role="radio" aria-checked={on} disabled={locked || hdBlocked} title={hdBlocked ? "Half-drop needs a tile that repeats on all sides and was drawn as half-drop" : undefined} data-testid={`match-${v}`} className={on ? "on" : ""} onClick={() => { if (rt === "full") void chooseType("full", v === "halfdrop"); }}>{l}</button>; })}</div>}
        {rt === "sideways" && <p className="bo-sub de-hdnote" data-testid="halfdrop-note" style={{ margin: "6px 0 0" }}>Half-drop needs a tile that repeats on all sides and was drawn as half-drop.</p>}
        {rt === "full" && halfDrop && <p className="bo-sub de-hdnote" data-testid="halfdrop-note" style={{ margin: "6px 0 0" }}>Only pick Half-drop if your tile was drawn as a half-drop. Customers can't change it; check the 2×2 picture in the Seamless check below.</p>}
        </div>
        {hasArt ? <SizeStep key={rt} design={design} rules={rules} onChanged={onChanged} /> : <div className="de-box"><div className="de-h">Size</div><p className="bo-sub" style={{ margin: 0 }}>{rt === "mural" ? "Set the wall size the mural was made for" : rt === "sideways" ? "Set the repeat width and the design height (the tallest wall it fits)" : "Set the size of one repeat"} once the artwork is uploaded.</p></div>}
        {hasArt && <VarietiesBox design={design} getId={getId} onChanged={onChanged} />}
        {hasArt && rt !== "mural" && <RepeatStep design={design} onChanged={onChanged} />}
        <div className="de-box"><div className="de-h">Where it fits</div>
          <div className="de-lbl">Good for rooms</div>{chips(ROOMS, (r) => basic.madeFor.includes(r), flipRoom)}
          <div className="de-lbl">Style</div>{chips(STYLES, (r) => basic.categories.includes(r), flipCat)}
          <div className="de-lbl">Theme / subject</div>{chips(THEMES, (r) => basic.categories.includes(r), flipCat)}
          {tagAi?.tagging && hasArtNow() && <div className="bo-row" style={{ marginTop: 8 }}><button type="button" className="bo-btn sm" onClick={() => autoTag(false)}>Fill in rooms and style with AI</button>{tagMsg && <span className="bo-sub">{tagMsg}</span>}</div>}
        </div>
        <RecommendedFinishBox design={design} value={rec} onChange={setRec} />
        <div className="de-box"><div className="de-h">Words</div>
          <Field label="Short description" hint="One or two sentences under the price."><textarea className="bo-ta" rows={2} maxLength={600} value={basic.description} onChange={(e) => setBasic({ ...basic, description: e.target.value })} placeholder="e.g. Soft sage leaves on a warm cream ground, painted by hand in watercolor." /></Field>
          <Field label="The story behind it" hint="Shown in its own section on the design page."><textarea className="bo-ta" rows={3} value={basic.story} onChange={(e) => setBasic({ ...basic, story: e.target.value })} placeholder="What inspired it? Customers love knowing the story." /></Field>
          <div className="bo-grid2"><Field label="Main colors (optional)"><input className="bo-in" value={basic.palette} onChange={(e) => setBasic({ ...basic, palette: e.target.value })} placeholder="sage, cream, gold" /></Field>
            <Field label="Keywords (optional)"><input className="bo-in" value={basic.tags} onChange={(e) => setBasic({ ...basic, tags: e.target.value })} placeholder="leaves, tropical" /></Field></div>
          <div className="bo-grid2"><Field label="Notes for printing (optional)" hint="Only the studio sees this."><input className="bo-in" value={basic.notes} onChange={(e) => setBasic({ ...basic, notes: e.target.value })} placeholder="color profile, bleed…" /></Field>
            <Field label="Suggested price / sq ft" hint="Empty = the shop's standard price."><input className="bo-in" type="number" step="0.25" min="0" value={suggest} onChange={(e) => setSuggest(e.target.value)} placeholder="5.50" /></Field></div>
        </div>
      </section>
    </div>
    {hasArt && sizeSet && <MockupStep design={design} onChanged={onChanged} />}
    <div className="de-bar">
      <div className="de-todo" aria-label={`${todo.filter(([ok]) => ok).length} of ${todo.length} steps done`}>{todo.map(([ok, l], i) => <span key={l} className={ok ? "ok" : ""}><i aria-hidden="true">{ok ? "✓" : i + 1}</i>{l}</span>)}</div>
      {submitted ? <div className="bo-row"><Pill tone={design.review === "approved" ? "ok" : "warn"}>{design.review === "approved" ? "Live" : "Sent for review"}</Pill><button type="button" className="bo-btn sm danger de-quiet" onClick={() => confirm("Remove this design? It disappears from the shop and from your list. The studio keeps a copy and can bring it back.") && s.run(async () => { await api(`designer/uploads/${design.id}`, { method: "DELETE" }); onClose?.(); }, "Removed")}>Remove</button></div>
        : <div className="bo-row">{design.id && <button type="button" className="bo-btn sm danger de-quiet" onClick={() => confirm("Delete this draft? The studio keeps a copy and can bring it back.") && s.run(async () => { await api(`designer/uploads/${design.id}`, { method: "DELETE" }); onClose?.(); }, "Deleted")}>Delete draft</button>}
          {!s.busy && (!hasArt || !basic.title?.trim() || !sizeSet || !repeatOk) ? <span className="de-why">Finish the steps to submit</span> : null}
          <button className="bo-btn pri de-submit" data-testid="submit-design" disabled={s.busy || !hasArt || !basic.title?.trim() || !sizeSet || !repeatOk} onClick={() => s.run(async () => { const r = await api(`designer/uploads/${design.id}/submit`, { body: {} }); onChanged(); return r; }, "Sent. The studio will review it.")}>Submit for review</button></div>}
    </div>
  </div>;
}

/** "jungle_leaves-v2.tif" → "jungle leaves v2" */
export const niceFileName = (file: string) => { const t = file.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60); return t.replace(/\b\w/g, (m) => m.toUpperCase()); };
/** A nice-size round piece from the middle of the picture: half the shorter side for repeats, a third for murals. */
export function defaultCrop(aspect: number, mural: boolean) {
  const k = mural ? 0.34 : 0.5;
  const w = aspect >= 1 ? k / aspect : k, h = aspect >= 1 ? k : k * aspect;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
/** The colorway ball exactly as the shop shows it. */
export function ballStyle(c: any): Record<string, string> {
  if (!c?.preview) return {};
  const flat = c.swatchCrop?.mode === "color" && c.swatch;
  return swatchStyle({ id: c.id, name: c.name, image: c.preview, swatch: flat ? c.swatch : `url("${c.preview}")`, crop: flat ? undefined : c.swatchCrop ?? undefined });
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Drag the circle over the design to choose the piece shown in the colorway ball; the slider sets how big the piece is. */
function SwatchCropper({ color, mural, onSave }: { color: any; mural: boolean; onSave: (c: any) => void }) {
  const aspect = color.original?.width && color.original?.height ? color.original.width / color.original.height : 1;
  const [c, setC] = useState(() => (color.swatchCrop && color.swatchCrop.mode !== "color" ? { x: color.swatchCrop.x, y: color.swatchCrop.y, w: color.swatchCrop.w, h: color.swatchCrop.h } : defaultCrop(aspect, mural)));
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<any>(null);
  const k = aspect >= 1 ? c.h : c.w;
  const setK = (nk: number) => setC((p) => { const cx = p.x + p.w / 2, cy = p.y + p.h / 2; const w = Math.min(1, aspect >= 1 ? nk / aspect : nk), h = Math.min(1, aspect >= 1 ? nk : nk * aspect); return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h }; });
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (dragging) return; const t = setTimeout(() => onSave(c), 500); return () => clearTimeout(t); }, [c, dragging]);
  const H = 220;
  return <div className="de-crop">
    <div className="de-crop-img" ref={box} style={{ aspectRatio: String(aspect), width: `min(100%, ${Math.round(H * aspect)}px)` }}
      onPointerDown={(e) => { const r = box.current!.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        // tap anywhere to centre the piece there, then drag
        const start = (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) ? c : { ...c, x: clamp(px - c.w / 2, 0, 1 - c.w), y: clamp(py - c.h / 2, 0, 1 - c.h) };
        setC(start); drag.current = { sx: e.clientX, sy: e.clientY, x0: start.x, y0: start.y, W: r.width, H: r.height }; setDragging(true); (e.currentTarget as any).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; setC((p) => ({ ...p, x: clamp(d.x0 + (e.clientX - d.sx) / d.W, 0, 1 - p.w), y: clamp(d.y0 + (e.clientY - d.sy) / d.H, 0, 1 - p.h) })); }}
      onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
      <img src={color.preview} alt="" draggable={false} />
      <i style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", pointerEvents: "none" }} />
      <div className="de-crop-sq" data-testid="swatch-crop" style={{ ...ballStyle({ ...color, swatchCrop: c }), boxSizing: "border-box", border: "2px solid #fff", outline: "2px solid rgba(0,0,0,.35)", left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} />
    </div>
    <div className="de-crop-side">
      <b className="de-ball lg" style={ballStyle({ ...color, swatchCrop: c })} aria-label="Swatch ball as customers see it" />
      <label className="bo-sub" style={{ textAlign: "center" }}>Piece size<br /><input type="range" min={0.1} max={1} step={0.01} value={k} onChange={(e) => setK(+e.target.value)} aria-label="Swatch piece size" data-testid="swatch-zoom" /></label>
    </div>
  </div>;
}

/** The designer's recommended finish(es) + a short note for customers. Saved by the editor's autosave. */
function RecommendedFinishBox({ design, value, onChange }: { design: any; value: { ids: string[]; note: string }; onChange: (v: { ids: string[]; note: string }) => void }) {
  const { data: shop } = useQuery(shopQuery);
  const all = resolvedMaterials(shop?.materialSettings);
  const offered: { id: string; name: string }[] = design.varieties?.length
    ? (design.varieties as any[]).map((v) => { const m = all.find((x) => x.id === v.id); return m ? { id: m.id, name: v.name || m.name } : null; }).filter((x): x is { id: string; name: string } => !!x)
    : all.map((m) => ({ id: m.id, name: m.name }));
  if (!offered.length) return null;
  const ids = value.ids.filter((x) => offered.some((o) => o.id === x));
  const flip = (id: string) => onChange({ ...value, ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  return <div className="de-box de-rec" data-testid="recommended-finish">
    <div className="de-h">Recommended finish <span className="bo-sub" style={{ fontWeight: 400 }}>· optional</span></div>
    <p className="bo-sub de-rec-hint">Does this design look best on a certain finish? Tap one or more. Customers see a <b>Recommended by the designer</b> tag on it, and the first one you tap is picked for them. They can still choose any finish.</p>
    <div className="de-chips" role="group" aria-label="Recommended finish">{offered.map((o) => { const on = ids.includes(o.id); return <button key={o.id} type="button" aria-pressed={on} className={"de-chip" + (on ? " on" : "")} onClick={() => flip(o.id)}>{o.name}</button>; })}</div>
    <Field label="Note for customers (optional)" hint={`Shown under the finish choices on the design page · ${value.note.length}/120`}><input className="bo-in" maxLength={120} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="e.g. Best on textured canvas for the brush look" data-testid="rec-note" /></Field>
  </div>;
}
/** Finishes ("varieties") the design is offered in: all of the shop's finishes by default; untick to leave one out, rename it, or give it its own sample picture. */
function VarietiesBox({ design, onChanged, getId }: { design: any; onChanged: () => void; getId: () => Promise<string> }) {
  const { data: shop } = useQuery(shopQuery);
  const all = resolvedMaterials(shop?.materialSettings);
  const key = JSON.stringify(design.varieties ?? []);
  const [list, setList] = useState<any[]>(design.varieties ?? []);
  useEffect(() => setList(design.varieties ?? []), [key]);
  const [msg, setMsg] = useState("");
  const full = list.length ? list : all.map((m) => ({ id: m.id }));
  const save = async (next: any[]) => {
    const clean = next.map((v) => ({ id: v.id, name: v.name || undefined, image: v.image || undefined }));
    const plain = clean.length === all.length && clean.every((v) => !v.name && !v.image);
    setList(plain ? [] : next); setMsg("");
    try { const id = await getId(); await api(`designer/uploads/${id}`, { body: { varieties: plain ? [] : clean } }); setMsg("Saved"); onChanged(); } catch (e: any) { setMsg(e.message || "Could not save"); }
  };
  const flip = (id: string) => { const has = full.some((v) => v.id === id); if (has && full.length === 1) return; save(has ? full.filter((v) => v.id !== id) : [...full, { id }]); };
  const setField = (id: string, patch: any) => save(full.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  if (!all.length) return null;
  return <div className="de-box" data-testid="varieties">
    <div className="de-h">Finishes offered <span className="bo-sub" style={{ fontWeight: 400 }}>· all on by default{msg ? ` · ${msg}` : ""}</span></div>
    <div className="de-vars">
      {all.map((m) => { const v = full.find((x) => x.id === m.id); const on = !!v; const pic = v?.imageUrl || (v?.image && v.image.startsWith("blob:") ? v.image : "") || m.texture;
        return <div key={m.id} className={"de-var" + (on ? "" : " off")}>
          <input type="checkbox" checked={on} onChange={() => flip(m.id)} aria-label={`Offer ${m.name}`} />
          <label className="de-var-img" title="Add your own sample picture (optional)">{pic ? <img src={pic} alt="" /> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!on} aria-label={`Sample picture for ${m.name}`} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setMsg("Uploading…"); const id = await getId(); const k = (await uploadFile(f, { uploadId: id, purpose: "mockup", filename: "variety-" + m.id + ".jpg" }, () => {})).key; setField(m.id, { image: k, imageUrl: URL.createObjectURL(f) }); } catch (er: any) { setMsg(er.message); } }} /></label>
          <input className="bo-in" disabled={!on} defaultValue={v?.name ?? ""} key={m.id + (v?.name ?? "")} placeholder={m.name} aria-label={`Name for ${m.name}`} onBlur={(e) => on && (e.target.value.trim() || undefined) !== (v?.name || undefined) && setField(m.id, { name: e.target.value.trim() })} />
        </div>; })}
    </div>
  </div>;
}

function ColorRow({ design, color, index, onChanged, getId, rules, onLocal, onFirstFile }: { design: any; color: any; index: number; onChanged: () => void; getId: () => Promise<string>; rules?: any; onLocal?: (url: string | null) => void; onFirstFile?: (filename: string) => void }) {
  const [sw, setSw] = useState<string>(color?.swatch || "#cccccc");
  const [rowMsg, setRowMsg] = useState("");
  const flat = color?.swatchCrop?.mode === "color";
  const [showReplace, setShowReplace] = useState(false);
  const edit = async (body: any, okText = "Saved") => { setRowMsg(""); try { await api(`designer/colorways/${color.id}`, body === "DELETE" ? { method: "DELETE" } : { body }); setRowMsg(okText); onChanged(); } catch (er: any) { setRowMsg(er.message); } };
  const [name, setName] = useState(color?.name ?? (design.colors.length ? `Color ${design.colors.length + 1}` : "Original"));
  const [prog, setProg] = useState<{ done: number; total: number; label: string } | null>(null);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");
  const [info, setInfo] = useState("");
  const [link, setLink] = useState("");
  const [needPreview, setNeedPreview] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function attach(orig: any, previewBlob: Blob | null, uid?: string) {
    const id = uid || (await getId());
    let previewKey: string;
    if (previewBlob) previewKey = (await uploadFile(previewBlob, { uploadId: id, purpose: "preview", filename: "preview.jpg" }, () => {})).key;
    else throw new Error("no preview");
    const dims = orig.dims;
    const autoSw = color?.swatch ? undefined : (await dominantColor(previewBlob)) ?? undefined;
    await api(`designer/uploads/${id}/colorways`, { body: { colorwayId: color?.id, name, swatch: autoSw, sourceName: orig.filename, previewKey, originalKey: orig.key, filename: orig.filename, mime: orig.mime, size: orig.size, width: dims?.width, height: dims?.height, dpi: dims?.vector ? null : dims?.dpi } });
    if (!design.colors.length || color?.position === 0) {
      // auto-detect: do the edges join like a repeat?
      try {
        const url = URL.createObjectURL(previewBlob);
        const r = await checkRepeat(url, "both"); URL.revokeObjectURL(url);
        const seamless = r.lr.ok && !!r.tb?.ok, sideways = r.lr.ok && !r.tb?.ok;
        const m: any = { ...(design.meta ?? {}), autoDetect: { seamless, sideways, lr: r.lr.score, tb: r.tb?.score } };
        // the designer's own choice wins; otherwise start from what the edges say
        const chosen = !!design.meta?.repeatChosen || design.review === "approved";
        const t: RepeatType = chosen ? repeatTypeOf(design.kind, design.repeat) : seamless ? "full" : sideways ? "sideways" : "mural";
        const pick = chosen ? {} : { kind: t === "mural" ? "mural" : "repeating", repeat: t === "mural" ? "none" : t === "sideways" ? "horizontal" : "both" };
        // edges already checked: a clean join confirms the repeat on its own
        if (!m.repeatCheck?.confirmed && ((t === "full" && design.repeat !== "halfdrop" && seamless) || (t === "sideways" && r.lr.ok))) m.repeatCheck = { confirmed: true, auto: true, lr: r.lr, tb: r.tb, style: t === "sideways" ? "horizontal" : "both", at: new Date().toISOString() };
        // a starting size from the file (sharp print size); the designer can change it
        let size: any = {};
        if (!design.widthCm && dims?.width && dims?.height) {
          // the size the file was built for: the DPI saved in the file wins; vector files are any size
          const fileDpi = dims.vector ? 72 : dims.dpi && dims.dpi >= 50 && dims.dpi <= 1200 ? dims.dpi : 0;
          const dpi = fileDpi || (t === "mural" ? (rules?.minDpi || 150) : (rules?.targetDpi || 150));
          const wcm = Math.round((dims.width / dpi) * 25.4) / 10, hcm = Math.round((dims.height / dpi) * 25.4) / 10;
          const big = dims.vector ? { maxWidthCm: VECTOR_MAX_CM, maxHeightCm: Math.round(VECTOR_MAX_CM * dims.height / dims.width) } : { maxWidthCm: wcm, maxHeightCm: hcm };
          size = t === "mural" ? { widthCm: wcm, heightCm: hcm, ...big } : { widthCm: wcm, heightCm: hcm };
          m.fileDpi = dims.vector ? null : (fileDpi || null); m.vector = !!dims.vector;
          if (t === "mural") { m.originalWidthCm = wcm; m.originalHeightCm = hcm; }
          m.unit = m.unit ?? (t === "mural" ? "ft" : "in");
        }
        await api(`designer/uploads/${id}`, { body: { ...pick, ...size, meta: m } });
      } catch {}
    }
    onChanged();
  }
  async function fromFile(f: File) {
    setErr("");
    try {
      const dims = await readDims(f);
      setWarn("");
      // print-quality check: a 52-inch print panel at 150 DPI needs 7,800 px across
      if (dims?.width && dims?.height && !dims.vector) {
        const long = Math.max(dims.width, dims.height);
        if (long < 1500) { setErr(`This file is only ${dims.width} × ${dims.height} px, too small to print sharply. Please upload the full-resolution original (at least 7,800 px wide for one 52-inch panel at 150 DPI).`); return; }
        const sharpIn = Math.floor(dims.width / 150);
        if (design.kind === "mural" && dims.width < 7800) setWarn(`Heads up: ${dims.width} px wide prints sharp (150 DPI) up to about ${sharpIn} in wide, less than one 52-inch panel. Murals usually cover several panels, so a larger file will print much better.`);
        else if (dims.width < 2400) setWarn(`Heads up: ${dims.width} px wide prints sharp (150 DPI) up to about ${sharpIn} in per repeat. A larger file keeps the pattern crisp.`);
      }
      setProg({ done: 0, total: f.size, label: `Uploading ${f.name}` });
      // show the design right away, before the big file has finished uploading
      let preview: Blob | null = null;
      try { preview = await makePreview(f, dims); } catch { preview = null; }
      if (preview) onLocal?.(URL.createObjectURL(preview));
      if (!design.colors.length) onFirstFile?.(f.name);
      const id = await getId();
      const orig = await uploadFile(f, { uploadId: id, purpose: "original" }, (d, t) => setProg({ done: d, total: t, label: `Uploading ${f.name}` }));
      orig.dims = orig.dims ?? dims;
      setProg({ done: 1, total: 1, label: "Saving…" });
      if (!preview) { setNeedPreview(orig); setProg(null); return; }
      await attach(orig, preview, id); setProg(null);
    } catch (e: any) { setErr(e.message); setProg(null); }
  }
  const [folder, setFolder] = useState<{ id: string; name: string; link: string }[] | null>(null);
  async function fromDrive(l = link) {
    setErr("");
    try {
      if (/\/folders\//.test(l)) { setFolder(await driveFolder(l.trim())); return; }
      setFolder(null);
      const id = await getId();
      const orig: any = await driveImport(l.trim(), id, (d, t, n) => setProg({ done: d, total: t, label: `Copying ${n} from Google Drive into our storage` }));
      setProg({ done: 0, total: 1, label: "Making the shop picture from your file…" });
      let preview: Blob | null = null;
      try { preview = await previewFromStored(orig.key, orig.mime, orig.size, orig.dims, (x) => setProg({ done: x, total: 1, label: "Making the shop picture from your file…" })); } catch (e: any) { setErr(e.message); preview = null; }
      if (!preview) { setNeedPreview(orig); setProg(null); return; }
      await attach(orig, preview, id); setProg(null); setLink("");
    } catch (e: any) { setErr(e.message); setProg(null); }
  }
  const o = color?.original;
  const picker = <>
    <input ref={fileRef} type="file" hidden accept="image/*,.tif,.tiff,.psd,.pdf,.svg,.ai,.eps" onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
    {!color ? <button type="button" className="de-drop" data-testid="upload-art" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void fromFile(f); }}>
        <i className="de-drop-ico" aria-hidden="true"><UploadCloud size={26} /></i><b>{design.colors.length ? "Upload this colorway's print file" : "Upload your print file"}</b><span>JPG, PNG, TIFF, PSD or PDF, full resolution. Drop it here or tap to choose.</span><em className="de-drop-btn" aria-hidden="true">Choose file</em></button>
      : <button type="button" className="bo-btn sm" onClick={() => fileRef.current?.click()}>Replace file</button>}
    <div className="bo-row" style={{ marginTop: 8, flexWrap: "nowrap" }}><input className="bo-in" style={{ flex: 1 }} placeholder="or paste a Google Drive link" value={link} onChange={(e) => setLink(e.target.value)} /><button type="button" className="bo-btn" disabled={!link.trim()} onClick={() => fromDrive()}>Import</button></div>
  </>;
  return <div className="de-cwp">
    {color?.preview && <SwatchCropper key={color.id} color={color} mural={design.kind === "mural"} onSave={(c) => edit({ swatchCrop: flat ? { ...c, mode: "color" } : c }, "Swatch saved")} />}
    <div className="bo-row" style={{ flexWrap: "nowrap" }}>
      <input className="bo-in" style={{ flex: 1 }} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => color && name.trim() && name !== color.name && edit({ name }, "Name saved")} aria-label="Colorway name" placeholder="Colorway name, e.g. Sage & Blush" data-testid="colorway-name" />
      {color && index > 0 && <button type="button" className="bo-btn sm" onClick={() => edit({ first: true }, "Now the main colorway")} title="Make this the main picture">Make main</button>}
      {color && design.colors.length > 1 && <button type="button" className="bo-btn sm danger" onClick={() => confirm(`Remove the colorway "${color.name}"?`) && edit("DELETE", "Removed")} aria-label="Remove colorway">Remove</button>}
    </div>
    {color?.preview && <label className="bo-sub" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
      <input type="checkbox" checked={flat} onChange={(e) => edit({ swatch: sw, swatchCrop: { ...(color.swatchCrop ?? defaultCrop(1, false)), mode: e.target.checked ? "color" : undefined } }, e.target.checked ? "Flat color ball on" : "Picture ball on")} />
      Optional: show a flat color ball instead
      {flat && <input type="color" className="bo-swatch" value={sw} onChange={(e) => setSw(e.target.value)} onBlur={() => sw !== color.swatch && edit({ swatch: sw }, "Color saved")} aria-label="Ball color" />}
    </label>}
    {rowMsg && <div className="bo-sub" style={{ marginTop: 4 }}>{rowMsg}</div>}
    {o && <div className="bo-sub" style={{ marginTop: 6 }}>Print file: {o.filename} · {fmtBytes(o.size)}{o.width ? ` · ${o.width} × ${o.height} px` : ""}</div>}
    {!prog && (!color ? <div style={{ marginTop: 8 }}>{picker}</div> : showReplace ? <div style={{ marginTop: 8 }}>{picker}</div> : <button type="button" className="bo-link bo-sub" style={{ marginTop: 4 }} onClick={() => setShowReplace(true)}>Replace this colorway's print file</button>)}
        {prog && <div style={{ marginTop: 8 }}><div className="bo-sub">{prog.label} {prog.total > 1 ? `· ${fmtBytes(prog.done)} of ${fmtBytes(prog.total)} (${Math.floor((prog.done / prog.total) * 100)}%)` : prog.done > 0 ? `${Math.floor(prog.done * 100)}%` : ""}</div><div className="bo-prog"><i style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div></div>}
        {folder && !prog && <div className="bo-msg" style={{ marginTop: 8 }}>Files in this folder. Pick one for this color:{folder.map((x) => <div key={x.id} className="bo-row" style={{ marginTop: 6 }}><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span><button className="bo-btn sm" onClick={() => fromDrive(x.link)}>Import</button></div>)}</div>}
        {needPreview && <div className="bo-msg" style={{ marginTop: 8 }}>Your print file is saved ({fmtBytes(needPreview.size)}). This file type is too big to preview in the browser, so please add a JPG of the same design for the shop picture:
          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "block", marginTop: 6 }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const p = await makePreview(f, await readDims(f)); await attach(needPreview, p); setNeedPreview(null); } catch (er: any) { setErr(er.message); } }} /></div>}
        {err && <div className="bo-msg bad" style={{ marginTop: 8 }}>{err}</div>}
        {warn && !err && <div className="bo-msg" data-testid="dpi-warn" style={{ marginTop: 8, background: "#fff8e6", color: "#7a5300" }}>{warn}</div>}
  </div>;
}

function SizeStep({ design, rules, onChanged }: { design: any; rules: any; onChanged: () => void }) {
  const s = useSaver();
  const o = design.colors[0]?.original ?? {};
  const pxW = o.width || 0, pxH = o.height || 0;
  const mural = design.kind === "mural";
  const meta = design.meta ?? {};
  const [unit, setUnit] = useState<string>(meta.unit ?? (design.kind === "mural" ? "ft" : "in"));
  const u = UNITS[unit];
  const init = (cm: number | null | undefined) => (cm ? r1(cm / u) : "");
  // nothing saved yet: start from the size the file prints sharp at (the designer can change it)
  const sharpCm = !design.widthCm && pxW && rules?.targetDpi ? (pxW / rules.targetDpi) * 2.54 : 0;
  const [orig, setOrig] = useState<{ w: any; h: any }>({ w: init(meta.originalWidthCm ?? design.widthCm ?? (sharpCm || null)), h: init(meta.originalHeightCm ?? design.heightCm ?? (sharpCm && pxW ? sharpCm * pxH / pxW : null)) });
  const [max, setMax] = useState<{ w: any; h: any }>({ w: init(design.maxWidthCm), h: init(design.maxHeightCm) });
  const [note, setNote] = useState("");
  useEffect(() => { setOrig({ w: init(meta.originalWidthCm ?? design.widthCm ?? (sharpCm || null)), h: init(meta.originalHeightCm ?? design.heightCm ?? (sharpCm && pxW ? sharpCm * pxH / pxW : null)) }); setMax({ w: init(design.maxWidthCm), h: init(design.maxHeightCm) }); }, [unit]);
  const ratio = pxW && pxH ? pxH / pxW : null;
  // largest size at the target DPI (cm)
  const capW = pxW ? (pxW / rules.targetDpi) * 2.54 : null, capH = pxH ? (pxH / rules.targetDpi) * 2.54 : null;
  const origWcm = Number(orig.w) * u, origHcm = Number(orig.h) * u;
  const dpiAt = (cm: number) => (pxW && cm ? Math.round(pxW / (cm / 2.54)) : null);
  const setOrigW = (v: string) => setOrig({ w: v, h: ratio && v ? r1(Number(v) * ratio) : orig.h });
  const vector = !!meta.vector;
  const [dpi, setDpi] = useState<string>(String(meta.fileDpi ?? o.dpi ?? ""));
  const dpiN = Number(dpi) > 0 ? Number(dpi) : 0;
  // the designer's DPI is the truth for this file; the studio's lowest DPI only caps it when no DPI is confirmed
  const capDpi = dpiN ? Math.min(rules.minDpi || 150, dpiN) : (rules.minDpi || 150);
  const hardW = vector ? null : pxW ? (pxW / capDpi) * 2.54 : null;
  function applyDpi(v: string) {
    setDpi(v); const n = Number(v); if (!(n > 0) || !pxW || vector) return;
    const wcm = (pxW / n) * 2.54, hcm = (pxH / n) * 2.54;
    setOrig({ w: r1(wcm / u), h: r1(hcm / u) }); if (mural) setMax({ w: r1(wcm / u), h: r1(hcm / u) }); setNote("");
  }
  function applyMax(w: number) {
    let ww = w; let msg = "";
    if (hardW && ww * u > hardW + 0.01) { ww = hardW / u; msg = `Capped at ${r1(ww)} ${unit} wide. Bigger would print under ${rules.minDpi} DPI, the lowest the studio allows.`; }
    else if (capW && ww * u > capW + 0.01) msg = `At this size it prints at ${dpiAt(ww * u)} DPI, below the ${rules.targetDpi} DPI target. Allowed, but less sharp up close.`;
    setMax({ w: r1(ww), h: ratio ? r1(ww * ratio) : max.h }); setNote(msg);
  }
  async function save() {
    const wcm = Number(orig.w) * u, hcm = Number(orig.h) * u;
    if (!(wcm > 0 && hcm > 0)) throw new Error("Enter the size.");
    let mw = vector ? VECTOR_MAX_CM : Number(max.w) * u || (capW ? Math.min(capW, Math.max(wcm, capW)) : wcm);
    if (hardW && mw > hardW + 0.05) mw = hardW;
    const mh = ratio ? mw * ratio : Number(max.h) * u || hcm;
    await api(`designer/uploads/${design.id}`, { body: mural ? { widthCm: r1(wcm), heightCm: r1(hcm), maxWidthCm: r1(mw), maxHeightCm: r1(mh), meta: { ...meta, unit, fileDpi: dpiN || null, originalWidthCm: r1(wcm), originalHeightCm: r1(hcm) } } : { widthCm: r1(wcm), heightCm: r1(hcm), meta: { ...meta, unit, fileDpi: dpiN || null } } });
    onChanged();
  }
  const sideways = design.repeat === "horizontal";
  return <div className="de-box" data-testid="size-box"><div className="de-h">{mural ? "Mural size" : sideways ? "Repeat width and design height" : "Repeat size"}{design.widthCm ? <span className="de-ok">✓</span> : null}</div>
    <div className="bo-row" style={{ marginBottom: 8 }}><span className="bo-sub" data-testid="file-px">Your file: {vector ? <b>Vector – any size</b> : pxW ? `${pxW.toLocaleString()} × ${pxH.toLocaleString()} px${o.dpi ? ` · saved at ${o.dpi} DPI` : ""}` : "size unknown"}</span><select className="bo-sel" style={{ width: 90, marginLeft: "auto" }} value={unit} onChange={(e) => setUnit(e.target.value)}><option value="ft">feet</option><option value="in">inches</option><option value="cm">cm</option></select></div>
    <Msg m={s.msg} />
    {!vector && pxW > 0 && <div className="de-dpi" data-testid="dpi-box">
      <Field label="Print DPI of this file" hint={o.dpi ? `Read from the file: ${o.dpi} DPI. Change it if you built it for a different DPI.` : "Not saved in the file. Enter the DPI you built it at."}><input className="bo-in" type="number" min={30} max={1200} step="1" value={dpi} onChange={(e) => applyDpi(e.target.value)} data-testid="dpi-input" style={{ maxWidth: 120 }} /></Field>
      <div className="de-dpi-out" data-testid="max-print">{dpiN ? <>At {dpiN} DPI this file is <b>{r1(pxW / dpiN / (u / 2.54))} × {r1(pxH / dpiN / (u / 2.54))} {unit}</b>{mural ? " — the largest wall customers can order" : " per repeat"}.</> : <>Enter the DPI to see the print size.</>}{dpiN && dpiN < (rules.minDpi || 150) ? <div className="bo-sub">Below {rules.minDpi || 150} DPI: fine from a normal distance, softer up close.</div> : null}</div>
    </div>}
    {vector && <div className="de-dpi-out" data-testid="max-print"><b>Vector – any size.</b> Vector files are sharp on any wall at any DPI, so customers can order any size.</div>}
    {mural ? <>
      <div className="bo-grid2"><Field label={`Original wall size: width (${unit})`} hint="The wall you designed it for."><input className="bo-in" type="number" step="0.1" value={orig.w} onChange={(e) => setOrigW(e.target.value)} /></Field><Field label={`Height (${unit})`}><input className="bo-in" type="number" step="0.1" value={orig.h} onChange={(e) => setOrig({ ...orig, h: e.target.value })} /></Field></div>
      {capW && <div className="bo-sub" style={{ marginBottom: 10 }}>At {rules.targetDpi} DPI your file prints sharp up to <b>{r1(capW / u)} × {r1(capH! / u)} {unit}</b>.{origWcm ? ` At the original size it is ${dpiAt(origWcm)} DPI.` : ""}</div>}
      <div className="bo-grid2"><Field label={`Largest wall customers can order: width (${unit})`}><input className="bo-in" type="number" step="0.1" value={max.w} onChange={(e) => setMax({ w: e.target.value, h: ratio && e.target.value ? r1(Number(e.target.value) * ratio) : max.h })} onBlur={(e) => e.target.value && applyMax(Number(e.target.value))} /></Field><Field label={`Height (${unit})`}><input className="bo-in" value={max.h} readOnly={!!ratio} onChange={(e) => setMax({ ...max, h: e.target.value })} /></Field></div>
      {note && <div className="bo-msg" style={{ marginBottom: 8 }}>{note}</div>}
      <div className="bo-row"><button className="bo-btn" onClick={() => capW && applyMax(capW / u)}>Use max at {rules.targetDpi} DPI</button><button className="bo-btn" disabled={!orig.w} onClick={() => applyMax(Number(orig.w))}>Reset to original</button><button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(save, "Size saved")}>Save size</button></div>
    </> : <>
      <div className="bo-grid2"><Field label={`Repeat width (${unit})`} hint={sideways ? "Width of one repeat across the wall." : "Width of one tile on the wall."}><input className="bo-in" type="number" step="0.1" value={orig.w} onChange={(e) => setOrigW(e.target.value)} /></Field><Field label={sideways ? `Design height (${unit})` : `Repeat height (${unit})`} hint={sideways ? "The tallest wall it fits. It does not repeat upward." : undefined}><input className="bo-in" type="number" step="0.1" value={orig.h} onChange={(e) => setOrig({ ...orig, h: e.target.value })} /></Field></div>
      {origWcm > 0 && pxW > 0 && <div className="bo-sub" style={{ marginBottom: 10 }}>At this size your tile prints at {dpiAt(origWcm)} DPI {dpiAt(origWcm)! < rules.targetDpi ? <Pill tone="warn">below {rules.targetDpi} DPI: make the tile smaller or upload a bigger file</Pill> : <Pill tone="ok">sharp</Pill>}. Largest tile at {rules.targetDpi} DPI: {r1(capW! / u)} × {r1(capH! / u)} {unit}.</div>}
      <button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(save, "Size saved")}>Save size</button>
    </>}
  </div>;
}

function RepeatStep({ design, onChanged }: { design: any; onChanged: () => void }) {
  const s = useSaver();
  const meta = design.meta ?? {};
  const [res, setRes] = useState<RepeatResult | null>(null);
  const [looked, setLooked] = useState(false);
  const style = design.repeat === "horizontal" ? "horizontal" : design.repeat === "halfdrop" ? "halfdrop" : "both";
  const run = () => s.run(async () => { setLooked(false); setRes(await checkRepeat(design.colors[0].preview, style)); }, "Check done");
  // runs on its own (plain pixel math in the browser) as soon as a repeat design has a picture and isn't confirmed for this match yet
  const autoRan = useRef("");
  useEffect(() => { const key = (design.colors[0]?.preview || "") + "|" + style; if (!design.colors[0]?.preview || autoRan.current === key || (meta.repeatCheck?.confirmed && meta.repeatCheck?.style === style)) return; autoRan.current = key; void run(); }, [design.colors[0]?.preview, style]);
  const verdict = res?.verdict;
  const confirm = (forced: boolean) => s.run(async () => { await api(`designer/uploads/${design.id}`, { body: { meta: { ...meta, repeatCheck: { confirmed: true, forced, verdict, looked: forced || undefined, lr: res?.lr, tb: res?.tb, style, at: new Date().toISOString() } } } }); onChanged(); }, forced ? "Saved. You checked the 2×2 picture." : "Repeat confirmed");
  const block = async () => { try { await api(`designer/uploads/${design.id}`, { body: { meta: { ...meta, repeatCheck: { confirmed: false, verdict: "bad", lr: res?.lr, tb: res?.tb, style, at: new Date().toISOString() } } } }); onChanged(); } catch { /* the block still shows; submit is refused by the server too */ } };
  useEffect(() => { if (verdict === "bad" && (meta.repeatCheck?.confirmed || meta.repeatCheck?.verdict !== "bad")) void block(); }, [verdict]);
  const toMural = () => s.run(async () => { await api(`designer/uploads/${design.id}`, { body: { kind: "mural", repeat: "none", meta: { ...meta, repeatChosen: true, repeatCheck: null } } }); onChanged(); }, "Changed to mural");
  return <div className="de-box" data-testid="repeat-step"><div className="de-h">Seamless check{meta.repeatCheck?.confirmed ? <span className="de-ok">✓</span> : null}</div>
    <p className="bo-sub" style={{ marginTop: -4 }}>We compare the left edge with the right edge{style !== "horizontal" ? " and the top with the bottom" : ""}{style === "halfdrop" ? " (the right edge against the left edge moved down half the tile)" : ""}, colour and thin lines, to make sure the tiles join without a visible line.</p>
    <Msg m={s.msg} />
    {meta.repeatCheck?.confirmed && !res && <div className="bo-row" style={{ marginBottom: 8 }}><Pill tone={meta.repeatCheck.forced ? "warn" : "ok"}>{meta.repeatCheck.forced ? "Confirmed by you after checking the 2×2 picture" : "Repeat confirmed"}</Pill></div>}
    {res && <div style={{ marginBottom: 10 }}>
      <div className="bo-row" style={{ marginBottom: 8 }}><Pill tone={res.lr.verdict === "ok" ? "ok" : res.lr.verdict === "bad" ? "bad" : "warn"}>Left/right {res.lr.verdict === "ok" ? "match" : res.lr.verdict === "bad" ? "don't match" : "almost match"}</Pill>{res.tb && <Pill tone={res.tb.verdict === "ok" ? "ok" : res.tb.verdict === "bad" ? "bad" : "warn"}>Top/bottom {res.tb.verdict === "ok" ? "match" : res.tb.verdict === "bad" ? "don't match" : "almost match"}</Pill>}</div>
      {verdict === "bad" && <div className="bo-msg err" role="alert" data-testid="repeat-block" style={{ marginBottom: 8, background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}>The edges don't connect, so this can't be sold as a repeat. Upload it as a mural, or fix the tile edges.{style === "both" ? " If the tile was drawn as a half-drop, choose Half-drop above." : ""}</div>}
      {verdict === "borderline" && <div className="bo-msg" data-testid="repeat-warn" style={{ marginBottom: 8 }}>The edges almost match. Look at the 2×2 picture: if you see no line where the tiles meet, tick the box to confirm.</div>}
      <img src={res.tiled} alt="2 by 2 tiled preview" data-testid="repeat-tiled" style={{ width: "100%", maxWidth: 520, borderRadius: 6, border: "1px solid #e7e5e4", display: "block" }} />
      <div className="bo-sub" style={{ marginTop: 4 }} data-testid="tiled-caption">{style === "halfdrop" ? "4 tiles, the right column shifted down half a tile (half-drop). Look for lines where they meet." : "4 tiles side by side. Look for lines where they meet."}{verdict && verdict !== "ok" ? " Red / orange dashes mark the seams that don't join." : ""}</div>
      {verdict === "borderline" && <label className="bo-row" style={{ marginTop: 8, gap: 8, alignItems: "center" }}><input type="checkbox" checked={looked} onChange={(e) => setLooked(e.target.checked)} data-testid="repeat-looked" /> <span>I checked the 2×2 picture</span></label>}
    </div>}
    <div className="bo-row"><button className="bo-btn" disabled={s.busy} onClick={run}>{res ? "Check again" : "Run repeat check"}</button>
      {res && verdict === "ok" && <button className="bo-btn pri" onClick={() => confirm(false)}>Confirm: it repeats</button>}
      {res && verdict === "borderline" && <button className="bo-btn pri" disabled={!looked} onClick={() => confirm(true)} data-testid="repeat-confirm-looked">Confirm: it repeats</button>}
      {res && verdict !== "ok" && <button className="bo-btn" onClick={toMural} data-testid="repeat-to-mural">Make it a mural instead</button>}</div>
  </div>;
}

function MockupStep({ design, onChanged }: { design: any; onChanged: () => void }) {
  const s = useSaver();
  const [colorId, setColorId] = useState(design.colors[0]?.id);
  const color = design.colors.find((c: any) => c.id === colorId) ?? design.colors[0];
  const [seed, setSeed] = useState(0);
  const [gen, setGen] = useState<{ room: string; blob: Blob; url: string; on: boolean }[]>([]);
  const own = useRef<HTMLInputElement>(null);
  const savedRooms: string[] | undefined = design.meta?.mockupRooms;
  const [roomSel, setRoomSel] = useState<string[]>(savedRooms?.length ? savedRooms : defaultMockupRooms(design.madeFor ?? [], design.categories ?? []));
  const [step, setStep] = useState("");
  const dims = () => ({ kind: design.kind, widthCm: design.kind === "mural" ? (design.meta?.originalWidthCm ?? design.widthCm) : design.widthCm, heightCm: design.kind === "mural" ? (design.meta?.originalHeightCm ?? design.heightCm) : design.heightCm, repeat: design.repeat });
  async function useRooms() {
    await api(`designer/uploads/${design.id}`, { body: { mockupRooms: roomSel } });
    await remakeRoomMockups(design.id, design.colors.map((c: any) => ({ id: c.id, src: c.preview, has: c.mockups.length > 0 })), dims(), roomSel, design.sku || design.id, (d, t) => setStep(`${d} of ${t}`));
    setStep(""); setGen([]); onChanged();
  }
  const [ai, setAi] = useState<any>(null);
  const aiOff = useRef(false);
  useEffect(() => { api("ai/status").then(setAi).catch(() => setAi(null)); }, []);
  async function generateAi() {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = color.preview; await img.decode();
    const c = document.createElement("canvas"); const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const design64 = c.toDataURL("image/jpeg", 0.88);
    const rooms = (design.madeFor?.length ? design.madeFor : ["Living room", "Bedroom", "Dining room"]).slice(0, 3);
    const w = design.kind === "mural" ? `the whole mural is ${((design.meta?.originalWidthCm ?? design.widthCm) / 30.48).toFixed(1)} ft wide and ${((design.meta?.originalHeightCm ?? design.heightCm) / 30.48).toFixed(1)} ft tall` : `one pattern repeat is ${(design.widthCm / 2.54).toFixed(0)} inches wide on a 9 ft tall wall`;
    const out = [...gen];
    // all rooms at once (about 10 s in total instead of one after another)
    const res = await Promise.allSettled(rooms.map(async (room) => {
      const r: any = await api("ai/render", { body: { purpose: "mockup", design: design64, room, scaleText: w, kind: design.kind, repeat: design.repeat } });
      const blob = await (await fetch(r.image)).blob();
      out.push({ room: room + " (AI)", blob, url: URL.createObjectURL(blob), on: true }); setGen([...out]);
    }));
    const bad = res.find((x): x is PromiseRejectedResult => x.status === "rejected");
    if (bad && res.every((x) => x.status === "rejected")) { const e: any = bad.reason; if (/switched on|quota/i.test(String(e?.message))) { aiOff.current = true; setAi((a: any) => (a ? { ...a, mockups: false } : a)); } throw e; }
  }
  async function generate(sd: number) {
    setGen([]);
    const out = [];
    if (roomSel.length) { await Promise.all(roomSel.map(async (id) => { const r = resolveMockupRoom(id, design.sku || design.id); if (!r) return; const { blob } = await sceneMockup(color.preview, dims() as any, r); out.push({ room: r.name, blob, url: URL.createObjectURL(blob), on: true }); setGen([...out]); })); return; }
    const rooms = pickRooms(design.id + color.id, sd, 3, design.madeFor ?? []);
    for (const r of rooms) { const blob = await makeMockup(color.preview, { kind: design.kind, widthCm: design.kind === "mural" ? (design.meta?.originalWidthCm ?? design.widthCm) : design.widthCm, heightCm: design.kind === "mural" ? (design.meta?.originalHeightCm ?? design.heightCm) : design.heightCm, repeat: design.repeat }, r); out.push({ room: r.name, blob, url: URL.createObjectURL(blob), on: true }); setGen([...out]); }
  }
  async function generateAll() {
    // the same rooms for every color that has none yet, so switching colors on the shop page keeps the room
    const rooms = pickRooms(design.id, seed, 3, design.madeFor ?? []);
    for (const col of design.colors.filter((c: any) => !c.mockups.length)) {
      const keys = [];
      for (const r of rooms) { const blob = await makeMockup(col.preview, { kind: design.kind, widthCm: design.kind === "mural" ? (design.meta?.originalWidthCm ?? design.widthCm) : design.widthCm, heightCm: design.kind === "mural" ? (design.meta?.originalHeightCm ?? design.heightCm) : design.heightCm, repeat: design.repeat }, r); keys.push((await uploadFile(blob, { uploadId: design.id, purpose: "mockup", filename: `mockup-${r.name.replace(/\s+/g, "-").toLowerCase()}.jpg` }, () => {})).key); }
      await api(`designer/colorways/${col.id}/mockups`, { body: { keys } });
    }
    onChanged();
  }
  async function saveGen() {
    const keys = [];
    for (const g of gen.filter((x) => x.on)) keys.push((await uploadFile(g.blob, { uploadId: design.id, purpose: "mockup", filename: `mockup-${g.room.replace(/\s+/g, "-").toLowerCase()}.jpg` }, () => {})).key);
    await api(`designer/colorways/${color.id}/mockups`, { body: { keys } });
    setGen([]); onChanged();
  }
  async function addOwn(files: FileList) {
    const keys = [];
    for (const f of Array.from(files)) { const p = await makePreview(f, await readDims(f), 1800); keys.push((await uploadFile(p, { uploadId: design.id, purpose: "mockup", filename: "own-mockup.jpg" }, () => {})).key); }
    await api(`designer/colorways/${color.id}/mockups`, { body: { keys } }); onChanged();
  }
  return <div className="de-box de-rooms"><div className="de-h">Room pictures{design.colors.some((c: any) => c.mockups.length) ? <span className="de-ok">✓</span> : null}</div>
    <p className="bo-sub" style={{ marginTop: -4 }}>We place your design in different rooms at its real size. Keep the ones you like, try other rooms, or upload your own.{ai && !ai.mockups ? " More realistic AI room pictures appear here once the studio turns on AI." : ""}</p>
    <Msg m={s.msg} />
    <div className="bo-lbl">Show it in these rooms <span className="bo-sub">(pick up to 5, in the order shoppers see them)</span></div>
    <MockupRoomPicker value={roomSel} onChange={setRoomSel} />
    <div className="bo-row" style={{ margin: "8px 0 16px" }}>
      <button className="bo-btn pri" data-testid="use-rooms" disabled={s.busy || !roomSel.length || !design.colors.length} onClick={() => s.run(useRooms, "Room pictures made in your rooms")}>{step ? `Making pictures… ${step}` : savedRooms?.length ? "Update room pictures" : "Use these rooms"}</button>
      <span className="bo-sub">Your exact design on each room's wall at real size, for every color.</span>
    </div>
    {design.colors.length > 1 && <div className="bo-row" style={{ marginBottom: 8 }}>{design.colors.map((c: any) => <button key={c.id} className={"bo-btn sm" + (c.id === color.id ? " pri" : "")} onClick={() => { setColorId(c.id); setGen([]); }}>{c.name}</button>)}</div>}
    {color.mockups.length > 0 && <><div className="bo-lbl">Shown in the shop ({color.mockups.length})</div><div className="bo-mgrid" style={{ marginBottom: 10 }}>{color.mockups.map((mk: any) => <figure key={mk.id}><img src={mk.url} alt="" /><figcaption><button className="bo-btn sm" onClick={() => s.run(async () => { await api(`designer/mockups/${mk.id}`, { method: "DELETE" }); onChanged(); }, "Removed")}>Remove</button></figcaption></figure>)}</div></>}
    {gen.length > 0 && <><div className="bo-lbl">New pictures: tick the ones to keep</div><div className="bo-mgrid" style={{ marginBottom: 10 }}>{gen.map((g, i) => <figure key={g.url}><img src={g.url} alt={g.room} /><figcaption><input type="checkbox" checked={g.on} onChange={(e) => setGen(gen.map((x, k) => k === i ? { ...x, on: e.target.checked } : x))} />{g.room}</figcaption></figure>)}</div></>}
    <div className="bo-row">
      <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => generate(seed), "Pictures ready")}>{gen.length ? "Make again" : "Preview this color"}</button>
      {design.colors.length > 1 && gen.length === 0 && <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => generateAll(), "Room pictures made for every color")} title="Same rooms for every color, so customers can compare">Same rooms for every color</button>}
      {gen.length > 0 && !roomSel.length && <button className="bo-btn" disabled={s.busy} onClick={() => { const n = seed + 1; setSeed(n); s.run(() => generate(n), "Other rooms ready"); }}>Try other rooms</button>}
      {gen.length > 0 && <button className="bo-btn pri" disabled={s.busy || !gen.some((g) => g.on)} onClick={() => s.run(saveGen, "Saved to your design")}>Save selected</button>}
      {ai?.mockups && <button className="bo-btn" disabled={s.busy} onClick={async () => { const done = await s.run(generateAi, "AI pictures ready"); if (!done && aiOff.current) s.setMsg({ ok: true, text: "AI room pictures aren't switched on yet, so your built-in room pictures stay as they are." }); }}>Make AI room pictures</button>}
      <input ref={own} type="file" hidden multiple accept="image/*" onChange={(e) => e.target.files?.length && s.run(() => addOwn(e.target.files!), "Your pictures were added")} />
      <button className="bo-btn" onClick={() => own.current?.click()}>Upload my own</button>
    </div>
  </div>;
}
