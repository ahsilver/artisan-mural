export const ORIGINAL_LIMIT = 250 * 1024 * 1024;
export function isDriveFolder(link: string) { return /drive\.google\.com\/(drive\/(u\/\d+\/)?)?folders\/[\w-]{10,}/.test(link) || /drive\.google\.com\/(open|drive\/folders)\?.*id=/.test(link) && /folder/.test(link); }
/** A short plain message from any error (never raw JSON from a validator). */
export function plainError(e: unknown, fallback: string) {
  let m = e instanceof Error ? e.message : String(e ?? '');
  if (/^\s*[\[{]/.test(m)) { try { const j = JSON.parse(m); const first = Array.isArray(j) ? j[0] : j; m = first?.message || first?.error || ''; } catch { m = ''; } }
  return m && m.length < 200 ? m : fallback;
}
export function driveFileId(link: string) {
  let url: URL; try { url = new URL(link.trim()); } catch { throw new Error('Paste a Google Drive link.'); }
  if (isDriveFolder(link)) throw new Error('That is a Drive folder: pick the pictures from it below.');
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password) throw new Error('Paste a Google Drive file link shared with anyone who has the link.');
  const id = url.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([\w-]+)/)?.[1] ?? url.searchParams.get('id');
  if (!id || !/^[\w-]{10,200}$/.test(id)) throw new Error('Use a link to one artwork file, not a Drive folder.');
  return id;
}
export function printSizeAt250(width: number, height: number) {
  return { widthCm: width / 250 * 2.54, heightCm: height / 250 * 2.54, widthFt: width / 3000, heightFt: height / 3000 };
}
export function originalType(file: Pick<File, 'name' | 'type'>) {
  const type = /\.tiff?$/i.test(file.name) ? 'image/tiff' : /\.pdf$/i.test(file.name) ? 'application/pdf' : /\.png$/i.test(file.name) ? 'image/png' : /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : file.type;
  if (!['image/jpeg','image/png','image/tiff','application/pdf'].includes(type)) throw new Error('Use an original JPG, PNG, TIFF or single-page vector PDF.');
  return type as 'image/jpeg' | 'image/png' | 'image/tiff' | 'application/pdf';
}