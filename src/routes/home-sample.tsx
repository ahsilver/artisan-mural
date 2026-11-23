import { createFileRoute, redirect } from "@tanstack/react-router";

/** An old demo page; the real homepage replaced it. */
export const Route = createFileRoute("/home-sample")({ beforeLoad: () => { throw redirect({ href: "/" }); } });
