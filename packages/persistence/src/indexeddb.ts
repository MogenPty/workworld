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
      // Guarded so future version bumps (DB_VERSION + 1, + 2, ...) add new
      // stores without dropping or breaking this one. There are no
      // migrations between save schema versions yet; when SAVE_SCHEMA_VERSION
      // advances, add version-gated migration steps here.
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
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
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
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
      const all = await tx<unknown>(db, "readonly", (store) => store.getAll() as IDBRequest<unknown>);
      if (!Array.isArray(all)) return [];
      const entries: Array<{ name: string; savedAt: string }> = [];
      for (const item of all) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
        const record = item as Record<string, unknown>;
        if (typeof record["name"] !== "string" || typeof record["savedAt"] !== "string") continue;
        entries.push({ name: record["name"], savedAt: record["savedAt"] });
      }
      return entries;
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
