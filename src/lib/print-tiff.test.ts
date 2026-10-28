import {describe,it,expect} from 'vitest';
import {tiffDimensions,tiffHeader} from './print-tiff';
import * as UTIF from 'utif';
describe('exact-size TIFF',()=>{
 it('exports 10 by 8 feet as 30000 by 24000 pixels or rejects the browser limit without shrinking',()=>{expect(tiffDimensions(12,12)).toEqual({width:3000,height:3000});expect(()=>tiffDimensions(120,96)).toThrow('browser export limit');});
 it('records physical inches and RGB strip layout in readable TIFF',()=>{const header=tiffHeader(500,250,2,1);const data=new Uint8Array(header.length+500*250*3);data.set(header);const ifd=UTIF.decode(data.buffer)[0];expect(ifd?.['t256']).toEqual([500]);expect(ifd?.['t257']).toEqual([250]);expect(ifd?.['t282']).toEqual([250]);expect(ifd?.['t283']).toEqual([250]);expect(ifd?.['t296']).toEqual([2]);});
});