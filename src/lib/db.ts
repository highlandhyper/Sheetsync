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
  await store.clear();
  for (const item of items) {
    await store.put(item);
  }
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
  await store.clear();
  for (const log of logs) {
    await store.put(log);
  }
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
  const db = await dbPromise;
  if (!db) return;
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  await store.clear();
  // Batch write for performance with 54k rows
  for (const product of products) {
    await store.put(product);
  }
  await tx.done;
}

export async function getProducts(): Promise<Product[]> {
  const db = await dbPromise;
  if (!db) return [];
  return db.getAll('products');
}
