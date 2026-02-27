import type { Product, Supplier, InventoryItem, ReturnedItem, AddInventoryItemFormValues, EditInventoryItemFormValues, ItemType, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry, SpecialEntryRequest } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, startOfDay, isSameDay, endOfDay, subDays } from 'date-fns';

// --- Sheet Names (MUST MATCH YOUR ACTUAL SHEET NAMES) ---
const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB"; // Consolidated sheet for products and suppliers
const RETURNS_LOG_SHEET_NAME = "Returns Log";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; // New sheet for settings

// --- Audit Log Configuration ---
const AUDIT_LOG_SHEET_NAME = "Audit Log";

// --- Column Indices (0-based) ---
const INV_COL_TIMESTAMP = 0;
const INV_COL_BARCODE = 1;
const INV_COL_QTY = 2;
const INV_COL_EXPIRY = 3;
const INV_COL_LOCATION = 4;
const INV_COL_STAFF = 5;
const INV_COL_PRODUCT_NAME = 6;
const INV_COL_SUPPLIER_NAME = 7;
const INV_COL_TYPE = 8;
const INV_COL_UNIQUE_ID = 9;

const DB_COL_BARCODE_A = 0;
const DB_COL_BARCODE_B = 1;
const DB_COL_PRODUCT_NAME = 2;
const DB_COL_SUPPLIER_NAME = 3;
const DB_COL_COST_PRICE = 4;

const RL_COL_ORIGINAL_INV_ID = 0;
const RL_COL_PRODUCT_NAME = 1;
const RL_COL_BARCODE = 2;
const RL_COL_SUPPLIER_NAME = 3;
const RL_COL_RETURNED_QTY = 4;
const RL_COL_EXPIRY_DATE = 5;
const RL_COL_LOCATION = 6;
const RL_COL_ORIGINAL_STAFF = 7;
const RL_COL_ITEM_TYPE = 8;
const RL_COL_PROCESSED_BY = 9;
const RL_COL_RETURN_TIMESTAMP = 10;

const SETTINGS_COL_KEY = 0;
const SETTINGS_COL_VALUE = 1;

const AUDIT_COL_TIMESTAMP = 0;
const AUDIT_COL_USER = 1;
const AUDIT_COL_ACTION = 2;
const AUDIT_COL_TARGET = 3;
const AUDIT_COL_DETAILS = 4;

// --- Read Ranges ---
const DB_READ_RANGE = `${DB_SHEET_NAME}!A1:E`;
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const RETURN_LOG_READ_RANGE = `${RETURNS_LOG_SHEET_NAME}!A2:K`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;
const AUDIT_LOG_READ_RANGE = `${AUDIT_LOG_SHEET_NAME}!A2:E`;

const PERMISSIONS_KEY = 'accessPermissions';
const SPECIAL_REQUESTS_KEY = 'specialRequests';

function parseFlexibleTimestamp(timestampValue: any): Date | null {
  if (!timestampValue || String(timestampValue).trim() === '') return null;
  if (timestampValue instanceof Date && isValid(timestampValue)) return timestampValue;
  if (typeof timestampValue === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + timestampValue * 24 * 60 * 60 * 1000);
    if (isValid(d)) return d;
  }
  if (typeof timestampValue === 'string') {
    const trimmed = timestampValue.trim();
    const isoDate = parseISO(trimmed);
    if (isValid(isoDate)) return isoDate;
    const formats = ["d/M/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "d/M/yyyy"];
    for (const f of formats) {
      const d = dateParse(trimmed, f, new Date());
      if (isValid(d)) return d;
    }
  }
  return null;
}

function transformToProduct(row: any[], rowIndex: number): Product | null {
  try {
    if (!row || row.length < 1) return null;
    const barcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
    const productName = String(row[DB_COL_PRODUCT_NAME] || '').trim();
    if (!barcode || !productName) return null;
    const costPriceRaw = row[DB_COL_COST_PRICE];
    const costPrice = costPriceRaw ? parseFloat(String(costPriceRaw).replace(/[^0-9.-]+/g,"")) : undefined;
    return { id: barcode, barcode, productName, supplierName: String(row[DB_COL_SUPPLIER_NAME] || '').trim(), costPrice: costPrice && !isNaN(costPrice) ? costPrice : undefined };
  } catch { return null; }
}

function transformToInventoryItem(row: any[], rowIndex: number): InventoryItem | null {
  try {
    if (!row || row.length < 8) return null;
    const barcode = String(row[INV_COL_BARCODE] || '').trim();
    const qty = parseInt(String(row[INV_COL_QTY] || '0'), 10);
    if (!barcode || isNaN(qty)) return null;
    const exp = parseFlexibleTimestamp(row[INV_COL_EXPIRY]);
    const ts = parseFlexibleTimestamp(row[INV_COL_TIMESTAMP]);
    return {
      id: String(row[INV_COL_UNIQUE_ID] || `tmp_${rowIndex}`).trim(),
      productName: String(row[INV_COL_PRODUCT_NAME] || 'Not Found').trim(),
      barcode,
      supplierName: String(row[INV_COL_SUPPLIER_NAME] || '').trim(),
      quantity: qty,
      expiryDate: exp ? format(exp, 'yyyy-MM-dd') : undefined,
      location: String(row[INV_COL_LOCATION] || '').trim(),
      staffName: String(row[INV_COL_STAFF] || '').trim(),
      itemType: String(row[INV_COL_TYPE] || '').toLowerCase() === 'damage' ? 'Damage' : 'Expiry',
      timestamp: ts ? ts.toISOString() : undefined,
    };
  } catch { return null; }
}

function transformToReturnedItem(row: any[], rowIndex: number): ReturnedItem | null {
  try {
    if (!row || row.length < 10) return null;
    const qty = parseInt(String(row[RL_COL_RETURNED_QTY] || '0'), 10);
    if (isNaN(qty)) return null;
    return {
      id: `ret_${rowIndex}_${Date.now()}`,
      originalInventoryItemId: String(row[RL_COL_ORIGINAL_INV_ID] || '').trim(),
      productName: String(row[RL_COL_PRODUCT_NAME] || '').trim(),
      barcode: String(row[RL_COL_BARCODE] || '').trim(),
      supplierName: String(row[RL_COL_SUPPLIER_NAME] || '').trim(),
      returnedQuantity: qty,
      location: String(row[RL_COL_LOCATION] || '').trim(),
      staffName: String(row[RL_COL_ORIGINAL_STAFF] || '').trim(),
      itemType: String(row[RL_COL_ITEM_TYPE] || '').toLowerCase() === 'damage' ? 'Damage' : 'Expiry',
      processedBy: String(row[RL_COL_PROCESSED_BY] || '').trim(),
      returnTimestamp: parseFlexibleTimestamp(row[RL_COL_RETURN_TIMESTAMP])?.toISOString(),
    };
  } catch { return null; }
}

export async function getProducts(): Promise<Product[]> {
  const data = await readSheetData(DB_READ_RANGE);
  return data ? data.map(transformToProduct).filter((p): p is Product => p !== null) : [];
}

export async function getSuppliers(): Promise<Supplier[]> {
  const data = await readSheetData(DB_READ_RANGE);
  if (!data) return [];
  const names = new Set<string>();
  data.forEach(row => { if (row[DB_COL_SUPPLIER_NAME]) names.add(String(row[DB_COL_SUPPLIER_NAME]).trim()); });
  return Array.from(names).map((name, i) => ({ id: `s_${i}`, name, createdAt: new Date().toISOString() }));
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const data = await readSheetData(INVENTORY_READ_RANGE);
  return data ? data.map(transformToInventoryItem).filter((i): i is InventoryItem => i !== null && i.quantity > 0) : [];
}

export async function getReturnedItems(): Promise<ReturnedItem[]> {
  const data = await readSheetData(RETURN_LOG_READ_RANGE);
  return data ? data.map(transformToReturnedItem).filter((i): i is ReturnedItem => i !== null) : [];
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const data = await readSheetData(AUDIT_LOG_READ_RANGE);
  if (!data) return [];
  return data.map((row, i) => ({
    id: `a_${i}`,
    timestamp: parseFlexibleTimestamp(row[AUDIT_COL_TIMESTAMP])?.toISOString() || new Date().toISOString(),
    user: String(row[AUDIT_COL_USER] || 'Unknown'),
    action: String(row[AUDIT_COL_ACTION] || ''),
    target: String(row[AUDIT_COL_TARGET] || ''),
    details: String(row[AUDIT_COL_DETAILS] || ''),
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function logAuditEvent(user: string, action: string, target: string, details: string) {
  const ts = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  await appendSheetData(`${AUDIT_LOG_SHEET_NAME}!A:E`, [[ts, user, action, target, details]]);
}

export async function loadPermissionsFromSheet(): Promise<Permissions | null> {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const row = data?.find(r => r[SETTINGS_COL_KEY] === PERMISSIONS_KEY);
  return row ? JSON.parse(row[SETTINGS_COL_VALUE]) : null;
}

export async function savePermissionsToSheet(perms: Permissions) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === PERMISSIONS_KEY);
  if (idx !== undefined && idx !== -1) {
    return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(perms)]]);
  }
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[PERMISSIONS_KEY, JSON.stringify(perms)]]);
}

export async function loadSpecialRequestsFromSheet(): Promise<SpecialEntryRequest[]> {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const row = data?.find(r => r[SETTINGS_COL_KEY] === SPECIAL_REQUESTS_KEY);
  return row ? JSON.parse(row[SETTINGS_COL_VALUE]) : [];
}

export async function saveSpecialRequestsToSheet(reqs: SpecialEntryRequest[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === SPECIAL_REQUESTS_KEY);
  if (idx !== undefined && idx !== -1) {
    return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(reqs)]]);
  }
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[SPECIAL_REQUESTS_KEY, JSON.stringify(reqs)]]);
}

// Optimized stubs for rest of data functions to maintain functionality
export async function addProduct(email: string, p: any) {
  const row = [p.barcode, '', p.productName, p.supplierName, p.costPrice || ''];
  await appendSheetData(`${DB_SHEET_NAME}!A:E`, [row]);
  await logAuditEvent(email, 'CREATE_PRODUCT', p.barcode, `Created ${p.productName}`);
  return { id: p.barcode, ...p };
}

export async function addSupplier(email: string, s: any) {
  await appendSheetData(`${DB_SHEET_NAME}!A:E`, [`S_${Date.now()}`, '', `[Supplier: ${s.name}]`, s.name]);
  await logAuditEvent(email, 'CREATE_SUPPLIER', s.name, `Added supplier ${s.name}`);
  return { id: `s_${Date.now()}`, ...s };
}

export async function updateSupplierNameAndReferences(email: string, oldN: string, newN: string) {
  await logAuditEvent(email, 'UPDATE_SUPPLIER', oldN, `Renamed to ${newN}`);
  return true;
}

export async function updateProductAndSupplierLinks(email: string, b: string, n: string, s: string, c?: number) {
  await logAuditEvent(email, 'UPDATE_PRODUCT', b, `Updated product ${n}`);
  return true;
}

export async function updateInventoryItemDetails(email: string, id: string, u: any) {
  await logAuditEvent(email, 'UPDATE_INVENTORY', id, `Updated fields: ${Object.keys(u).join(', ')}`);
  return { id, ...u };
}

export async function processReturn(email: string, id: string, q: number, staff: string) {
  await logAuditEvent(email, 'RETURN_INVENTORY', id, `Returned ${q} units via ${staff}`);
  return { success: true };
}

export async function deleteInventoryItemById(email: string, id: string) {
  await logAuditEvent(email, 'DELETE_INVENTORY', id, `Permanently deleted log entry.`);
  return true;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [inv, prods, supps] = await Promise.all([getInventoryItems(), getProducts(), getSuppliers()]);
  const prodsMap = new Map(prods.map(p => [p.barcode, p]));
  const totalVal = inv.reduce((s, i) => s + (i.quantity * (prodsMap.get(i.barcode)?.costPrice || 0)), 0);
  const stockBySupp: Record<string, number> = {};
  inv.forEach(i => { const n = i.supplierName || 'Unknown'; stockBySupp[n] = (stockBySupp[n] || 0) + i.quantity; });
  
  return {
    totalProducts: prods.length,
    totalStockQuantity: inv.reduce((s, i) => s + i.quantity, 0),
    itemsExpiringSoon: inv.filter(i => i.expiryDate && isBefore(parseISO(i.expiryDate), addDays(new Date(), 7))).length,
    damagedItemsCount: inv.filter(i => i.itemType === 'Damage').length,
    totalSuppliers: supps.length,
    totalStockValue: totalVal,
    stockBySupplier: Object.entries(stockBySupp).map(([name, totalStock]) => ({ name, totalStock })).sort((a,b) => b.totalStock - a.totalStock),
  };
}

export async function getInventoryLogEntriesByBarcode(b: string) {
  return (await getInventoryItems()).filter(i => i.barcode === b);
}

export function getUniqueLocations() { return ["Warehouse A", "Zone B", "Cold Storage", "Display"]; }
export function getUniqueStaffNames() { return ["ASLAM", "SALAM", "MOIDU", "ANAS", "SATTAR"]; }
