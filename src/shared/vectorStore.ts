/**
 * IndexedDB vector store for semantic search.
 * One record per memory: its embedding + a content hash so the indexer can
 * detect staleness cheaply. Lives outside chrome.storage because vectors are
 * bulk binary-ish data and IndexedDB handles that better.
 */

const DB_NAME = "memory-wallet-embeddings";
const STORE = "vectors";
const DB_VERSION = 1;

export interface VectorRecord {
  memoryId: string;
  profileId: string;
  vector: number[];
  contentHash: string;
  updatedAt: string;
}

/** djb2 — cheap, deterministic, enough to detect content changes. */
export function hashContent(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "memoryId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAllVectors(): Promise<VectorRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as VectorRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getVectorsByProfile(profileId: string): Promise<VectorRecord[]> {
  const all = await getAllVectors();
  return all.filter((v) => v.profileId === profileId && Array.isArray(v.vector));
}

export async function putVectors(records: VectorRecord[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const r of records) store.put(r);
  await txDone(tx);
}

export async function deleteVectors(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const id of memoryIds) store.delete(id);
  await txDone(tx);
}

export async function clearVectorStore(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
}
