
"""Wallpaper mockup templates (no AI per design).

render_peel(tile, repeat_in, out)  -> wall of 52 in panels, one bottom corner curling off.
render_roll(tile, repeat_in, out)  -> a roll lying on a table, partly unrolled.

tile      : path to ONE seamless repeat tile (any size; its width = repeat_in inches)
repeat_in : printed width of one repeat, in inches (height follows the tile's aspect)
The design is only tiled / sampled by code, never redrawn, so the pattern is exact.
Needs numpy, Pillow, scipy (ndimage).
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

RNG = np.random.default_rng(7)  # fixed seed: same template look every run


def _load_tile(path, repeat_in, ppi):
    t = Image.open(path).convert("RGB")
    tw = max(8, int(round(repeat_in * ppi)))
    th = max(8, int(round(tw * t.height / t.width)))
    t = t.resize((tw, th), Image.LANCZOS)
    return np.asarray(t).astype(np.float32) / 255.0


def _sample(tile, x, y):
    """Bilinear, wrap-around sample of the tile at pixel coords (x, y) (arrays)."""
    th, tw, _ = tile.shape
    out = np.empty(x.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = ndi.map_coordinates(tile[..., c], [np.mod(y, th), np.mod(x, tw)],
                                          order=1, mode="grid-wrap")
    return out


def _noise(h, w, sigma, sx=1.0, sy=1.0):
    n = RNG.standard_normal((h, w)).astype(np.float32)
    n = ndi.gaussian_filter(n, (sigma * sy, sigma * sx))
    return n / (n.std() + 1e-6)


def _finish(img, out, size):
    img = np.clip(img, 0, 1)
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8))
    im = im.resize(size, Image.LANCZOS)
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    return out


# ----------------------------------------------------------------------------- peel
def render_peel(tile_path, repeat_in, out, panel_in=52.0, size=(1600, 1200), ss=2,
                view_in=132.0, peel_panel=1, curl=(15.0, 30.0), curl_r_in=4.2):
    W, H = size[0] * ss, size[1] * ss
    ppi = W / view_in                       # pixels per inch at render scale
    tile = _load_tile(tile_path, repeat_in, ppi)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    wall_b = int(H * 0.83)                  # wall bottom (top of baseboard)
    base_h = int(4.5 * ppi)                 # 4.5 in baseboard
    floor_t = wall_b + base_h
    x_off = 0.30 * panel_in * ppi           # first seam position
    seams = [x_off + k * panel_in * ppi for k in range(-1, 6)]
    px0, px1 = seams[peel_panel], seams[peel_panel + 1]   # panel that peels

    # light: soft window light from upper left + vignette
    light = 1.05 - 0.10 * (xx / W) - 0.06 * (yy / H)
    light *= 1 - 0.18 * (((xx / W - 0.45) ** 2) * 1.2 + ((yy / H - 0.40) ** 2) * 1.4)

    paper = _sample(tile, xx, yy)
    paper *= (1 + 0.012 * _noise(H, W, 0.8))[..., None]          # paper grain
    painted = np.array([0.86, 0.815, 0.745], np.float32)          # bare wall
    wall_bare = painted * (1 + 0.01 * _noise(H, W, 1.5))[..., None]

    # ---- page curl of the peeling corner (cylinder model)
    a, b = curl[0] * ppi, curl[1] * ppi
    r = curl_r_in * ppi
    A = np.array([px1 - a, wall_b], np.float32)
    n = np.array([b, a], np.float32); n /= np.linalg.norm(n)       # toward the corner
    d = (xx - A[0]) * n[0] + (yy - A[1]) * n[1]

    def src(s):
        qx = xx + (s - d) * n[0]; qy = yy + (s - d) * n[1]
        ok = (qx <= px1) & (qx >= px0) & (qy <= wall_b) & (qy >= 0) & (s >= 0)
        return qx, qy, ok

    inpanel = (xx >= px0) & (xx < px1) & (yy < wall_b)
    dc = np.clip(d / r, -1, 1)
    s1 = r * np.arcsin(dc)
    s2 = r * (np.pi - np.arcsin(dc))
    s3 = np.pi * r - d
    _, _, ok1 = src(s1); _, _, ok2 = src(s2); _, _, ok3 = src(s3)
    ok1 &= (d >= 0) & (d <= r); ok2 &= (d >= 0) & (d <= r); ok3 &= (d < 0)
    back = ok2 | ok3
    front_curl = ok1 & ~ok2
    lifted = inpanel & (d >= 0)

    phi = np.where(ok3, np.pi, np.where(ok2, s2 / r, s1 / r))
    L = np.array([-0.45, -0.55, 0.70], np.float32); L /= np.linalg.norm(L)
    # back side normal = outward cylinder normal
    nb = np.sin(phi) * (n[0] * L[0] + n[1] * L[1]) + (-np.cos(phi)) * L[2]
    nf = -nb
    back_col = np.array([0.985, 0.965, 0.925], np.float32) * (1 + 0.01 * _noise(H, W, 0.7))[..., None]
    shade_b = (0.62 + 0.42 * np.clip(nb, 0, 1))[..., None]
    shade_f = (0.40 + 0.70 * np.clip(nf, 0, 1))[..., None]
    q1x, q1y, _ = src(s1)
    front_px = _sample(tile, q1x, q1y)

    flap = back | front_curl
    wall = np.where(lifted[..., None], wall_bare, paper)
    # seams: hairline shadow + highlight
    for sx in seams:
        g = np.exp(-((xx - sx) / (0.75 * ss)) ** 2)
        g2 = np.exp(-((xx - sx - 1.2 * ss) / (0.6 * ss)) ** 2)
        wall *= (1 - 0.36 * g * (yy < wall_b))[..., None]
        wall += (0.035 * g2 * (yy < wall_b))[..., None]

    # cast shadow of the flap + contact darkening under the curl
    fm = flap.astype(np.float32)
    sh = ndi.shift(fm, (0.55 * r, 0.75 * r), order=1)
    sh = ndi.gaussian_filter(sh, 0.55 * r)
    occl = np.exp(-np.clip(d, 0, None) / (0.9 * r)) * lifted
    occl = ndi.gaussian_filter(occl.astype(np.float32), 0.25 * r)
    wall *= (1 - 0.50 * sh - 0.38 * occl)[..., None]

    img = wall.copy()
    img = np.where(back[..., None], back_col * shade_b, img)
    img = np.where(front_curl[..., None], front_px * shade_f, img)
    # slight dark edge on the flap outline (paper thickness)
    edge = ndi.gaussian_filter(fm, 0.6 * ss) * (1 - ndi.gaussian_filter(fm, 0.6 * ss)) * 4
    img *= (1 - 0.25 * edge)[..., None]

    # ---- baseboard (painted white, simple profile)
    t = (yy - wall_b) / base_h
    bb = (yy >= wall_b) & (yy < floor_t)
    prof = np.where(t < 0.10, 0.80 + 1.2 * t,             # top lip shadow -> bevel
            np.where(t < 0.16, 1.04,                       # bevel highlight
            np.where(t < 0.93, 0.97 - 0.05 * t, 0.80)))   # face, bottom shadow
    base_col = np.array([0.95, 0.945, 0.93], np.float32)
    img = np.where(bb[..., None], base_col * prof[..., None], img)
    # shadow of the baseboard lip on the wallpaper just above it
    lip = np.exp(-np.clip(wall_b - yy, 0, None) / (0.35 * ppi)) * (yy < wall_b)
    img *= (1 - 0.10 * lip)[..., None]

    # ---- oak floor, planks parallel to the wall, mild perspective
    fl = yy >= floor_t
    depth = np.clip((yy - floor_t) / max(1, H - floor_t), 0, 1)           # 0 far .. 1 near
    v = np.log1p(6 * depth) / np.log1p(6) * 3.2           # plank index (perspective)
    plank = np.floor(v)
    frac = v - plank
    oak = np.array([0.74, 0.60, 0.44], np.float32)
    grain = _noise(H, W, 2.0, sx=14, sy=0.6)
    hue = (RNG.standard_normal(64) * 0.05).astype(np.float32)
    pv = hue[plank.astype(int) % 64]
    floor = oak * (1 + 0.05 * grain + pv)[..., None]
    joint = np.exp(-(np.minimum(frac, 1 - frac) / 0.02) ** 2)
    stag = RNG.uniform(0, W, 64)
    endj = np.exp(-(np.abs(((xx + stag[plank.astype(int) % 64]) % (W * 0.62)) - 2) / (1.2 * ss)) ** 2)
    floor *= (1 - 0.35 * joint - 0.30 * endj)[..., None]
    floor *= (0.80 + 0.25 * depth)[..., None]
    cshadow = np.exp(-np.clip(yy - floor_t, 0, None) / (0.8 * ppi))
    floor *= (1 - 0.35 * cshadow)[..., None]
    img = np.where(fl[..., None], floor, img)

    img *= light[..., None]
    return _finish(img, out, size)


# ----------------------------------------------------------------------------- roll
def render_roll(tile_path, repeat_in, out, roll_w_in=52.0, roll_d_in=6.5, sheet_in=27.0,
                size=(1600, 1200), ss=2, tilt_deg=50.0, yaw_deg=24.0, view_in=64.0):
    W, H = size[0] * ss, size[1] * ss
    ppi = W / view_in
    tile = _load_tile(tile_path, repeat_in, ppi)
    R = roll_d_in / 2 * ppi
    Rc = 1.1 * ppi                                  # cardboard core radius
    X0, X1 = -roll_w_in / 2 * ppi, roll_w_in / 2 * ppi
    Ls = sheet_in * ppi

    th, yw = np.radians(tilt_deg), np.radians(yaw_deg)
    # camera looks along -dvec; dvec points from scene toward camera
    dvec = np.array([np.sin(yw) * np.cos(th), np.cos(yw) * np.cos(th), np.sin(th)], np.float32)
    eu = np.array([np.cos(yw), -np.sin(yw), 0], np.float32)          # image right
    ev = np.cross(eu, dvec); ev /= np.linalg.norm(ev)              # image up
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # center the composition on the middle of the roll+sheet
    cx, cy = 0.0, Ls * 0.36
    c3 = np.array([cx, cy, R], np.float32)
    u = (xx - W / 2); vv = -(yy - H * 0.47)
    O = c3[None, None, :] + u[..., None] * eu + vv[..., None] * ev + 5000 * dvec
    D = -dvec
    Ox, Oy, Oz = O[..., 0], O[..., 1], O[..., 2]
    INF = np.float32(1e9)

    # table plane z=0
    tp = Oz / -D[2]
    px_, py_ = Ox + tp * D[0], Oy + tp * D[1]
    t_best = tp.copy(); kind = np.zeros((H, W), np.int8)           # 0 table, 1 sheet
    sheet = (px_ >= X0) & (px_ <= X1) & (py_ >= 0) & (py_ <= Ls)
    kind[sheet] = 1

    # cylinder (y^2 + (z-R)^2 = R^2), axis along x
    a = D[1] ** 2 + D[2] ** 2
    by = Oy; bz = Oz - R
    bq = 2 * (by * D[1] + bz * D[2])
    cq = by ** 2 + bz ** 2 - R ** 2
    disc = bq ** 2 - 4 * a * cq
    tc = np.where(disc >= 0, (-bq - np.sqrt(np.clip(disc, 0, None))) / (2 * a), INF)
    cxh = Ox + tc * D[0]
    cyl = (disc >= 0) & (cxh >= X0) & (cxh <= X1) & (tc < t_best)
    t_best = np.where(cyl, tc, t_best); kind[cyl] = 2

    # end cap at x = X1 (facing +x), visible because of yaw
    te = (X1 - Ox) / D[0]
    ey, ez = Oy + te * D[1], Oz + te * D[2] - R
    er = np.sqrt(ey ** 2 + ez ** 2)
    cap = (er <= R) & (te < t_best)
    t_best = np.where(cap, te, t_best); kind[cap] = 3
    # inside of the core tube (seen through the hole)
    hole = cap & (er < Rc)

    L = np.array([-0.35, 0.25, 0.90], np.float32); L /= np.linalg.norm(L)
    img = np.zeros((H, W, 3), np.float32)

    # table / backdrop: warm light linen-grey with soft falloff
    table = np.array([0.90, 0.885, 0.86], np.float32) * (1 + 0.012 * _noise(H, W, 1.2))[..., None]
    table *= (1.04 - 0.10 * (yy / H) - 0.05 * np.abs(xx / W - 0.5))[..., None]
    # contact shadows: under the roll, and along the sheet edges
    roll_fp = ((px_ >= X0 - 0.5 * ppi) & (px_ <= X1 + 0.5 * ppi)).astype(np.float32)
    rshadow = roll_fp * np.exp(-np.clip(np.abs(py_ + 0.15 * ppi) - 0.0, 0, None) / (1.6 * ppi))
    rshadow = ndi.gaussian_filter(rshadow, 0.5 * ppi)
    smask = sheet.astype(np.float32)
    sshadow = ndi.gaussian_filter(ndi.shift(smask, (0.12 * ppi, 0.10 * ppi), order=1), 0.22 * ppi)
    table *= (1 - 0.50 * rshadow - 0.40 * sshadow)[..., None]
    img[:] = table

    # sheet: pattern in paper coords (x along width, y = distance from roll contact)
    sp = _sample(tile, px_ - X0, py_ + 3.0 * ppi)
    sp *= (1 + 0.012 * _noise(H, W, 0.8))[..., None]
    shade_s = 0.93 + 0.07 * L[2]
    # the sheet is a little darker right where it leaves the roll (occlusion)
    occ = np.exp(-np.clip(py_, 0, None) / (1.2 * ppi))
    sp *= (shade_s * (1 - 0.38 * occ) * (0.97 + 0.05 * (py_ / Ls)))[..., None]
    img = np.where((kind == 1)[..., None], sp, img)

    # roll surface: angle alpha from contact point, paper coordinate continues the sheet
    hy, hz = Oy + tc * D[1], Oz + tc * D[2] - R
    alpha = np.mod(np.arctan2(hy, -hz), 2 * np.pi)                   # 0 at bottom
    pcoord = -(R * alpha) + 3.0 * ppi
    rp = _sample(tile, cxh - X0, pcoord)
    nrm = np.stack([np.zeros_like(hy), hy / R, hz / R], -1)
    lam = np.clip((nrm * L).sum(-1), 0, 1)
    view = np.clip((nrm * dvec).sum(-1), 0, 1)
    spec = (np.clip((nrm * ((L + dvec) / np.linalg.norm(L + dvec))).sum(-1), 0, 1)) ** 40
    shade_r = (0.30 + 0.78 * lam) * (0.85 + 0.15 * view)
    rcol = rp * shade_r[..., None] + 0.06 * spec[..., None]
    img = np.where((kind == 2)[..., None], rcol, img)

    # end cap: spiral layers of paper (thin rings) around the brown core
    rings = 0.5 + 0.5 * np.sin(er / (0.045 * ppi) * 2 * np.pi + np.arctan2(ez, ey) * 0.3)
    paper_edge = np.array([0.93, 0.915, 0.89], np.float32)
    capcol = paper_edge * (0.86 + 0.08 * rings)[..., None]
    capcol *= (0.78 + 0.22 * max(0.0, float(L[0] * 1 + 0.5)))       # cap faces +x (away from light)
    core = (er >= Rc - 0.18 * ppi) & (er < Rc + 0.0)
    capcol = np.where(core[..., None], np.array([0.62, 0.48, 0.33], np.float32) * 0.9, capcol)
    inside = np.array([0.45, 0.34, 0.23], np.float32) * (0.35 + 0.5 * np.clip((ey + Rc) / (2 * Rc), 0, 1))[..., None]
    capcol = np.where(hole[..., None], inside, capcol)
    img = np.where((kind == 3)[..., None], capcol, img)

    # anti-alias silhouettes a touch
    return _finish(img, out, size)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("tile"); p.add_argument("repeat_in", type=float)
    p.add_argument("--out", default="."); p.add_argument("--name", default="design")
    p.add_argument("--panel-in", type=float, default=52.0)
    a = p.parse_args()
    import os
    print(render_peel(a.tile, a.repeat_in, os.path.join(a.out, a.name + "-peel.jpg"), panel_in=a.panel_in))
    print(render_roll(a.tile, a.repeat_in, os.path.join(a.out, a.name + "-roll.jpg"), roll_w_in=a.panel_in))
