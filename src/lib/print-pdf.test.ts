import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, rgb } from 'pdf-lib';
import { createPrintPdf, effectivePrintDpi, printGeometry } from './print-pdf';
import { initialWall } from './wall-selection';

describe('order print PDFs', () => {
  it('uses feet as physical inches with the exact selected crop', () => {
    const g = printGeometry({kind:'mural'}, {...initialWall,width:20,height:10,artRatio:2,zoom:0.5,x:0.5,y:0.5});
    expect(g.widthIn).toBe(240); expect(g.heightIn).toBe(120);
    expect(g.draws).toEqual([{x:-0.5,y:-0.5,w:2,h:2}]);
  });
  it('half-drop: every second column sits half a repeat lower, straight does not', () => {
    const sel = {...initialWall,width:120,height:20,unit:'in' as const,artRatio:1,zoom:1,x:0,y:0};
    const st = printGeometry({kind:'repeating',repeat:'both',repeatCm:25.4}, sel);
    const hd = printGeometry({kind:'repeating',repeat:'both',match:'halfdrop',repeatCm:25.4}, sel);
    const snap = printGeometry({kind:'repeating',repeat:'halfdrop',repeatCm:25.4}, sel);
    const col = (g: typeof st, x: number) => g.draws.filter((d) => Math.abs(d.x - x) < 1e-9).map((d) => d.y).sort((a, b) => a - b);
    const tw = st.draws[0]!.w, th = st.draws[0]!.h;
    expect(col(st, tw)[0]).toBeCloseTo(0);
    expect(col(hd, 0)[0]).toBeCloseTo(0);
    expect(col(hd, tw)[0]).toBeCloseTo(-th / 2);
    expect(col(hd, 2 * tw)[0]).toBeCloseTo(0);
    expect(snap.draws).toEqual(hd.draws);
    // every column still covers the full wall height
    for (const x of [0, tw, 2 * tw]) { const ys = col(hd, x); expect(ys[0]!).toBeLessThanOrEqual(0); expect(ys[ys.length - 1]! + th).toBeGreaterThanOrEqual(1); }
  });
  it('requires at least 250 effective DPI after crop, not before crop', () => {
    const g = printGeometry({kind:'mural'}, {...initialWall,width:10,height:8,zoom:0.5});
    expect(effectivePrintDpi(60000,48000,g)).toBe(250);
    expect(effectivePrintDpi(30000,24000,g)).toBe(125);
  });
  it('matches physical repeat size and customer phase', () => {
    const g = printGeometry({kind:'repeating',repeat:'both',repeatCm:25.4},{...initialWall,width:20,height:20,unit:'in',artRatio:1,zoom:2,x:0.25,y:0.75});
    expect(g.draws[0]).toEqual({x:-0.125,y:-0.375,w:0.5,h:0.5});
    expect(g.draws[1]?.x).toBe(0.375);
  });
  it('covers a whole 10 by 8 foot wall with 250-DPI repeat tiles without stretching', () => {
    const g = printGeometry({kind:'repeating',repeat:'both',repeatCm:25.4}, {...initialWall,width:10,height:8,unit:'ft',artRatio:1,zoom:2,x:0.37,y:0.61});
    expect(g.widthIn).toBe(120);
    expect(g.heightIn).toBe(96);
    expect(effectivePrintDpi(2500,2500,g)).toBeCloseTo(250,8);
    expect(g.draws[0]?.w).toBeCloseTo(10/120,8);
    for (const x of [0,0.25,0.5,0.75,0.999999]) for (const y of [0,0.25,0.5,0.75,0.999999]) {
      expect(g.draws.some(d=>d.x<=x && d.x+d.w>=x && d.y<=y && d.y+d.h>=y)).toBe(true);
    }
  });
  it('preserves large physical page size without rasterizing vector artwork', async () => {
    const src = await PDFDocument.create(); src.addPage([144,72]).drawRectangle({x:0,y:0,width:144,height:72,color:rgb(1,0,0)});
    const out = await createPrintPdf(await src.save(),{kind:'mural'},{...initialWall,width:20,height:10,artRatio:2,zoom:1},'test');
    const doc = await PDFDocument.load(out.bytes); const page=doc.getPage(0);
    expect(page.getWidth()).toBe(8640); expect(page.node.get(PDFName.of('UserUnit'))?.toString()).toBe('2');
    expect(out.dpi).toBeNull(); expect(out.widthIn).toBe(240);
  });
  it('refuses a low-resolution original (under the 150 DPI minimum) instead of upscaling it', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), c=>c.charCodeAt(0));
    await expect(createPrintPdf(png,{kind:'mural'},{...initialWall,artRatio:1},'test')).rejects.toThrow('at least 150 DPI');
    await expect(createPrintPdf(png,{kind:'mural'},{...initialWall,artRatio:1},'test',200)).rejects.toThrow('at least 200 DPI');
  });
  it('does not certify raster images hidden inside a PDF as vector artwork', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), c=>c.charCodeAt(0));
    const src = await PDFDocument.create(); const image = await src.embedPng(png);
    src.addPage([100,100]).drawImage(image,{x:0,y:0,width:100,height:100});
    await expect(createPrintPdf(await src.save(),{kind:'mural'},{...initialWall,artRatio:1},'test')).rejects.toThrow('professional PDF preflight');
  });
});