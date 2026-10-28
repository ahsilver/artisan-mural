export type SavedRoomPhoto = { id: string; name: string; blob: Blob; createdAt: number };
const STORE = "photos";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("artisan-room-photos", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export async function savedRoomPhotos(): Promise<SavedRoomPhoto[]> {
  const photos = await operation("readonly", store => store.getAll()) as SavedRoomPhoto[];
  return photos.sort((a, b) => b.createdAt - a.createdAt);
}

export async function rememberRoomPhoto(blob: Blob, name: string) {
  const photo: SavedRoomPhoto = { id: crypto.randomUUID(), name, blob, createdAt: Date.now() };
  await operation("readwrite", store => store.put(photo));
  const photos = await savedRoomPhotos();
  await Promise.all(photos.slice(6).map(p => forgetRoomPhoto(p.id)));
  return photo;
}

export async function forgetRoomPhoto(id: string) {
  await operation("readwrite", store => store.delete(id));
}