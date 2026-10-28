import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { DesignerNav } from "@/components/designer-nav";
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
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
    <DesignerNav />
    <div className="mb-5 mt-5"><p className="text-eyebrow text-clay">{found ? "Edit design" : "Add a design"}</p><h1 className="mt-1 text-2xl sm:text-3xl">{found ? found.title : "Add a new design"}</h1></div>
    {loading || !ready ? <Loader2 className="animate-spin" aria-label="Loading your studio" />
      : !session ? <AuthPanel />
      : me.error ? <p className="text-sm text-destructive">{me.error}</p>
      : !d ? <Loader2 className="animate-spin" aria-label="Loading your designs" />
      : !d.profile ? <div className="soft-panel max-w-xl"><h2 className="text-2xl">Set up your designer profile first</h2><p className="mt-2 text-sm text-muted-foreground">It takes a minute. Then you can add designs here.</p><a className="mt-4 inline-block underline" href="/dashboard">Set up my profile</a></div>
      : id && !found ? <div className="soft-panel max-w-xl"><h2 className="text-2xl">This design isn't here anymore</h2><a className="mt-4 inline-block underline" href="/designer-upload">Add a new design</a></div>
      : <div className="bo dp" style={{ background: "transparent", minHeight: 0, ["--de-top" as any]: "84px" }}>
          {d.profile.status === "pending" && <div className="bo-msg" style={{ marginBottom: 12 }}>The studio is reviewing your application. You can already add designs; they go live after approval.</div>}
          <DesignEditor key="form" page design={design} rules={d.rules} ensure={ensure} onChanged={me.reload} onClose={() => { window.location.href = "/studio?view=designs"; }} />
        </div>}
  </div>;
}
