import type { CloudSnapshot } from './driveCloud';

/** Device-local cache for published cloud data. Never stores Google credentials. */
const DB_NAME = 'waybook_published_cloud_cache';
const STORE_NAME = 'entries';
const SNAPSHOT_KEY = 'published-snapshot';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cannot open cloud cache'));
    request.onblocked = () => reject(new Error('Cloud cache is blocked'));
  });
}

async function readKeys(keys: string[]): Promise<unknown[]> {
  if (!keys.length) return [];
  const db = await openDb();
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const requests = keys.map(key => store.get(key));
      tx.oncomplete = () => resolve(requests.map(request => request.result));
      tx.onerror = () => reject(tx.error || new Error('Cannot read cached data'));
    });
  } finally { db.close(); }
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Cannot save cached data'));
    });
  } finally { db.close(); }
}

export async function readPublishedCache(): Promise<{snapshot: CloudSnapshot; photos: Record<string, string>} | null> {
  const [raw] = await readKeys([SNAPSHOT_KEY]);
  if (!raw || typeof raw !== 'object') return null;
  const snapshot = raw as CloudSnapshot;
  if (typeof snapshot.updatedAt !== 'string' || !snapshot.itinerary || !snapshot.galleries) return null;
  const ids = [...new Set(Object.values(snapshot.galleries).flat())];
  const values = await readKeys(ids.map(id => `photo:${id}`));
  const photos: Record<string, string> = {};
  ids.forEach((id, i) => {
    const image = values[i];
    if (typeof image === 'string' && image.startsWith('data:image/')) photos[id] = image;
  });
  return { snapshot, photos };
}

export async function readCachedPhotos(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const values = await readKeys(unique.map(id => `photo:${id}`));
  const photos: Record<string, string> = {};
  unique.forEach((id, i) => {
    const image = values[i];
    if (typeof image === 'string' && image.startsWith('data:image/')) photos[id] = image;
  });
  return photos;
}

export const savePublishedSnapshot = (snapshot: CloudSnapshot) => put(SNAPSHOT_KEY, snapshot);
export const saveCachedPhoto = (id: string, dataUrl: string) => put(`photo:${id}`, dataUrl);
