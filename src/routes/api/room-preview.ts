import { createFileRoute } from "@tanstack/react-router";
import { editImage, type ImageConfig } from "@/lib/image-gateway.server";

export const imageSettings: Omit<ImageConfig, "apiKey"> = { baseURL: (((globalThis as any).process?.env?.["AI_GATEWAY_URL"] as string | undefined) ?? ""), model: "openai/gpt-image-2.5-sunburst", format: "openai" };
export const Route = createFileRoute("/api/room-preview")({ server: { handlers: { POST: async ({ request }) => {
  const key = process.env["AI_GATEWAY_KEY"];
  if (!key) return new Response("Room previews are not configured yet.", { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Create your preview from the wallpaper website.", { status: 403 });
  if (Number(request.headers.get("content-length")) > 25 * 1024 * 1024) return new Response("Please use a smaller room photo.", { status: 413 });
  try {
    const form = await request.formData();
    const room = form.get("room");
    const artwork = form.get("artwork");
    const mask = form.get("mask");
    if (!(room instanceof File) || !(artwork instanceof File) || !(mask instanceof File)) return new Response("Room, artwork, and wall selection are required.", { status: 400 });
    if ([room, artwork, mask].some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 10 * 1024 * 1024)) return new Response("Use JPEG, PNG or WebP images under 10 MB.", { status: 400 });
    const point = JSON.parse(String(form.get("point") ?? "null")) as { x?: number; y?: number } | null;
    if (!point || typeof point.x !== "number" || typeof point.y !== "number" || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return new Response("Tap a wall in your room photo first.", { status: 400 });
    const instruction = String(form.get("instruction") ?? "").slice(0, 500);
    const size = String(form.get("size") ?? "auto");
    if (!/^\d{3,4}x\d{3,4}$/.test(size)) return new Response("Please upload your room photo again.", { status: 400 });
    const upstreamForm = new FormData();
    upstreamForm.append("image[]", room);
    upstreamForm.append("image[]", artwork);
    upstreamForm.append("mask", mask);
    upstreamForm.set("size", size);
    upstreamForm.set("stream", form.get("stream") === "false" ? "false" : "true");
    upstreamForm.set("prompt", `LOCALIZED PHOTO EDIT, not a new room generation. Image 1 is the exact customer photo and the output canvas. Image 2 is only a wallpaper texture reference, never a room or composition reference. Keep image 1's camera, framing, room structure, furniture, lighting, windows, doors, floors and ceilings in exactly their original positions. Replace ONLY the wall finish within the transparent mask using image 2's artwork. All opaque mask pixels must remain unchanged. The wall contains point (${point.x.toFixed(3)}, ${point.y.toFixed(3)}). Match its existing perspective; do not move its edges. Within the editable region, preserve foreground furniture and objects rather than redraw or cover them. Do not invent or substitute any room. Use the wallpaper artwork faithfully. Customer guidance: ${instruction || "Only the selected wall."}. Return the same framing and proportions as image 1.`);
    const upstream = await editImage({ ...imageSettings, apiKey: key }, upstreamForm);
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
  } catch (err) {
    console.error("Room preview failed", err instanceof Error ? err.message : "Unknown error");
    return new Response("Could not prepare the preview. Check the photo and try again.", { status: 400 });
  }
} } } });
