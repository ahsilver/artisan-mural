#!/usr/bin/env python3
"""Load the approved preview's starting catalog (designers, designs, colorways, room pictures) into the site.

Writes seed.sql (database rows) and uploads the pictures to file storage with wrangler.
  python3 ops/seed/seed_catalog.py local  <wrangler.toml dir> <persist dir>   # local test copy
  python3 ops/seed/seed_catalog.py remote <wrangler.toml dir>                 # the real Cloudflare account
Designers are created as approved studios with sign-in switched off (no password); the owner can edit or hide
everything afterwards in the back office. Running it twice is safe (fixed ids, INSERT OR REPLACE).
"""
import json, os, subprocess, sys, uuid
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
cat = json.load(open(os.path.join(HERE, 'catalog.json')))
NS = uuid.UUID('6f1c5f3e-2b8a-4c55-9d4e-a1b2c3d4e5f6')
uid = lambda *k: str(uuid.uuid5(NS, '/'.join(k)))
q = lambda v: 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"

ROOM = {'living': 'Living room', 'bedroom': 'Bedroom', 'kids': 'Kids & nursery', 'playroom': 'Kids & nursery', 'dining': 'Dining room', 'kitchen': 'Kitchen',
        'bathroom': 'Bathroom', 'entry': 'Hallway & stairs', 'office': 'Office & study', 'hotel': 'Commercial'}
STYLE = {'tropical': 'Tropical', 'jungle': 'Tropical', 'animals': 'Animals & birds', 'floral': 'Floral', 'botanical': 'Botanical', 'minimal': 'Minimal',
         'line-art': 'Watercolor', 'black-white': 'Modern', 'moody': 'Abstract', 'shadows': 'Botanical', 'ombre': 'Textured neutrals'}
TAGS = {'line-art': 'line art', 'black-white': 'black and white', 'moody': 'moody', 'shadows': 'shadows', 'ombre': 'ombre', 'jungle': 'jungle'}

sql, files = [], []  # files: (storage key inside the bucket, local path)
for d in cat['DESIGNERS']:
    u = uid('designer', d['slug'])
    sql.append(f"INSERT OR IGNORE INTO auth_users (id, email, password_hash) VALUES ({q(u)}, {q(d['slug'] + '@designers.artisanmurals.invalid')}, 'disabled');")
    sql.append(f"INSERT OR REPLACE INTO designer_profiles (user_id, full_name, studio_name, country, bio, styles, status, trusted, tagline, response_label, turnaround_days) VALUES "
               f"({q(u)}, {q(d['name'])}, {q(d['name'])}, {q(d.get('place', ''))}, {q(d.get('about', ''))}, {q(json.dumps(d.get('tags', [])))}, 'approved', 1, {q(d.get('line', ''))}, {q('Replies ' + d.get('responds', 'within a day'))}, {d.get('days') or 'NULL'});")
    # the database gives every approved designer an automatic "studio-…" address; set the real one after the profile
    sql.append(f"DELETE FROM designer_accounts WHERE user_id = {q(u)} OR slug = {q(d['slug'])};")
    sql.append(f"INSERT INTO designer_accounts (slug, user_id) VALUES ({q(d['slug'])}, {q(u)});")

by_name = {d['name']: d for d in cat['DESIGNERS']}
for d in cat['DESIGNS']:
    owner = uid('designer', by_name[d['by']]['slug'])
    up = uid('design', d['slug'])
    mural = d['kind'] != 'repeat'
    colorways = d.get('colorways') or [{'slug': d['slug'], 'name': 'Original'}]
    first = colorways[0]['slug']
    src = os.path.join(HERE, 'images', f"{first}-{'full' if mural or not os.path.exists(os.path.join(HERE, 'images', first + '-tile.webp')) else 'tile'}.webp")
    w, h = Image.open(src).size
    width_cm = round(cat['DESIGN_FT'].get(d['slug'], 12) * 30.48, 1) if mural else round(d.get('repeatIn', 24) * 2.54, 1)
    height_cm = round(width_cm * h / w, 1)
    cats = sorted({STYLE[s] for s in d.get('styles', []) if s in STYLE})
    rooms = sorted({ROOM[r] for r in d.get('rooms', []) if r in ROOM})
    tags = sorted({TAGS[s] for s in d.get('styles', []) if s in TAGS})
    repeat = 'none' if mural else ('halfdrop' if 'half' in d.get('match', '').lower() else 'both')
    sql.append(f"INSERT OR REPLACE INTO artwork_uploads (id, owner_id, title, kind, categories, made_for, width_cm, height_cm, max_print_width_cm, repeat_style, review_status, status, sku, story, description, tags, palette, submitted_at) VALUES "
               f"({q(up)}, {q(owner)}, {q(d['name'])}, {q('mural' if mural else 'repeat')}, {q(json.dumps(cats))}, {q(json.dumps(rooms))}, {width_cm}, {height_cm}, {width_cm if mural else 'NULL'}, {q(repeat)}, 'approved', 'live', {q(d.get('sku'))}, {q(d.get('ov'))}, {q(d.get('line'))}, {q(json.dumps(tags))}, {q(', '.join(d.get('colors', [])))}, strftime('%Y-%m-%dT%H:%M:%fZ','now'));")
    for pos, c in enumerate(colorways):
        cid = uid('colorway', d['slug'], c['slug'])
        kind = 'full' if mural or not os.path.exists(os.path.join(HERE, 'images', c['slug'] + '-tile.webp')) else 'tile'
        art = f"{owner}/{up}/{c['slug']}-{kind}.webp"
        files.append((art, os.path.join(HERE, 'images', f"{c['slug']}-{kind}.webp")))
        sql.append(f"INSERT OR REPLACE INTO artwork_colorways (id, upload_id, name, position, artwork_path) VALUES ({q(cid)}, {q(up)}, {q(c['name'])}, {pos}, {q(art)});")
        for n in (1, 2, 3):
            img = os.path.join(HERE, 'images', f"{c['slug']}-room{n}.webp")
            if not os.path.exists(img): continue
            mk = f"{owner}/{up}/{c['slug']}-room{n}.webp"
            files.append((mk, img))
            sql.append(f"INSERT OR REPLACE INTO artwork_mockups (id, colorway_id, room, image_path) VALUES ({q(uid('mockup', d['slug'], c['slug'], str(n)))}, {q(cid)}, {n}, {q(mk)});")

open(os.path.join(HERE, 'seed.sql'), 'w').write('\n'.join(sql) + '\n')
print(len(cat['DESIGNERS']), 'designers,', len(cat['DESIGNS']), 'designs,', len(files), 'pictures')

if len(sys.argv) > 2:
    mode, cfg = sys.argv[1], sys.argv[2]
    persist = ['--persist-to', sys.argv[3]] if mode == 'local' and len(sys.argv) > 3 else []
    where = ['--local'] if mode == 'local' else ['--remote']
    db, bucket = os.environ.get('SEED_DB', 'artisan-local'), os.environ.get('SEED_BUCKET', 'artisan-local')
    run = lambda args: subprocess.run(['npx', '-y', 'wrangler@3'] + args + where + persist, cwd=cfg, check=True, stdout=subprocess.DEVNULL)
    run(['d1', 'execute', db, '--file', os.path.join(HERE, 'seed.sql')])
    for key, path in files:
        run(['r2', 'object', 'put', f"{bucket}/designer-artwork/{key}", '--file', path, '--content-type', 'image/webp'])
    print('done')
