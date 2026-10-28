'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { InventoryItem, AuditLogEntry, Product } from '@/lib/types';

const DB_NAME = 'sheetSyncDB';
const DB_VERSION = 1;

export const dbPromise = (typeof window !== 'undefined') 
  ? openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('auditLogs')) {
          db.createObjectStore('auditLogs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'barcode' });
        }
      },
    })
  : Promise.resolve(null);

/* =========================
   INVENTORY
========================= */
export async function saveInventory(items: InventoryItem[]) {
  const db = await dbPromise;
  if (!db) return;
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');
  const incomingIds = new Set(items.map(item => item.id));
  const existingKeys = await store.getAllKeys();
  for (const key of existingKeys) {
    if (!incomingIds.has(String(key))) await store.delete(key);
  }
  for (const item of items) await store.put(item);
  await tx.done;
}

export async function getInventory(): Promise<InventoryItem[]> {
  const db = await dbPromise;
  if (!db) return [];
  return db.getAll('inventory');
}

/* =========================
   AUDIT LOGS
========================= */
export async function saveAuditLogs(logs: AuditLogEntry[]) {
  const db = await dbPromise;
  if (!db) return;
  const tx = db.transaction('auditLogs', 'readwrite');
  const store = tx.objectStore('auditLogs');
  const incomingIds = new Set(logs.map(log => log.id));
  const existingKeys = await store.getAllKeys();
  for (const key of existingKeys) {
    if (!incomingIds.has(String(key))) await store.delete(key);
  }
  for (const log of logs) await store.put(log);
  await tx.done;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const db = await dbPromise;
  if (!db) return [];
  return db.getAll('auditLogs');
}

/* =========================
   PRODUCTS
========================= */
export async function saveProducts(products: Product[]) {
  const saveStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const db = await dbPromise;
  if (!db) return;

  // Read the existing catalogue once, then write only records that actually
  // changed. The old implementation rewrote all ~73k products after every
  // full sync, even when Google Sheets had no product changes.
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  const existingProducts = await store.getAll();
  const existingByBarcode = new Map(existingProducts.map(product => [String(product.barcode), product]));
  const incomingBarcodes = new Set<string>();
  let updatedCount = 0;
  let unchangedCount = 0;
  let deletedCount = 0;

  for (const product of products) {
    const barcode = String(product.barcode);
    incomingBarcodes.add(barcode);
    const existing = existingByBarcode.get(barcode);
    if (existing && JSON.stringify(existing) === JSON.stringify(product)) {
      unchangedCount++;
      continue;
    }
    store.put(product);
    updatedCount++;
  }

  for (const existing of existingProducts) {
    if (!incomingBarcodes.has(String(existing.barcode))) {
      store.delete(existing.barcode);
      deletedCount++;
    }
  }

  await tx.done;
  const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - saveStartedAt);
  console.info('[SHEETSYNC_SYNC_DIAGNOSTICS]', {
    phase: 'indexeddb-save-products',
    productCount: products.length,
    previousCount: existingProducts.length,
    updatedCount,
    unchangedCount,
    deletedCount,
    durationMs
  });
}

export async function getProducts(): Promise<Product[]> {
  const db = await dbPromise;
  if (!db) return [];
  return db.getAll('products');
}
