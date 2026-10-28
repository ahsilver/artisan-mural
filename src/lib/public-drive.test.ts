import {describe,it,expect,vi,afterEach} from 'vitest';
import {downloadPublicDrive,allowedDriveDownload} from './public-drive.server';
afterEach(()=>vi.unstubAllGlobals());
describe('public Drive downloads',()=>{
 it('restricts redirects to Google download hosts',()=>{expect(allowedDriveDownload('https://drive.usercontent.google.com/download')).toBe(true);expect(allowedDriveDownload('https://evil.test/')).toBe(false);expect(allowedDriveDownload('http://drive.google.com/')).toBe(false);});
 it('streams without keys or authorization',async()=>{const mock=vi.fn().mockResolvedValue(new Response(new Uint8Array([255,216,255,1]),{headers:{'content-length':'4','content-type':'image/jpeg'}}));vi.stubGlobal('fetch',mock);const result=await downloadPublicDrive('https://drive.google.com/file/d/abcdefghijk123/view');expect(await new Response(result.stream).arrayBuffer()).toEqual(new Uint8Array([255,216,255,1]).buffer);expect(result.byteSize()).toBe(4);expect(mock.mock.calls[0]?.[0]).not.toContain('key=');expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('headers');});
 it('rejects sign-in or confirmation pages',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>sign in</html>',{headers:{'content-type':'text/html'}})));await expect(downloadPublicDrive('https://drive.google.com/file/d/abcdefghijk123/view')).rejects.toThrow('cannot bypass');});
});
