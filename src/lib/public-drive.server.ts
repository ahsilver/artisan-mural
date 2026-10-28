import { driveFileId, ORIGINAL_LIMIT } from './original-source';
export function allowedDriveDownload(url: string) {
 const u=new URL(url);
 return u.protocol==='https:' && !u.username && !u.password && (u.hostname==='drive.google.com'||u.hostname==='drive.usercontent.google.com'||u.hostname==='docs.google.com'||u.hostname.endsWith('.googleusercontent.com'));
}
export async function downloadPublicDrive(link:string) {
 const id=driveFileId(link),input=new URL(link);
 const start=new URL('https://drive.usercontent.google.com/download');start.searchParams.set('id',id);start.searchParams.set('export','download');start.searchParams.set('confirm','t');
 const resource=input.searchParams.get('resourcekey');if(resource&&/^[\w-]{1,200}$/.test(resource))start.searchParams.set('resourcekey',resource);
 let url=start.toString(),response:Response|undefined;
 for(let hop=0;hop<6;hop++){
  if(!allowedDriveDownload(url))throw new Error('Google redirected to an unsupported download location. Upload the original instead.');
  response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(120000)});
  if(![301,302,303,307,308].includes(response.status))break;
  const next=response.headers.get('location');await response.body?.cancel();if(!next)throw new Error('Google returned an incomplete redirect.');url=new URL(next,url).toString();
 }
 if(!response?.ok||!response.body)throw new Error('Google blocked this download. Share the file with anyone who has the link and allow downloads, or upload the original directly.');
 const type=(response.headers.get('content-type')??'').split(';')[0]?.trim();
 if(type==='text/html'||type==='text/plain'){await response.body.cancel();throw new Error('Google requires a sign-in, confirmation or download permission for this file. We cannot bypass it; enable public downloads or upload the original.');}
 const declared=Number(response.headers.get('content-length'));
 if(declared>ORIGINAL_LIMIT){await response.body.cancel();throw new Error('Originals must be 250 MB or smaller.');}
 const reader=response.body.getReader(),first=await reader.read();if(first.done)throw new Error('Google returned an empty file.');
 const b=first.value;const mime=b[0]===255&&b[1]===216?'image/jpeg':b[0]===137&&b[1]===80?'image/png':new TextDecoder().decode(b.slice(0,5))==='%PDF-'?'application/pdf':((b[0]===73&&b[1]===73)||(b[0]===77&&b[1]===77))?'image/tiff':null;
 if(!mime){await reader.cancel();throw new Error('The Drive link must point to an original JPG, PNG, TIFF or vector PDF.');}
 if(first.value.length>ORIGINAL_LIMIT){await reader.cancel();throw new Error('Original exceeds 250 MB.');}
 let size=first.value.length,pending=true;
 const stream=new ReadableStream<Uint8Array>({async pull(controller){try{if(pending){pending=false;controller.enqueue(first.value);return;}const item=await reader.read();if(item.done){if(declared&&size!==declared)throw new Error('Incomplete Drive download.');controller.close();return;}size+=item.value.length;if(size>ORIGINAL_LIMIT)throw new Error('Original exceeds 250 MB.');controller.enqueue(item.value);}catch(error){await reader.cancel();controller.error(error);}},cancel(){return reader.cancel();}});
 const disposition=response.headers.get('content-disposition')??'';
 const filename=disposition.match(/filename="([^"]+)"/)?.[1]?.slice(0,200)??`drive-${id}.${mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/tiff'?'tif':'pdf'}`;
 return {stream,mime,filename,byteSize:()=>size};
}