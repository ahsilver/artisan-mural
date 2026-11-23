import { createFileRoute, redirect } from "@tanstack/react-router";

/** The old designer dashboard moved into the designer studio. Links in notifications and emails still point here,
 *  so they land on the same view in the studio (messages open the chat they name). */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ location }) => {
    const q = new URLSearchParams(location.searchStr || "");
    const v = q.get("view");
    const view = v === "messages" ? "inbox" : v === "offers" ? "approvals" : v || "overview";
    const keep = new URLSearchParams({ view });
    for (const k of ["c", "project"]) { const x = q.get(k); if (x) keep.set(k, x); }
    throw redirect({ href: `/studio?${keep.toString()}` });
  },
});
