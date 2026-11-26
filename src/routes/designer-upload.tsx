import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { StudioUpload, QUEUE_KEY } from "@/components/storefront/studio-upload";
import { api, useApi } from "@/components/bo/common";
import { DesignEditor } from "@/components/designer/design-editor";

export const Route = createFileRoute("/designer-upload")({
  head: () => ({ meta: [{ title: "Add a design — Artisan Mural" }, { name: "description", content: "Add a wallpaper design: artwork, colorways, repeat type, size and room pictures on one page." }, { property: "og:title", content: "Your wallpaper studio — Artisan Mural" }, { property: "og:description", content: "Add a wallpaper design with its colorways, repeat type and room pictures." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DesignerUpload,
});

const NEW = { id: null, title: "Untitled design", kind: "repeating", repeat: "both", colors: [], meta: {}, madeFor: [], categories: [], tags: [], review: null, submittedAt: null };

function DesignerUpload() {
  const { session, loading } = useSession();
  const me = useApi<any>(session ? "designer/me" : null, [session?.user?.id]);
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setId(new URLSearchParams(window.location.search).get("id")); setReady(true); }, []);
  const creating = useRef<Promise<string> | null>(null);
  const idRef = useRef<string | null>(null); idRef.current = id;
  const ensure = () => {
    if (idRef.current) return Promise.resolve(idRef.current);
    if (!creating.current) creating.current = api("designer/uploads", { body: { title: "Untitled design", kind: "repeating", repeat: "both" } }).then(async (r: any) => {
      idRef.current = r.id; setId(r.id); window.history.replaceState(null, "", `/designer-upload?id=${r.id}`); await me.reload(); return r.id as string;
    }).finally(() => { creating.current = null; });
    return creating.current;
  };
  const d = me.data;
  const found = d && id ? d.designs.find((x: any) => x.id === id) : null;
  const design = found ?? NEW;
  const [queue, setQueue] = useState<string[]>([]);
  useEffect(() => { try { setQueue(JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]")); } catch {} }, []);
  const next = () => { const [n, ...rest] = queue; try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(rest)); } catch {} window.location.href = `/designer-upload?id=${n}`; };
  const nextTitle = queue.length && d ? d.designs.find((x: any) => x.id === queue[0])?.title : null;
  return <div className="am">
    <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/studio">Designer studio</a><span>/</span><a href="/studio?view=designs">My designs</a><span>/</span><b>{found ? found.title : "Add a design"}</b></nav></div>
    <section className="pg acc studio de-page">
      <div className="pg-head acc-head"><div><span className="k">{found ? (found.submittedAt ? "Edit design" : "New design · draft") : "Add a design"}</span><h1>{found ? found.title : "Add a new design"}</h1><p>Check the picture, size, repeat and rooms, then send it for review. Everything saves as you go.</p></div>
        <div className="up-row"><a className="btn optline btn-sm" href="/studio?view=designs">My designs</a>{queue.length > 0 && <button type="button" className="btn btn-wine btn-sm" onClick={next}>Next design{nextTitle ? `: ${nextTitle}` : ""} ({queue.length} left)</button>}</div></div>
      {queue.length > 0 && <div className="up-queue" role="status"><b>{queue.length} more design{queue.length > 1 ? "s" : ""} waiting</b><span>{(d?.designs ?? []).filter((x: any) => queue.includes(x.id)).slice(0, 6).map((x: any) => x.title).join(" · ")}</span><small>Their pictures are already added. Finish this one, then press Next design.</small></div>}
      {loading || !ready ? <p className="hint">Loading your studio…</p>
        : !session ? <AuthPanel designer />
        : me.error ? <p className="rq-ok err">{me.error}</p>
        : !d ? <p className="hint">Loading your designs…</p>
        : !d.profile ? <div className="sa-done"><b>Apply to sell first</b><p>Tell us about you and your work. Once the studio approves you, you can add designs here.</p><a className="btn btn-wine btn-sm" href="/become-designer">Start my application</a></div>
        : id && !found ? <div className="sa-done"><b>This design isn't here anymore</b><a className="btn btn-wine btn-sm" href="/studio?view=upload">Add a new design</a></div>
        : !id && d.profile.status === "approved" ? <StudioUpload rules={d.rules} />
        : <div className="bo dp de-new" style={{ minHeight: 0, ["--de-top" as any]: "84px" }}>
            {d.profile.status === "pending" && <div className="bo-msg" style={{ marginBottom: 12 }}>The studio is reviewing your application. Designs go live after approval.</div>}
            <DesignEditor key="form" page owner={!!d.owner} design={design} rules={d.rules} ensure={ensure} onChanged={me.reload} onClose={() => { window.location.href = "/studio?view=designs"; }} />
          </div>}
    </section>
  </div>;
}
