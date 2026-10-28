
"""Wallpaper product mockups v2 (Artisan Mural).

The design is never redrawn: it is only resampled (bilinear) from the repeat tile.
Scenes:
  peel  - photoreal empty-room plate (plates/room-wall.png), the design hung as 52 in panels
          on the wall at true scale, every panel's bottom corner curling off the wall
          (cylinder page-curl: printed face, plain paper back, bare wall + shadow under it).
  roll  - a hanging length of paper with a big roll at the bottom, on a plain studio backdrop
          plate (plates/backdrop.png). Ray-cast by code: the roll's outer face continues the
          printed face of the hanging sheet; the roll end shows the spiral of plain paper layers.
Repeat handling: extract_repeat() finds the true repeat inside a web image (straight or
half-drop), crops it and feathers the joins with the image's own duplicate content, so a
non-seamless web JPG still tiles with no grid.
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(globals().get("__file__", "/home/user/tab/work/artisan-copy/ops/mockups/mockups.py")))
PLATES = os.path.join(HERE, "plates")

# ---------------------------------------------------------------- repeat tile

def _g(a):
    return ndimage.gaussian_filter(a.mean(2), 1.5)

def _shift_err(g, dx, dy):
    H, W = g.shape
    x0, x1 = max(0, -dx), min(W, W - dx); y0, y1 = max(0, -dy), min(H, H - dy)
    if x1 - x0 < 32 or y1 - y0 < 32:
        return 1e9
    return float(np.abs(g[y0:y1, x0:x1] - g[y0 + dy:y1 + dy, x0 + dx:x1 + dx]).mean())

def analyze_repeat(a, min_frac=0.3):
    """Return dict(P, Q, drop, wraps, err...) for an HxWx3 float image."""
    g = _g(a); H, W = g.shape
    nb = float(np.abs(g[:, 1:] - g[:, :-1]).mean())
    wrapx = float(np.abs(g[:, 0] - g[:, -1]).mean()); wrapy = float(np.abs(g[0] - g[-1]).mean())
    # coarse search on a half-size copy, then refine
    gs = g[::2, ::2]
    hx = min((_shift_err(gs, dx, 0), dx) for dx in range(int(W * min_frac / 2), int(W / 2) - 16))
    vy = min((_shift_err(gs, 0, dy), dy) for dy in range(int(H * min_frac / 2), int(H / 2) - 16))
    P = min((_shift_err(g, d, 0), d) for d in range(2 * hx[1] - 3, 2 * hx[1] + 4))
    Q = min((_shift_err(g, 0, d), d) for d in range(2 * vy[1] - 3, 2 * vy[1] + 4))
    # half-drop: content at x+P equals content at y+D
    drop = (P[0], 0)
    for D in range(-Q[1] // 2 - 4, Q[1] // 2 + 5, 2):
        e = _shift_err(g, P[1], D)
        if e < drop[0] * 0.85:
            drop = (e, D)
    seamless = wrapx < 2.0 * nb and wrapy < 2.0 * nb
    return dict(W=W, H=H, nb=nb, wrapx=wrapx, wrapy=wrapy, P=P[1], P_err=P[0], Q=Q[1], Q_err=Q[0],
                drop=drop[1], seamless_as_is=bool(seamless))

def extract_repeat(path, feather=48, verbose=True):
    """Load a design image and return (tile float32 HxWx3, drop_px, info).
    If the image already wraps cleanly it is returned unchanged; otherwise the true
    repeat found inside it is cropped and its joins feathered with its own duplicate."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    info = analyze_repeat(a)
    if info["seamless_as_is"]:
        info["used"] = "image as-is (already wraps)"
        return a, 0, info
    H, W = a.shape[:2]
    P, Q, D = info["P"], info["Q"], info["drop"]
    nb = info["nb"]
    if info["wrapx"] < 2.0 * nb:          # already wraps across: keep full width
        P, D = W, 0
    elif info["P_err"] > 3.0 * nb:
        P = None
    if info["wrapy"] < 2.0 * nb:          # already wraps down: keep full height
        Q = H
    elif info["Q_err"] > 3.0 * nb:
        Q = None
    if P is None or Q is None:
        info["used"] = "NO true repeat found; image tiled as-is (joins will show)"
        return a, 0, info
    info["P"], info["Q"], info["drop"] = P, Q, D
    # vertical: rows [0,Q) with rows [0,F) blended from rows [Q,Q+F)
    Fy = min(feather, H - Q)
    B = a[:Q].copy()
    if Fy > 0:
        w = (np.arange(Fy) / Fy)[:, None, None]
        B[:Fy] = a[Q:Q + Fy] * (1 - w) + a[:Fy] * w
    # horizontal: cols [0,P) with cols [0,F) blended from cols [P,P+F) (shifted by drop rows)
    Fx = min(feather, W - P)
    T = B[:, :P].copy()
    if Fx > 0:
        w = (np.arange(Fx) / Fx)[None, :, None]
        right = np.roll(B[:, P:P + Fx], -D, axis=0) if D else B[:, P:P + Fx]
        T[:, :Fx] = right * (1 - w) + B[:, :Fx] * w
    info["used"] = f"true repeat {P}x{Q} px found inside {W}x{H} web image" + (" (an axis that already wrapped kept full size)" if (P == W or Q == H) else "") + (f", half-drop offset {D}px" if D else ", straight match")
    return T, D, info

def sample_tile(tile, drop, u, v):
    """Bilinear sample of the repeat at tile-pixel coords u (across), v (down); arrays."""
    Ht, Wt = tile.shape[:2]
    if drop:
        col = np.floor(u / Wt)
        v = v - col * drop
    u = np.mod(u, Wt); v = np.mod(v, Ht)
    x0 = np.floor(u).astype(np.int64); y0 = np.floor(v).astype(np.int64)
    fx = (u - x0)[..., None]; fy = (v - y0)[..., None]
    x0 %= Wt; y0 %= Ht; x1 = (x0 + 1) % Wt; y1 = (y0 + 1) % Ht
    return (tile[y0, x0] * (1 - fx) * (1 - fy) + tile[y0, x1] * fx * (1 - fy)
            + tile[y1, x0] * (1 - fx) * fy + tile[y1, x1] * fx * fy)

# ---------------------------------------------------------------- helpers

PAPER_BACK = np.array([242, 235, 221], np.float32)   # plain cream paper back

def _plate(name, size):
    im = Image.open(os.path.join(PLATES, name)).convert("RGB")
    return np.asarray(im.resize(size, Image.LANCZOS)).astype(np.float32)

def _blur(a, s):
    if a.ndim == 3:
        return np.stack([ndimage.gaussian_filter(a[..., c], s) for c in range(a.shape[2])], -1)
    return ndimage.gaussian_filter(a, s)

def _grain(h, w, seed, amp=2.2):
    rng = np.random.default_rng(seed)
    n = ndimage.gaussian_filter(rng.standard_normal((h, w)), 0.7)
    return (n / (n.std() + 1e-6) * amp).astype(np.float32)

def _save(img, out, size):
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    im.save(out, quality=85, optimize=True, progressive=True)
    return out

# ---------------------------------------------------------------- peel (room) scene

WALL_PAINT = np.array([246, 243, 237], np.float32)
ROOM_PLATE = dict(file="room-wall.png", wall_bottom=567.0 / 768, frame_w_in=116.0, wall_ref=247.0)

DEFAULT_CURLS_OLD = [  # per panel (cycled): list of corner curls; a_in along bottom, b_in up the side, r_in curl radius
    [dict(corner="L", a=11.0, b=8.0, r=2.4), dict(corner="R", a=7.0, b=5.5, r=1.8)],
    [dict(corner="L", a=6.0, b=6.5, r=1.6), dict(corner="R", a=14.0, b=10.0, r=3.0)],
    [dict(corner="L", a=9.0, b=7.0, r=2.2), dict(corner="R", a=10.0, b=8.5, r=2.4)],
]

DEFAULT_CURLS = [[{'corner': 'L', 'a': 13.0, 'b': 10.0, 'r': 1.9}, {'corner': 'R', 'a': 9.0, 'b': 7.0, 'r': 1.5}], [{'corner': 'L', 'a': 8.0, 'b': 8.5, 'r': 1.4}, {'corner': 'R', 'a': 16.0, 'b': 12.0, 'r': 2.3}], [{'corner': 'L', 'a': 11.0, 'b': 8.0, 'r': 1.7}, {'corner': 'R', 'a': 10.5, 'b': 9.5, 'r': 1.8}]]

def _curl_layers(X, Y, panel, yb, curl, ppi):
    """Page-curl geometry for one panel's bottom corner, in working pixels.
    Returns (front_src_x, front_src_y, front_valid, front_shade,
             back_valid, back_shade, revealed, ao)."""
    x0, x1 = panel
    a, b, r = curl["a"] * ppi, curl["b"] * ppi, curl["r"] * ppi
    if curl["corner"] == "R":
        C = np.array([x1, yb]); A = np.array([x1 - a, yb]); B = np.array([x1, yb - b])
    else:
        C = np.array([x0, yb]); A = np.array([x0 + a, yb]); B = np.array([x0, yb - b])
    t = (B - A) / np.linalg.norm(B - A)
    n = np.array([-t[1], t[0]])
    if np.dot(C - A, n) < 0:
        n = -n
    d = (X - A[0]) * n[0] + (Y - A[1]) * n[1]
    inside = lambda sx, sy: (sx >= x0) & (sx < x1) & (sy >= 0) & (sy < yb)
    # front layer (printed face)
    dd = np.clip(d / r, -1, 1)
    s_f = np.where(d <= 0, d, r * np.arcsin(dd))
    fx = X + (s_f - d) * n[0]; fy = Y + (s_f - d) * n[1]
    f_ok = (d < r) & inside(fx, fy)
    theta = np.where(d > 0, np.arcsin(dd), 0.0)          # 0 flat .. pi/2 facing sideways
    f_shade = 1.0 - 0.45 * (1 - np.cos(theta)) - 0.10 * np.sin(theta)
    # back layer (plain paper back, flipped over the cylinder, on top)
    s_b = np.where(d >= 0, r * (np.pi - np.arcsin(dd)), np.pi * r - d)
    bx = X + (s_b - d) * n[0]; by = Y + (s_b - d) * n[1]
    b_ok = (d <= r) & inside(bx, by) & (s_b > 0)
    phi = np.where(d >= 0, np.pi - np.arcsin(dd), np.pi)   # angle round the cylinder
    # cylinder part: rim (phi ~ pi/2) brightest, flat flipped part slightly shaded
    b_shade = np.where(d >= 0, 0.78 + 0.24 * np.sin(phi), 1.0 - 0.06 * np.clip(-d / (6 * r), 0, 1))
    revealed = (d > 0) & (X >= x0) & (X < x1) & (Y < yb)
    ao = np.where(revealed, 1.0 - 0.38 * np.exp(-np.maximum(d - r, 0) / (1.2 * r)), 1.0)
    return fx, fy, f_ok, f_shade, b_ok, b_shade, revealed, ao, (bx, by)

def render_peel(tile_path, repeat_in, out, panel_in=52.0, size=(1536, 1152), ss=2,
                first_seam_in=14.0, curls=None, v_offset_in=0.0, plate=None):
    """Hang the design as panels on the room plate with every panel's bottom corner curling."""
    pl = dict(ROOM_PLATE, **(plate or {}))
    tile, drop, info = extract_repeat(tile_path)
    W, H = size[0] * ss, size[1] * ss
    base = _plate(pl["file"], (W, H))
    yb = pl["wall_bottom"] * H
    ppi = W / pl["frame_w_in"]                  # working px per inch on the wall
    tpi = tile.shape[1] / repeat_in             # tile px per inch
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    X += 0.5; Y += 0.5
    # wall light from the plate itself (broad gradient only)
    lum = base.mean(2)
    wallmask = Y < yb - 2 * ss
    L = np.where(wallmask, lum, np.nan)
    L = np.where(np.isnan(L), np.nanmedian(L[int(yb * 0.6):int(yb - 4 * ss)], 0)[None, :].repeat(H, 0), L)
    S = _blur(L, 18 * ss) / pl["wall_ref"]
    S = np.clip(S, 0.55, 1.08)[..., None]
    grain = (1 + _grain(H, W, 11, 1.0) / 255.0)[..., None]

    def paper(px, py):
        u = px / ppi * tpi; v = (py / ppi + v_offset_in) * tpi
        return sample_tile(tile, drop, u, v)

    img = base.copy()
    inwall = Y < yb
    flat = paper(X, Y)
    img = np.where(inwall[..., None], flat * S * grain, img)
    curls = curls or DEFAULT_CURLS
    # panel edges
    seams = [first_seam_in * ppi + k * panel_in * ppi for k in range(-1, int(W / (panel_in * ppi)) + 2)]
    panels = [(max(0.0, seams[k]), min(float(W), seams[k + 1])) for k in range(len(seams) - 1)
              if seams[k + 1] > 0 and seams[k] < W]
    backs = []
    for i, (x0, x1) in enumerate(panels):
        if x1 - x0 < 6 * ppi:
            continue
        for c in curls[i % len(curls)]:
            c = dict(c)
            if (c["corner"] == "R" and x1 >= W - 1) or (c["corner"] == "L" and x0 <= 0):
                continue
            c["a"] = min(c["a"], (x1 - x0) / ppi * 0.45)
            pad = int((max(c["a"], c["b"]) + 3 * c["r"]) * ppi) + 8
            cx = x1 if c["corner"] == "R" else x0
            bx0, bx1 = int(max(0, cx - pad)), int(min(W, cx + pad))
            by0, by1 = int(max(0, yb - pad * 1.6)), int(min(H, yb + 2))
            Xs, Ys = X[by0:by1, bx0:bx1], Y[by0:by1, bx0:bx1]
            fx, fy, f_ok, f_sh, b_ok, b_sh, rev, ao, _ = _curl_layers(Xs, Ys, (x0, x1), yb, c, ppi)
            reg = img[by0:by1, bx0:bx1]
            Sreg = S[by0:by1, bx0:bx1]
            wall = WALL_PAINT * Sreg * ao[..., None]          # bare wall under the lifted corner
            reg = np.where(rev[..., None], wall, reg)
            front = paper(fx, fy) * Sreg * f_sh[..., None]          # printed face rising into the curl
            fm = f_ok & (((Xs >= x0) & (Xs < x1)) | rev)
            reg = np.where(fm[..., None], front, reg)
            img[by0:by1, bx0:bx1] = reg
            backs.append((by0, by1, bx0, bx1, b_ok, b_sh, Sreg))
    # 3) shadows of every flap (light from upper left -> shadow down/right), then the flaps
    for by0, by1, bx0, bx1, b_ok, b_sh, Sreg in backs:
        a = ndimage.gaussian_filter(b_ok.astype(np.float32), 5 * ss)
        a = ndimage.shift(a, (5 * ss, 8 * ss), order=1, mode='nearest')
        img[by0:by1, bx0:bx1] *= (1 - 0.50 * a)[..., None]
    for by0, by1, bx0, bx1, b_ok, b_sh, Sreg in backs:
        back = PAPER_BACK * Sreg ** 0.3 * (0.55 + 0.45 * b_sh)[..., None] * (1 + _grain(by1 - by0, bx1 - bx0, 3, 1.5) / 255.0)[..., None]
        m = ndimage.gaussian_filter(b_ok.astype(np.float32), 0.6 * ss)[..., None]
        img[by0:by1, bx0:bx1] = img[by0:by1, bx0:bx1] * (1 - m) + back * m
    # 4) butt seams: hairline, barely visible
    for sx in seams:
        if 2 < sx < W - 2:
            xi = int(round(sx))
            col = (Y[:, 0] < yb)
            img[col, xi - ss:xi] *= 0.955
            img[col, xi:xi + ss] *= 1.025
    # wallpaper meets baseboard: keep the plate's own shadow line
    return _save(img, out, size), info

# ---------------------------------------------------------------- roll scene

BACKDROP_PLATE = dict(file="backdrop.png")

def _norm(v):
    return v / np.linalg.norm(v)

def render_roll(tile_path, repeat_in, out, sheet_w_in=52.0, roll_d_in=13.0, size=(1536, 1152), ss=2,
                cam=(70.0, 24.0, 92.0), target=(6.0, 18.0, -6.0), hfov_deg=44.0, floor_row=0.90,
                light=(-0.55, 0.65, 0.55), v_offset_in=0.0, plate=None):
    """A length of wallpaper hanging straight down with a big roll at the bottom, rolled
    BACKWARDS (away from the viewer), so the roll's outside is the continuation of the printed
    face; the roll end shows the spiral of plain paper layers around a cardboard core.
    World: inches, x right, y up (floor y=0), z toward the camera; sheet plane z=0."""
    pl = dict(BACKDROP_PLATE, **(plate or {}))
    tile, drop, info = extract_repeat(tile_path)
    tpi = tile.shape[1] / repeat_in
    W, H = size[0] * ss, size[1] * ss
    base = _plate(pl["file"], (W, H))
    R = roll_d_in / 2.0; hw = sheet_w_in / 2.0
    C = np.array(cam, float); T = np.array(target, float)
    f = _norm(T - C); rgt = _norm(np.cross(f, [0, 1, 0])); up = np.cross(rgt, f)
    fpx = (W / 2) / math.tan(math.radians(hfov_deg / 2))
    J, I = np.mgrid[0:H, 0:W].astype(np.float64)
    px = (I + 0.5 - W / 2) / fpx; py = -(J + 0.5 - H / 2) / fpx
    D = f[None, None, :] + px[..., None] * rgt + py[..., None] * up
    D /= np.linalg.norm(D, axis=2, keepdims=True)
    Dx, Dy, Dz = D[..., 0], D[..., 1], D[..., 2]
    INF = 1e9
    # 1) sheet plane z=0, above the tangent line y=R
    ts = np.where(np.abs(Dz) > 1e-9, -C[2] / Dz, INF)
    sx, sy = C[0] + ts * Dx, C[1] + ts * Dy
    ok_s = (ts > 0) & (np.abs(sx) <= hw) & (sy >= R)
    ts = np.where(ok_s, ts, INF)
    # 2) cylinder (y-R)^2 + (z+R)^2 = R^2
    oy, oz = C[1] - R, C[2] + R
    a = Dy ** 2 + Dz ** 2; b = 2 * (oy * Dy + oz * Dz); c = oy ** 2 + oz ** 2 - R ** 2
    disc = b * b - 4 * a * c
    sq = np.sqrt(np.maximum(disc, 0))
    tc = (-b - sq) / (2 * a + 1e-12)
    cx = C[0] + tc * Dx
    ok_c = (disc > 0) & (tc > 0) & (np.abs(cx) <= hw)
    tc = np.where(ok_c, tc, INF)
    # 3) end caps x = +-hw
    tcap = INF * np.ones_like(tc); capside = np.zeros_like(tc)
    for sgn in (1.0, -1.0):
        tt = np.where(np.abs(Dx) > 1e-9, (sgn * hw - C[0]) / Dx, INF)
        yy, zz = C[1] + tt * Dy, C[2] + tt * Dz
        ok = (tt > 0) & ((yy - R) ** 2 + (zz + R) ** 2 <= R ** 2)
        better = ok & (tt < tcap)
        tcap = np.where(better, tt, tcap); capside = np.where(better, sgn, capside)
    tmin = np.minimum(np.minimum(ts, tc), tcap)
    hit = tmin < INF / 2
    L = _norm(np.array(light, float))
    img = base.copy()
    # sheet shading
    def lam(nx, ny, nz):
        return 0.50 + 0.55 * np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    m_s = hit & (ts == tmin)
    m_c = hit & (tc == tmin) & ~m_s
    m_e = hit & (tcap == tmin) & ~m_s & ~m_c
    s_tan = 200.0                                      # arc length from sheet top to the tangent line
    col = np.zeros((H, W, 3), np.float32)
    # sheet
    u = (sx + hw) * tpi; v = (200.0 - sy + v_offset_in) * tpi
    sh = lam(0, 0, 1) * (0.92 + 0.08 * np.clip((sy - R) / 60.0, 0, 1)) * (1 + 0.025 * np.sin(sx / 7.0 + 1.3) + 0.015 * np.sin(sx / 2.9))
    col = np.where(m_s[..., None], sample_tile(tile, drop, u, v) * sh[..., None] / 255.0 * 255.0, col)
    # cylinder (outer layer, printed face out): phi from the front tangent point, downward
    cy_ = C[1] + tc * Dy - R; cz_ = C[2] + tc * Dz + R
    phi = np.mod(np.arctan2(-cy_, cz_), 2 * np.pi)
    s = (200.0 - R) + R * phi
    u = (cx + hw) * tpi; v = (s + v_offset_in) * tpi
    nyy, nzz = cy_ / R, cz_ / R
    shc = lam(0, nyy, nzz)
    # occlusion where the roll meets the floor and under the sheet's tangent
    shc = shc * (1 - 0.35 * np.exp(-((phi - np.pi / 2) ** 2) / 0.25))
    col = np.where(m_c[..., None], sample_tile(tile, drop, u, v) * shc[..., None], col)
    # end cap: spiral of paper edges, cardboard core, hollow centre
    ex = C[1] + tcap * Dy - R; ez = C[2] + tcap * Dz + R
    rho = np.sqrt(ex ** 2 + ez ** 2); ang = np.arctan2(ex, ez)
    core_r, hole_r = 0.95, 0.75
    pitch = 0.16
    ring = 0.5 + 0.5 * np.cos(2 * np.pi * (rho - core_r) / pitch + ang)       # spiral
    paper_edge = PAPER_BACK * (0.84 + 0.14 * ring[..., None])
    core = np.array([176, 140, 98], np.float32)[None, None, :] * np.ones_like(paper_edge)
    hole = np.array([60, 48, 36], np.float32)[None, None, :] * np.ones_like(paper_edge)
    capc = np.where((rho < hole_r)[..., None], hole, np.where((rho < core_r)[..., None], core, paper_edge))
    she = (0.66 + 0.10 * np.clip(rho / R, 0, 1)) * np.ones_like(rho)
    col = np.where(m_e[..., None], capc * she[..., None], col)
    # paper micro-texture
    col *= (1 + _grain(H, W, 5, 1.2) / 255.0)[..., None]
    # shadows on the backdrop/floor: soft cast shadow to the right + contact shadow under the roll
    mask = hit.astype(np.float32)
    sh1 = ndimage.shift(ndimage.gaussian_filter(mask, 22 * ss), (6 * ss, 26 * ss), order=1, mode='nearest')
    img *= (1 - 0.20 * sh1)[..., None]
    # floor contact: rays hitting y=0 near the roll's contact line z=-R
    tf = np.where(Dy < -1e-6, -C[1] / Dy, INF)
    fx_, fz_ = C[0] + tf * Dx, C[2] + tf * Dz
    dist = np.sqrt(np.maximum(np.abs(fx_) - hw, 0) ** 2 + (fz_ + R) ** 2)
    ao = 1 - 0.55 * np.exp(-dist / 1.6) - 0.18 * np.exp(-np.maximum(dist - 1, 0) / 6)
    ao = np.where(tf < INF / 2, ao, 1.0)
    img *= ao[..., None]
    # antialias the object edge a little
    m = ndimage.gaussian_filter(mask, 0.5 * ss)[..., None]
    img = img * (1 - m) + col * m
    return _save(img, out, size), info

# ---------------------------------------------------------------- CLI

def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="Wallpaper mockups v2")
    ap.add_argument("tile"); ap.add_argument("repeat_in", type=float)
    ap.add_argument("--out", default="."); ap.add_argument("--name", default="design")
    ap.add_argument("--panel-in", type=float, default=52.0)
    ap.add_argument("--only", choices=["peel", "roll"], default=None)
    a = ap.parse_args(argv)
    if a.only in (None, "peel"):
        p, info = render_peel(a.tile, a.repeat_in, os.path.join(a.out, f"{a.name}-peel.jpg"), panel_in=a.panel_in)
        print(p, info["used"])
    if a.only in (None, "roll"):
        p, info = render_roll(a.tile, a.repeat_in, os.path.join(a.out, f"{a.name}-roll.jpg"), sheet_w_in=a.panel_in)
        print(p, info["used"])

if __name__ == "__main__":
    main()
