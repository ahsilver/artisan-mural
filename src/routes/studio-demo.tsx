import { createFileRoute, redirect } from "@tanstack/react-router";

/** An old demo page; the real designer studio replaced it. */
export const Route = createFileRoute("/studio-demo")({ beforeLoad: () => { throw redirect({ href: "/studio" }); } });
