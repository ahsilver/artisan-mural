# Wallpaper mockups v2 (automatic, design never redrawn)

Two templates. The design is only resampled from its repeat tile by code (bilinear), never redrawn by AI.

- peel: photoreal empty modern room (plates/room-wall.png: flat off-white wall, tall flat modern baseboard,
  white-oak plank floor, soft daylight from the left). The design is hung as 52 in panels at true scale,
  pattern matched across panels; joins are hairlines. Every panel's bottom corner(s) curl off the wall
  (cylinder page-curl): printed face rising into the curl, plain cream paper back, bare wall + shadow under it.
  Wall light/falloff is taken from the plate itself and multiplied onto the paper.
- roll: a hanging length of paper with a big roll (13 in dia) at the bottom, on a plain studio backdrop
  (plates/backdrop.png). Ray-cast by code. The roll is wound BACKWARDS (away from the viewer), so the
  roll's outside is the same printed face as the hanging sheet (physically correct: the pattern is only on
  one side); the roll end shows the spiral of plain paper layers and the cardboard core.

## Repeat check (important)
The web JPGs on the site are NOT clean repeat tiles: e.g. design-fern.jpg (1024x1280) has a true repeat of
652x1117 px inside it, and tiling the whole image puts a hard line every tile (the "lines" the owner saw).
extract_repeat() finds the true repeat (straight or half-drop), crops it and feathers the joins with the
image's own duplicate content. Measured on the site's web images: fern 652x1117, arches ~488x592,
dots ~496x450 - none wrap as-is. The site's own Customize & Preview tiling likely shows the same lines.
analyze_repeat() prints the numbers; info["used"] says what was done per design.

## Run (python with numpy + Pillow + scipy, e.g. the kernel venv)
    python mockups.py <tile.jpg> <repeat_width_in> --out <dir> --name <slug> [--panel-in 52] [--only peel|roll]
  -> <dir>/<slug>-peel.jpg and <slug>-roll.jpg (1536x1152, JPG q85), ~10-20 s each.
From Python:
    import mockups
    mockups.render_peel("tile.jpg", 25.2, "out-peel.jpg")      # curls=, first_seam_in=, panel_in=
    mockups.render_roll("tile.jpg", 25.2, "out-roll.jpg")      # roll_d_in=, sheet_w_in=, cam=, target=

Samples: Fernhouse = app/src/assets/design-fern.jpg at 25.2 in (64 cm, applied to the true 652 px repeat);
sample-designs/chinoiserie-birds.png (original sample repeat made for the showcase) at 30 in.
Plates were generated once (empty scenes, no design in them); scene geometry is in ROOM_PLATE / render_roll.
mockups_v1.py is the old fully procedural version.

## Plugging into the site (not done)
On design approval (repeat designs): run both renders from the design's web image + repeat width, upload the
two JPGs to R2 next to the design images, show them as extra gallery images. Murals: render_peel needs the
mural scaled to the wall instead of tiled (small change in paper()).
