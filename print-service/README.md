# Print service (huge originals)

Makes full-size print files from originals too big for the browser (tested with a 2.8 GB, 27,720 × 25,200 px CMYK TIFF).
The owner sets the crop or repeat on a light preview in **Back office → Make a print file**; this service builds the TIFF
from the full original and stores it in R2. The back office then shows **Download**.

- `server.py` + `Dockerfile`: the container (libvips). Places every draw from `printGeometry`, so the print matches the preview.
  It writes LZW TIFF with the DPI, and keeps CMYK and the colour profile.
- `worker/`: the `artisan-print` Worker. It runs the container (Cloudflare Containers) and a Durable Object that runs
  jobs in the background, then writes the result to the site's D1 and R2.

Test result: the 2.8 GB file took about 32 s in the container, using under 400 MB of memory. A 12 × 9 ft wall at
150 DPI came out at 21,600 × 16,200 px, about 740 MB.

## Before deploying (the owner)

1. Cloudflare **Workers Paid** plan with **Containers** turned on.
2. An API token with Workers Scripts, Containers, D1 and R2 edit permissions. Give it through the secure form, never in chat.
3. In `worker/wrangler.jsonc`, replace `REPLACE_WITH_SITE_D1_ID` and `REPLACE_WITH_SITE_R2_BUCKET` with the site's own D1
   database id and R2 bucket.

## Deploy

Docker must be running, because wrangler builds the image.

```bash
cd print-service/worker && npm install && npx wrangler deploy
```

Then, on the site's Pages project, go to **Settings → Bindings**, add a **Service binding** named `PRINT` that points to
`artisan-print`, and redeploy the site. Without that binding the back office says "The print service isn't set up yet."

## Local testing

```bash
docker build --platform linux/amd64 -t artisan-print:test print-service
```

```bash
docker run -d --rm --name ap-test -p 8096:8080 artisan-print:test
```

Run the site with `--binding PRINT_URL=http://127.0.0.1:8096`, and jobs run inline.
