/**
 * Client-Side Caching using IndexedDB for heavy JSON repertory and Materia Medica datasets.
 * Eliminates network latency during symptom lookup searches and enables offline functionality.
 */

const DB_NAME = 'PharmacyRepertoryCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'json-files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available on the client-side browser environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads a file from IndexedDB cache or fetches and caches it if missing.
 * Supports text and json response types.
 */
export async function getCachedFile(url: string, responseType: 'text' | 'json' = 'json'): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = async () => {
        if (request.result !== undefined) {
          console.log(`[IndexedDB Cache] Loaded from cache: ${url}`);
          resolve(request.result);
        } else {
          console.log(`[IndexedDB Cache] Fetching and caching: ${url}`);
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP error ${res.status}`);
              return responseType === 'json' ? res.json() : res.text();
            })
            .then((data) => {
              const writeTx = db.transaction(STORE_NAME, 'readwrite');
              const writeStore = writeTx.objectStore(STORE_NAME);
              writeStore.put(data, url);
              resolve(data);
            })
            .catch((err) => reject(err));
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB Cache] Fallback to direct fetch for ${url} due to error:`, err);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return responseType === 'json' ? await res.json() : await res.text();
  }
}
