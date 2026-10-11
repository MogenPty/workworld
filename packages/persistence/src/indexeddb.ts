import type { SaveData, SaveStorage } from "./save";
import { migrateSave } from "./save";

/**
 * Browser IndexedDB adapter. Browser APIs stay here — never in the
 * simulation core. All reads go through `migrateSave` validation.
 */

const DB_NAME = "workworld";
const STORE_NAME = "saves";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "name" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("failed to open IndexedDB"));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let value: T;
    try {
      const req = run(store);
      req.onsuccess = () => {
        value = req.result;
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    } catch (err) {
      reject(err);
      return;
    }
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export class IndexedDbStorage implements SaveStorage {
  async save(data: SaveData): Promise<void> {
    const db = await openDb();
    try {
      await tx(db, "readwrite", (store) => store.put(structuredClone(data)));
    } finally {
      db.close();
    }
  }

  async load(name: string): Promise<SaveData> {
    const db = await openDb();
    try {
      const raw = await tx<unknown>(db, "readonly", (store) => store.get(name));
      if (raw === undefined) throw new Error(`save not found: ${name}`);
      const result = migrateSave(raw);
      if (!result.ok) throw new Error(result.error);
      return result.save;
    } finally {
      db.close();
    }
  }

  async list(): Promise<Array<{ name: string; savedAt: string }>> {
    const db = await openDb();
    try {
      const all = await tx<SaveData[]>(db, "readonly", (store) => store.getAll());
      return all.map((s) => ({ name: s.name, savedAt: s.savedAt }));
    } finally {
      db.close();
    }
  }

  async delete(name: string): Promise<void> {
    const db = await openDb();
    try {
      await tx(db, "readwrite", (store) => store.delete(name));
    } finally {
      db.close();
    }
  }
}
