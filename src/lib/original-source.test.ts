import {describe,it,expect} from 'vitest';
import {driveFileId,printSizeAt250} from './original-source';
describe('single original rules',()=>{
 it('measures 30000 by 24000 pixels as 10 by 8 feet at 250 DPI',()=>{expect(printSizeAt250(30000,24000)).toEqual({widthCm:304.8,heightCm:243.84,widthFt:10,heightFt:8});});
 it('accepts only public Drive file URLs, never arbitrary fetch targets',()=>{expect(driveFileId('https://drive.google.com/file/d/abcdefghijk123/view')).toBe('abcdefghijk123');expect(()=>driveFileId('https://localhost/file/d/abcdefghijk123')).toThrow();expect(()=>driveFileId('https://drive.google.com/drive/folders/abcdefghijk123')).toThrow();});
});