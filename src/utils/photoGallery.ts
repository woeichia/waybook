import { loadCustomPhotos, saveCustomPhotosMap } from './customPhotos';

export const MAX_PHOTOS_PER_STOP = 8;

const DB_NAME = 'waybook_photo_galleries_db';
const DB_VERSION = 1;
const STORE_NAME = 'galleries';
const FALLBACK_STORAGE_KEY = 'waybook_photo_galleries_v1';

function sanitizePhotoList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, MAX_PHOTOS_PER_STOP);
}

function readFallbackStorage(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, string[]> = {};
    for (const [stopId, photos] of Object.entries(parsed)) {
      const clean = sanitizePhotoList(photos);
      if (clean.length > 0) {
        result[stopId] = clean;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeFallbackStorage(stopId: string, photos: string[]): void {
  const current = readFallbackStorage();
  if (photos.length === 0) {
    delete current[stopId];
  } else {
    current[stopId] = photos;
  }
  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(current));
}

function clearLegacySinglePhoto(stopId: string): void {
  try {
    const legacy = loadCustomPhotos();
    if (stopId in legacy) {
      delete legacy[stopId];
      saveCustomPhotosMap(legacy);
    }
  } catch {
    // Ignore storage cleanup errors
  }
}

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function readAllFromDb(db: IDBDatabase): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result: Record<string, string[]> = {};

    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();

    tx.oncomplete = () => {
      const keys = keysReq.result ?? [];
      const vals = valsReq.result ?? [];
      for (let i = 0; i < keys.length; i += 1) {
        const key = String(keys[i]);
        const clean = sanitizePhotoList(vals[i]);
        if (clean.length > 0) {
          result[key] = clean;
        }
      }
      resolve(result);
    };
    tx.onerror = () => reject(tx.error ?? new Error('Failed to read photo galleries'));
  });
}

function writeKeyToDb(db: IDBDatabase, stopId: string, photos: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (photos.length === 0) {
      store.delete(stopId);
    } else {
      store.put(photos, stopId);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write photo gallery'));
  });
}

export async function loadPhotoGalleries(): Promise<Record<string, string[]>> {
  const merged: Record<string, string[]> = {};

  // Seed with any legacy single-photo entries stored in localStorage.
  const legacySingle = loadCustomPhotos();
  for (const [stopId, url] of Object.entries(legacySingle)) {
    merged[stopId] = [url];
  }

  // Merge localStorage fallback galleries if present.
  const fallbackMap = readFallbackStorage();
  for (const [stopId, photos] of Object.entries(fallbackMap)) {
    merged[stopId] = photos;
  }

  // Prefer IndexedDB entries where available.
  let db: IDBDatabase;
  try { db = await openGalleryDb(); } catch { return merged; }
  try {
    const dbMap = await readAllFromDb(db);
    for (const [stopId, photos] of Object.entries(dbMap)) {
      merged[stopId] = photos;
    }
    return merged;
  } finally {
    db.close();
  }
}

export async function writeGallery(stopId: string, photos: string[]): Promise<void> {
  const clean = sanitizePhotoList(photos);
  clearLegacySinglePhoto(stopId);

  try {
    const db = await openGalleryDb();
    try {
      await writeKeyToDb(db, stopId, clean);
      try {
        writeFallbackStorage(stopId, []);
      } catch {
        // Ignore fallback cleanup errors
      }
      return;
    } finally {
      db.close();
    }
  } catch {
    // Fall back to localStorage when IndexedDB is unavailable or blocked.
    writeFallbackStorage(stopId, clean);
  }
}
