/**
 * "artisan-print" worker: runs print jobs for huge originals in a Cloudflare Container (print-service/server.py).
 * The site calls it through a service binding (env.PRINT on the site): POST /run {"id": "<print_jobs row id>"}.
 * A Durable Object takes the job and runs it from an alarm, so it can take minutes without holding the site's request.
 */
import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";
import { runPrintJob } from "../../../src/backend/print-jobs";

type Env = { DB: any; FILES: any; PRINT_SERVICE: any; JOB_RUNNER: DurableObjectNamespace<JobRunner> };

/** The container with libvips. It sleeps after a few quiet minutes, so it only costs while it works. */
export class PrintService extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
}

/** Runs queued jobs one after another. */
export class JobRunner extends DurableObject<Env> {
  async fetch(req: Request) {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return new Response("missing id", { status: 400 });
    const q: string[] = (await this.ctx.storage.get("queue")) ?? [];
    if (!q.includes(id)) q.push(id);
    await this.ctx.storage.put("queue", q);
    await this.ctx.storage.setAlarm(Date.now());
    return Response.json({ queued: true });
  }
  async alarm() {
    const q: string[] = (await this.ctx.storage.get("queue")) ?? [];
    const id = q.shift(); await this.ctx.storage.put("queue", q);
    if (id) {
      const service = getContainer(this.env.PRINT_SERVICE, "print");
      await runPrintJob(this.env, id, (body) => service.fetch(new Request("http://print-service/job", { method: "POST", headers: { "content-type": "application/json" }, body })));
    }
    if (q.length) await this.ctx.storage.setAlarm(Date.now());
  }
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/run") return env.JOB_RUNNER.get(env.JOB_RUNNER.idFromName("runner")).fetch(req);
    if (url.pathname === "/health") return getContainer(env.PRINT_SERVICE, "print").fetch(new Request("http://print-service/health"));
    return new Response("Artisan Murals print service", { status: 404 });
  },
};
