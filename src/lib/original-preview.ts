// Browser-only decoding: never import PDF.js or TIFF decoders into server handlers.
export async function originalBitmap(file: Blob): Promise<ImageBitmap> {
  if (file.type === 'image/tiff') {
    const UTIF = await import('utif');
    const bytes = await file.arrayBuffer(), ifd = UTIF.decode(bytes)[0];
    if (!ifd) throw new Error('TIFF has no image.');
    const width = Number((ifd['t256'] as number[])?.[0]), height = Number((ifd['t257'] as number[])?.[0]);
    if (width * height > 40000000) throw new Error('This TIFF needs specialist preview processing. Export the same original as JPG/PNG, without reducing resolution.');
    UTIF.decodeImage(bytes, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    return createImageBitmap(new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height));
  }
  return createImageBitmap(file, { imageOrientation: 'none' });
}
export async function makeOriginalPreview(file: Blob) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create artwork preview.');
  if (file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())});
    const doc = await task.promise;
    try {
      const page = await doc.getPage(1), base = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:1600 / Math.max(base.width,base.height)});
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({canvas,canvasContext:ctx,viewport}).promise;
    } finally { await task.destroy(); }
  } else {
    const bitmap = await originalBitmap(file);
    const scale = Math.min(1,1600 / Math.max(bitmap.width,bitmap.height));
    canvas.width = Math.max(1,Math.round(bitmap.width * scale)); canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  }
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not save preview.')),'image/jpeg',0.85));
}