import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import type { Design } from './catalog';
import { frameGeometry, measurementInches, repeatStyle, tileGeometry, wallSelectionSchema, type WallSelection } from './wall-selection';
/** Lowest print DPI at final size (same as the back-office rule "Lowest DPI allowed"; wallpaper standard 150, 200+ recommended). */
export const MIN_PRINT_DPI = 150;
export const MAX_PRINT_SOURCE_BYTES = 250 * 1024 * 1024;
/** Half-drop match, whether stored as match: 'halfdrop' (catalog) or repeat: 'halfdrop' (saved order snapshot). */
export function isHalfDrop(design: {repeat?: string; match?: string}) { return design.match === 'halfdrop' || design.repeat === 'halfdrop'; }
export type PrintDesign = Pick<Design, 'kind' | 'repeatCm' | 'printHeightCm'> & {repeat?: Design['repeat'] | 'halfdrop'; match?: Design['match']};
export function printGeometry(design: PrintDesign, input: WallSelection) {
  const s = wallSelectionSchema.parse(input);
  const widthIn = measurementInches(s.width, s.unit), heightIn = measurementInches(s.height, s.unit);
  if (widthIn > 2000 || heightIn > 2000) throw new Error('This wall needs a specialist large-format print file.');
  const normalized = isHalfDrop(design) ? {...design, repeat: 'both' as const} : design;
  if (repeatStyle(normalized) === 'none') {
    const f = frameGeometry(s);
    return { widthIn, heightIn, draws: [{ x: -(f.x-f.w/2)/f.w, y: -(f.y-f.h/2)/f.h, w: 1/f.w, h: 1/f.h }] };
  }
  const {tw, th, style} = tileGeometry(normalized, s);
  const x = -s.x*tw, y = style === 'both' ? -s.y*th : -s.y*Math.max(0, th-1);
  // Half-drop: every second column (strip of one repeat width) sits half a repeat lower, so the motifs
  // connect diagonally across the seams. Column 0 is the tile origin, the same one the preview uses.
  const hd = style === 'both' && isHalfDrop(design);
  const cols = Math.ceil((1-x)/tw), rows = style === 'both' ? Math.ceil((1-y)/th) + (hd ? 1 : 0) : 1;
  if (cols*rows > 10000) throw new Error('This repeat needs a specialist large-format print file.');
  return {widthIn, heightIn, draws: Array.from({length: cols*rows}, (_,i)=>{const c=i%cols;return {x:x+c*tw,y:y+Math.floor(i/cols)*th-(hd && c%2 ? th/2 : 0),w:tw,h:th};})};
}
export function effectivePrintDpi(w: number, h: number, geometry: ReturnType<typeof printGeometry>) {
  const d = geometry.draws[0];
  if (!d) throw new Error('No print area found.');
  return Math.min(w/(geometry.widthIn*d.w), h/(geometry.heightIn*d.h));
}
export async function createPrintPdf(bytes: Uint8Array, design: PrintDesign, selection: WallSelection, title: string, minDpi: number = MIN_PRINT_DPI) {
  if (!bytes.length || bytes.length > MAX_PRINT_SOURCE_BYTES) throw new Error('Choose an original PDF, JPG or PNG up to 250 MB.');
  const geometry = printGeometry(design, selection), output = await PDFDocument.create();
  let image, embedded, ratio: number, dpi: number | null = null;
  if (new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-') {
    const source = await PDFDocument.load(bytes);
    if (source.getPageCount() !== 1) throw new Error('The original PDF must contain exactly one artwork page.');
    if (source.context.enumerateIndirectObjects().some(([,o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))) throw new Error('This PDF contains raster images whose print resolution cannot be verified here. Use the original high-resolution JPG/PNG or request professional PDF preflight.');
    const page = source.getPage(0);
    if (page.getRotation().angle !== 0 || page.node.get(PDFName.of('UserUnit'))) throw new Error('Export an unrotated, standard-unit original PDF before printing.');
    const b = page.getCropBox(); ratio = b.width/b.height;
    embedded = await output.embedPage(page, {left:b.x,bottom:b.y,right:b.x+b.width,top:b.y+b.height});
  } else if ((bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) || (bytes[0] === 255 && bytes[1] === 216)) {
    image = bytes[0] === 137 ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    ratio = image.width/image.height;
    dpi = effectivePrintDpi(image.width,image.height,geometry);
    if (dpi+1e-6 < minDpi) throw new Error(`Original artwork is only ${Math.floor(dpi)} DPI at this crop/scale; at least ${minDpi} DPI is required. Request a higher-resolution original; enlarging it will not add detail.`);
  } else throw new Error('Choose an original PDF, JPG or PNG, not a website preview or room mockup.');
  if (Math.abs(ratio/selection.artRatio-1) > 0.005) throw new Error('Original artwork proportions do not match this order. Check the selected color and original file.');
  const unit = Math.max(1,Math.ceil(Math.max(geometry.widthIn,geometry.heightIn)/200));
  const width = geometry.widthIn*72/unit, height = geometry.heightIn*72/unit;
  const page = output.addPage([width,height]);
  if (unit>1) page.node.set(PDFName.of('UserUnit'),output.context.obj(unit));
  for (const d of geometry.draws) {
    const options = {x:d.x*width,y:(1-d.y-d.h)*height,width:d.w*width,height:d.h*height};
    if (image) page.drawImage(image, options); else if (embedded) page.drawPage(embedded,options);
  }
  output.setTitle(title); output.setCreator('Artisan Mural print production');
  output.setSubject(`${geometry.widthIn} x ${geometry.heightIn} inches; ${dpi === null ? 'vector source preserved' : `${Math.floor(dpi)} effective DPI`}; print at actual size`);
  return {bytes:await output.save(),widthIn:geometry.widthIn,heightIn:geometry.heightIn,dpi};
}
