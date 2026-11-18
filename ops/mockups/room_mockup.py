"""Room mockups without AI (no API key): the design is hung on one of the built-in sample rooms
(src/lib/sample-rooms.json + public/s/rooms) at true size, in perspective, behind the furniture, lit by the
room's own light. Paper stops at the crown molding and baseboard; furniture edges are refined against the
wall colour so there are no halos or leaks.
usage: python room_mockup.py src/lib/sample-rooms.json public/s/rooms design.jpg mural|repeat repeat_in room_id out.jpg
  (repeat_in = width of one pattern tile in inches; 0 for murals)
needs numpy, Pillow, scipy
"""
import sys, json
import numpy as np
from PIL import Image, ImageFilter

rooms_json, rooms_dir, design_path, kind, repeat_in, room_id, out = sys.argv[1:8]
repeat_in = float(repeat_in)
room = next(r for r in json.load(open(rooms_json)) if r["id"] == room_id)
photo = Image.open(f"{rooms_dir}/{room_id}-v1.jpg").convert("RGB")
mask = Image.open(f"{rooms_dir}/{room_id}-mask-v1.png").convert("L")
W, H = photo.size
SS = 2                                   # supersample for clean edges
Wb, Hb = W * SS, H * SS
quad = [(c["x"] * Wb, c["y"] * Hb) for c in room["corners"]]   # TL, TR, BR, BL

# 0) keep paper off the crown molding and the baseboard: walk inward from the marked top / bottom edge and stop
#    at the last strong horizontal line (molding / skirting edges), measured on the plain wall only
def trim_edges():
    g = np.asarray(photo.convert("L"), np.float32); mk = np.asarray(mask, np.float32) > 127
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = [(c["x"] * W, c["y"] * H) for c in room["corners"]]
    qh = ((y3 - y0) + (y2 - y1)) / 2
    ts = np.linspace(0.2, 0.8, 120)
    def profile(ax, ay, bx, by, steps, direction):
        prof = []
        for k in range(steps):
            xs = (ax + (bx - ax) * ts).astype(int); ys = (ay + (by - ay) * ts + direction * k).astype(int)
            ok = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
            xs, ys = xs[ok], ys[ok]; keep = ~mk[ys, xs]
            prof.append(np.median(g[ys[keep], xs[keep]]) if keep.sum() > 10 else np.nan)
        return np.array(prof)
    def last_edge(prof):
        p = np.nan_to_num(prof, nan=np.nanmedian(prof)); d = np.abs(np.gradient(p))
        thr = max(5.0, 4 * np.median(d)); hits = np.where(d > thr)[0]
        return int(hits.max()) + 2 if len(hits) else 0
    top = last_edge(profile(x0, y0, x1, y1, int(qh * 0.12), +1))
    bot = last_edge(profile(x3, y3, x2, y2, int(qh * 0.10), -1))
    return top, bot, qh
t_px, b_px, qh = trim_edges()
if t_px or b_px:
    f0, f1 = t_px / qh, b_px / qh
    TL, TR, BR, BL = quad
    lerp = lambda a, b, f: (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
    quad = [lerp(TL, BL, f0), lerp(TR, BR, f0), lerp(BR, TR, f1), lerp(BL, TL, f1)]
    room = dict(room, heightIn=room["heightIn"] * (1 - f0 - f1))
    print(f"trimmed top {t_px}px, bottom {b_px}px", file=sys.stderr)

# 1) the flat wall at true scale (px per inch chosen so the warp never upsamples much)
ppi = 14 * SS
fw, fh = int(room["widthIn"] * ppi), int(room["heightIn"] * ppi)
art = Image.open(design_path).convert("RGB")
if kind == "repeat":
    tw = max(8, int(repeat_in * ppi)); th = max(8, int(tw * art.height / art.width))
    tile = art.resize((tw, th), Image.LANCZOS)
    flat = Image.new("RGB", (fw, fh))
    for y in range(0, fh, th):
        for x in range(0, fw, tw):
            flat.paste(tile, (x, y))
else:  # mural: cover the wall, keep proportions, centred (the customer can move it on the site)
    # a fade / ombre (same colour all the way across, changing top to bottom) must keep its whole height:
    # widening it changes nothing, cropping it loses the fade
    small = np.asarray(art.resize((64, 64)), np.float32)
    uniform_x = float(np.mean(np.std(small, axis=1))) < 4.0
    k = max(fw / art.width, fh / art.height)
    a2 = art.resize((int(art.width * k) + 1, int(art.height * k) + 1), Image.LANCZOS)
    ox, oy = (a2.width - fw) // 2, (a2.height - fh) // 2
    flat = a2.crop((ox, oy, ox + fw, oy + fh))
    if uniform_x:
        flat = art.resize((fw, fh), Image.LANCZOS)
        print("fade: fitted to full wall height", file=sys.stderr)

# 2) perspective warp of the flat wall onto the wall quad
def coeffs(dst, src):
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()
src = [(0, 0), (fw, 0), (fw, fh), (0, fh)]
warped = flat.transform((Wb, Hb), Image.PERSPECTIVE, coeffs(quad, src), Image.BICUBIC)
inside = Image.new("L", (fw, fh), 255).transform((Wb, Hb), Image.PERSPECTIVE, coeffs(quad, src), Image.BILINEAR)

# 3) light: the room's own wall brightness (soft shading, corner falloff, furniture shadows), normalised
big = photo.resize((Wb, Hb), Image.BICUBIC)
lum = np.asarray(big.convert("L"), np.float32)
ins = np.asarray(inside, np.float32) / 255
furn = np.asarray(mask.resize((Wb, Hb), Image.BILINEAR), np.float32) / 255
wallpx = (ins > 0.99) & (furn < 0.01)
ref = np.percentile(lum[wallpx], 92)
# light behind furniture = the wall light right next to it (normalised blur: only real wall pixels count),
# so lamps and beds neither darken nor brighten the paper around them; wall shadows under furniture are kept
from scipy.ndimage import gaussian_filter
w = wallpx.astype(np.float32)
def nblur(a, s): return gaussian_filter(a * w, s) / np.maximum(gaussian_filter(w, s), 1e-4)
fill = nblur(lum, 14 * SS)                       # wide fill for the holes
L = np.where(wallpx, lum, fill)
shade = gaussian_filter(L, 3 * SS)
S = np.clip(shade / ref, 0.45, 1.06)[..., None]
paper = np.asarray(warped, np.float32) / 255
paper = paper * 0.96 + 0.02                             # printed ink never reaches pure black/white
rng = np.random.default_rng(1); grain = 1 + (rng.standard_normal((Hb, Wb, 1)) * 0.012)
lit = np.clip(paper * S * grain, 0, 1)

# 4) composite: wall area minus furniture. Like the site's cleanHalo(): bare wall showing within 7 px of a furniture
# edge (the masks are drawn a little generous) goes to the wallpaper; furniture itself is never touched.
rgb = np.asarray(big, np.float32)
# Edge refinement: the hand-drawn masks are off by a few px both ways (halos on dark designs, paper on the duvet).
# In a band around every mask edge each pixel is judged against the wall colour right next to it:
# looks like wall -> paper, differs -> furniture. Deep inside / far outside the mask nothing changes.
from scipy.ndimage import maximum_filter, minimum_filter
wallc = np.stack([nblur(rgb[..., c], 8 * SS) for c in range(3)], axis=2)
dist = np.abs(rgb - wallc).max(axis=2)
hard = furn > 0.5
out_band = maximum_filter(hard, size=2 * 16 * SS + 1) & ~hard          # just outside the drawn mask
in_band = hard & ~minimum_filter(hard, size=2 * 14 * SS + 1)          # just inside it
soft_out = gaussian_filter(np.clip((dist - 7) / 12, 0, 1), 0.7 * SS)  # outside: differs from wall -> furniture
soft_in = gaussian_filter(np.clip((dist - 4) / 7, 0, 1), 0.7 * SS)  # inside: only near-exact wall colour -> paper
fg = hard.astype(np.float32)
fg = np.where(out_band, soft_out, fg)
fg = np.where(in_band, soft_in, fg)
alpha = np.clip(ins * (1 - fg), 0, 1)
alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6 * SS)), np.float32)[..., None] / 255
base = np.asarray(big, np.float32) / 255
# matting: an edge pixel is part furniture, part wall; swap only its wall part for paper (no light fringes)
wall_lit = wallc / 255
outimg = np.clip(base + alpha * (lit - wall_lit), 0, 1)
pure = (alpha[..., 0] > 0.98)                               # fully wall: exact paper
outimg[pure] = lit[pure]
res = Image.fromarray((outimg * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
res.save(out, quality=82)
print(out, room["name"], f'{room["widthIn"]}x{room["heightIn"]} in wall')
