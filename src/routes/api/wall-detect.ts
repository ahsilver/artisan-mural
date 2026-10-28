import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const point = { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number" }, y: { type: "number" } } };
const schema = {
  type: "object", additionalProperties: false, required: ["walls"],
  properties: {
    walls: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["label", "polygon", "samples", "objects"],
        properties: {
          label: { type: "string" },
          polygon: { type: "array", items: point },
          samples: { type: "array", items: point },
          objects: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "polygon"], properties: { label: { type: "string" }, polygon: { type: "array", items: point } } } },
        },
      },
    },
  },
};
const pt = z.object({ x: z.number().min(-0.05).max(1.05), y: z.number().min(-0.05).max(1.05) }).transform((p) => ({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) }));
const resultSchema = z.object({ walls: z.array(z.object({ label: z.string().max(80), polygon: z.array(pt).min(3).max(40), samples: z.array(pt).max(12), objects: z.array(z.object({ label: z.string().max(80), polygon: z.array(pt).min(3).max(40) })).max(30) })).max(4) });

const instructions = `You are a precise interior-photo segmentation assistant for a wallpaper shop. Coordinates are normalized: x from 0 (left edge) to 1 (right edge), y from 0 (top edge) to 1 (bottom edge) of the image.
Find the flat wall surfaces in the photo that could receive wallpaper. Return up to 3 walls, the best candidate first (usually the largest, most front-facing wall).
For each wall:
- polygon: 4 to 10 points tracing the wall's outer boundary exactly where it meets the ceiling, floor, adjacent walls and image edges. Follow the true wall corners in perspective. Do not include ceiling, floor, or neighbouring walls.
- samples: 4 to 8 points that lie on clearly visible, plain wall surface, spread across the wall, never on furniture, art, windows, doors, lamps or shadows of objects.
- objects: every object that sits in front of or on that wall and must not be covered (sofas, beds, headboards, tables, lamps, plants, shelves, TVs, frames, mirrors, windows, doors, radiators, outlets, people). Trace each with a tight polygon of 4 to 16 points.
If no wall is visible, return an empty walls array.`;

export const Route = createFileRoute("/api/wall-detect")({ server: { handlers: { POST: async ({ request }) => {
  const key = process.env["AI_GATEWAY_KEY"];
  if (!key) return Response.json({ error: "Room previews are not configured yet." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Use the wallpaper website to find your wall." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) return Response.json({ error: "Please use a smaller room photo." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const room = form?.get("room");
  if (!(room instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(room.type) || room.size > 5 * 1024 * 1024) return Response.json({ error: "Use a JPEG, PNG or WebP room photo." }, { status: 400 });
  const bytes = new Uint8Array(await room.arrayBuffer());
  let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const dataUrl = `data:${room.type};base64,${btoa(binary)}`;
  try {
    const upstream = await fetch((((globalThis as any).process?.env?.["AI_GATEWAY_URL"] as string | undefined) ?? "") + "/v1/responses", {
      method: "POST", signal: request.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: instructions },
          { role: "user", content: [{ type: "input_text", text: "Find the walls and the objects in front of them in this room photo." }, { type: "input_image", image_url: dataUrl, detail: "high" }] },
        ],
        text: { format: { type: "json_schema", name: "room_walls", strict: true, schema } },
      }),
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("Wall detection failed", upstream.status, detail.slice(0, 300));
      const message = upstream.status === 402 ? "AI credits have run out. Please try again later." : upstream.status === 429 ? "Too many previews right now — please try again in a minute." : "We couldn't read your room photo. Please try another photo.";
      return Response.json({ error: message }, { status: upstream.status === 402 || upstream.status === 429 ? upstream.status : 502 });
    }
    const reader = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "", text = "", failed = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data || data === "[DONE]") continue;
        try {
          const event = JSON.parse(data) as { type?: string; delta?: string };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") text += event.delta;
          if (event.type === "response.failed" || event.type === "error" || event.type === "response.refusal.delta") failed = true;
        } catch { /* partial frame */ }
      }
    }
    if (failed || !text) return Response.json({ error: "We couldn't read your room photo. Please try another photo." }, { status: 502 });
    const parsed = resultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return Response.json({ error: "We couldn't find a wall in this photo." }, { status: 422 });
    return Response.json(parsed.data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("Wall detection error", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "We couldn't read your room photo. Please try another photo." }, { status: 502 });
  }
} } } });
