
import { Product, Supplier, InventoryItem, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry, SpecialEntryRequest } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells, deleteSheetRowsRange, deleteSheetRowsBatch } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, isAfter, startOfDay, isSameDay, endOfDay, subDays } from 'date-fns';

const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB"; 
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; 
const AUDIT_LOG_SHEET_NAME = "Audit Log";

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
const DB_COL_UNIQUE_ID = 7; // COLUMN H

const SETTINGS_COL_KEY = 0;
const SETTINGS_COL_VALUE = 1;

const AUDIT_COL_TIMESTAMP = 0;
const AUDIT_COL_USER = 1;
const AUDIT_COL_ACTION = 2;
const AUDIT_COL_TARGET = 3;
const AUDIT_COL_DETAILS = 4;

const DB_READ_RANGE = `${DB_SHEET_NAME}!A2:H`; 
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;
const AUDIT_LOG_READ_RANGE = `${AUDIT_LOG_SHEET_NAME}!A2:E`;

const PERMISSIONS_KEY = 'accessPermissions';
const SPECIAL_REQUESTS_KEY = 'specialRequests';
const STAFF_LIST_KEY = 'staffList';
const LOCATION_LIST_KEY = 'locationList';

function parseFlexibleTimestamp(val: any): Date | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '') return null;
  
  if (val instanceof Date && isValid(val)) return val;
  if (typeof val === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setMilliseconds(d.getMilliseconds() + val * 24 * 60 * 60 * 1000);
    return isValid(d) ? d : null;
  }
  
  const iso = parseISO(s);
  if (isValid(iso)) return iso;
  
  const formats = ["d/M/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "d/M/yyyy", "MM/dd/yyyy"];
  for (const f of formats) {
    try {
      const d = dateParse(s, f, new Date());
      if (isValid(d)) return d;
    } catch { continue; }
  }
  return null;
}

function transformToProduct(row: any[]): Product | null {
  if (!row || row.length < 1) return null;
  
  const barcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
  const productName = String(row[DB_COL_PRODUCT_NAME] || '').trim();
  const uniqueIdFromSheet = String(row[DB_COL_UNIQUE_ID] || '').trim();
  
  if (!barcode || !productName || barcode.toLowerCase() === 'barcode') return null;
  
  const costRaw = String(row[DB_COL_COST_PRICE] || '');
  const cost = parseFloat(costRaw.replace(/[^0-9.-]+/g,""));
  
  return { 
    // ID mapping: Priority Column H -> fallback to Barcode
    id: uniqueIdFromSheet || barcode,
    uniqueId: uniqueIdFromSheet || undefined,
    barcode, 
    productName, 
    supplierName: String(row[DB_COL_SUPPLIER_NAME] || '').trim(), 
    costPrice: isNaN(cost) ? undefined : cost 
  };
}

function transformToInventoryItem(row: any[], i: number): InventoryItem | null {
  if (!row || row.length < 2) return null;
  const barcode = String(row[INV_COL_BARCODE] || '').trim();
  const qtyRaw = String(row[INV_COL_QTY] || '0');
  const qty = parseInt(qtyRaw, 10);
  if (!barcode || isNaN(qty)) return null;
  
  const exp = parseFlexibleTimestamp(row[INV_COL_EXPIRY]);
  const ts = parseFlexibleTimestamp(row[INV_COL_TIMESTAMP]);
  
  return {
    id: String(row[INV_COL_UNIQUE_ID] || `tmp_${i}`).trim(),
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
}

export async function getProducts(): Promise<Product[]> {
  const data = await readSheetData(DB_READ_RANGE);
  if (!data) return [];
  return data.reduce((acc: Product[], row) => {
    const p = transformToProduct(row);
    if (p) acc.push(p);
    return acc;
  }, []);
}

export async function getSuppliers(prods?: Product[]): Promise<Supplier[]> {
  const p = prods || await getProducts();
  const names = new Set<string>();
  p.forEach(x => { if (x.supplierName) names.add(x.supplierName.trim()); });
  return Array.from(names).map((n, i) => ({ id: `s_${i}`, name: n, createdAt: new Date().toISOString() }));
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const data = await readSheetData(INVENTORY_READ_RANGE);
  if (!data) return [];
  return data.reduce((acc: InventoryItem[], row, i) => {
    const item = transformToInventoryItem(row, i);
    if (item && item.quantity > 0) acc.push(item);
    return acc;
  }, []);
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const data = await readSheetData(AUDIT_LOG_READ_RANGE);
  if (!data || data.length === 0) return [];

  const retentionThreshold = subDays(new Date(), 90);
  let lastOldRowIndex = -1;

  for (let i = 0; i < data.length; i++) {
    const ts = parseFlexibleTimestamp(data[i][AUDIT_COL_TIMESTAMP]);
    if (ts && isBefore(ts, retentionThreshold)) {
      lastOldRowIndex = i;
    } else if (ts) {
      break; 
    }
  }

  if (lastOldRowIndex !== -1 && data.length > 50) {
    const startIndex = 1;
    const endIndex = lastOldRowIndex + 2; 
    
    if (endIndex > startIndex + 1) {
        deleteSheetRowsRange(AUDIT_LOG_SHEET_NAME, startIndex, endIndex)
          .then(success => {
            if (success) console.log(`Maintenance: Successfully purged ${lastOldRowIndex + 1} old logs.`);
          })
          .catch(err => console.error("Maintenance: Audit Log Cleanup Failed:", err));
    }
  }

  const recentData = lastOldRowIndex === -1 ? data : data.slice(lastOldRowIndex + 1);

  return recentData.map((r, i) => ({
    id: `a_${i}`,
    timestamp: parseFlexibleTimestamp(r[AUDIT_COL_TIMESTAMP])?.toISOString() || new Date().toISOString(),
    user: String(r[AUDIT_COL_USER] || 'Unknown'),
    action: String(r[AUDIT_COL_ACTION] || ''),
    target: String(r[AUDIT_COL_TARGET] || ''),
    details: String(r[AUDIT_COL_DETAILS] || ''),
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function logAuditEvent(user: string, action: string, target: string, details: string) {
  const ts = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  await appendSheetData(`${AUDIT_LOG_SHEET_NAME}!A:E`, [[ts, user, action, target, details]]);
}

export async function getAppMetaData() {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const findJson = (key: string) => {
    const row = data?.find(r => r[SETTINGS_COL_KEY] === key);
    try {
        return row ? JSON.parse(row[SETTINGS_COL_VALUE]) : null;
    } catch { return null; }
  };
  return {
    permissions: findJson(PERMISSIONS_KEY) as Permissions | null,
    specialRequests: (findJson(SPECIAL_REQUESTS_KEY) as SpecialEntryRequest[]) || [],
    staff: (findJson(STAFF_LIST_KEY) as string[]) || ["ASLAM", "SALAM", "MOIDU", "RAMSHAD", "MUHAMMED", "ANAS", "SATTAR", "JOWEL", "AROOS", "SHAHID", "RALEEM"],
    locations: (findJson(LOCATION_LIST_KEY) as string[]) || ["Back side", "On Display", "Front Side"]
  };
}

export async function loadPermissionsFromSheet() { return (await getAppMetaData()).permissions; }

export async function savePermissionsToSheet(perms: Permissions) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === PERMISSIONS_KEY);
  if (idx !== undefined && idx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(perms)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[PERMISSIONS_KEY, JSON.stringify(perms)]]);
}

export async function saveSpecialRequestsToSheet(reqs: SpecialEntryRequest[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === SPECIAL_REQUESTS_KEY);
  if (idx !== undefined && idx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(reqs)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[SPECIAL_REQUESTS_KEY, JSON.stringify(reqs)]]);
}

export async function saveStaffListToSheet(staff: string[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === STAFF_LIST_KEY);
  if (idx !== undefined && idx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(staff)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[STAFF_LIST_KEY, JSON.stringify(staff)]]);
}

export async function saveLocationListToSheet(locations: string[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const idx = data?.findIndex(r => r[SETTINGS_COL_KEY] === LOCATION_LIST_KEY);
  if (idx !== undefined && idx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${idx + 2}`, [[JSON.stringify(locations)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[LOCATION_LIST_KEY, JSON.stringify(locations)]]);
}

export async function getProductDetailsByBarcode(barcode: string): Promise<Product | null> {
  const p = await getProducts();
  return p.find(x => x.barcode === barcode) || null;
}

export async function addProduct(email: string, p: any) {
  const uniqueId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  // Row structure: [Barcode, Empty, Name, Supplier, Cost, Empty, Empty, UniqueID]
  const row = [p.barcode, '', p.productName, p.supplierName, p.costPrice || '', '', '', uniqueId];
  await appendSheetData(`${DB_SHEET_NAME}!A:H`, [row]);
  await logAuditEvent(email, 'CREATE_PRODUCT', p.barcode, `Product: ${p.productName} (ID: ${uniqueId})`);
  return { id: uniqueId, uniqueId, ...p };
}

export async function deleteProductByBarcode(email: string, barcode: string) {
  // Try Column H first (for surgical accuracy), then fallback to barcode columns A/B
  let row = await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_UNIQUE_ID) ||
            await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_BARCODE_A) || 
            await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_BARCODE_B);
  
  if (row) {
    await deleteSheetRow(DB_SHEET_NAME, row);
    await logAuditEvent(email, 'DELETE_PRODUCT', barcode, `Permanently removed from catalog.`);
    return true;
  }
  return false;
}

export async function deleteProductsByBarcodes(email: string, identifiers: string[]) {
  const sheetData = await readSheetData(DB_READ_RANGE);
  if (!sheetData || sheetData.length === 0) return false;

  const idSet = new Set(identifiers.map(id => id.trim()));
  const rowIndicesToDelete: number[] = [];

  sheetData.forEach((row, i) => {
    const rowUniqueId = String(row[DB_COL_UNIQUE_ID] || '').trim();
    const rowBarcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
    
    // Check both unique ID and barcode for deletion targeting
    if ((rowUniqueId && idSet.has(rowUniqueId)) || idSet.has(rowBarcode)) {
      rowIndicesToDelete.push(i + 2); 
    }
  });

  if (rowIndicesToDelete.length === 0) return false;

  const success = await deleteSheetRowsBatch(DB_SHEET_NAME, rowIndicesToDelete);
  if (success) {
    await logAuditEvent(email, 'BULK_DELETE_PRODUCT', identifiers.join(','), `Batch removal of ${rowIndicesToDelete.length} SKUs.`);
  }
  return success;
}

export async function updateProductAndSupplierLinks(email: string, b: string, n: string, s: string, c?: number, uniqueId?: string) {
  // Use Unique ID lookup if available (e.g. "db2"), fallback to barcode
  let row: number | null = null;
  if (uniqueId) {
    row = await findRowByUniqueValue(DB_SHEET_NAME, uniqueId, DB_COL_UNIQUE_ID);
  }
  
  if (!row) {
    row = await findRowByUniqueValue(DB_SHEET_NAME, b, DB_COL_BARCODE_A) || 
          await findRowByUniqueValue(DB_SHEET_NAME, b, DB_COL_BARCODE_B);
  }
  
  if (row) {
    const costValue = (c === undefined || Number.isNaN(c)) ? '' : c;
    
    await batchUpdateSheetCells([
      { range: `${DB_SHEET_NAME}!C${row}`, values: [[n]] }, 
      { range: `${DB_SHEET_NAME}!D${row}`, values: [[s]] }, 
      { range: `${DB_SHEET_NAME}!E${row}`, values: [[costValue]] }
    ]);

    const invData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!B2:H`);
    if (invData) {
        const updates: { range: string; values: any[][] }[] = [];
        invData.forEach((row, i) => {
            const rowBarcode = String(row[0] || '').trim();
            if (rowBarcode === b) {
                updates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!G${i+2}`, values: [[n]] });
                updates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!H${i+2}`, values: [[s]] });
            }
        });

        if (updates.length > 0) {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                await batchUpdateSheetCells(updates.slice(i, i + CHUNK_SIZE));
            }
        }
    }

    await logAuditEvent(email, 'UPDATE_PRODUCT', b, `Updated definition: ${n}`);
    return true;
  }
  return false;
}

export async function updateInventoryItemDetails(email: string, id: string, u: any) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) throw new Error("Not found.");
  const ups = [];
  if (u.quantity !== undefined) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!C${row}`, values: [[Number(u.quantity)]] });
  if (u.location) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!E${row}`, values: [[u.location]] });
  if (u.itemType) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!I${row}`, values: [[u.itemType]] });
  if (u.expiryDate) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!D${row}`, values: [[format(parseISO(u.expiryDate), "d/M/yyyy")]] });
  if (ups.length > 0) { await batchUpdateSheetCells(ups); await logAuditEvent(email, 'UPDATE_INVENTORY', id, `Updated.`); }
  return { id, ...u };
}

export async function processReturn(email: string, id: string, q: number | undefined, staff: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) throw new Error("Not found.");
  const data = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${row}:J${row}`);
  const original = data![0];
  const qty = parseInt(String(original[INV_COL_QTY] || '0'), 10);
  const amt = q === undefined ? qty : q;
  const final = Math.max(0, qty - amt);
  if (final > 0) await updateSheetData(`${FORM_RESPONSES_SHEET_NAME}!C${row}`, [[final]]);
  else await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
  await logAuditEvent(email, 'RETURN_INVENTORY', id, `Returned ${amt} units.`);
  return { success: true };
}

export async function deleteInventoryItemById(email: string, id: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (row) { await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row); await logAuditEvent(email, 'DELETE_INVENTORY', id, `Deleted.`); return true; }
  return false;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [inv, prods] = await Promise.all([getInventoryItems(), getProducts()]);
  const today = startOfDay(new Date());
  const prodsMap = new Map(prods.map(p => [p.barcode, p]));
  let val = 0, added = 0, soon = 0;
  const sByS: Record<string, number> = {};
  inv.forEach(i => {
    const p = prodsMap.get(i.barcode);
    if (p?.costPrice) val += (i.quantity * p.costPrice);
    const sName = i.supplierName || 'Unknown';
    sByS[sName] = (sByS[sName] || 0) + i.quantity;
    if (i.timestamp && isSameDay(startOfDay(parseISO(i.timestamp)), today)) added += i.quantity;
    if (i.itemType === 'Expiry' && i.expiryDate) {
      const exp = startOfDay(parseISO(i.expiryDate));
      if (!isBefore(exp, today) && isBefore(exp, addDays(today, 7))) soon++;
    }
  });
  const trend: StockTrendData[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = subDays(today, d);
    const curr = inv.reduce((s, x) => s + x.quantity, 0);
    const post = inv.filter(x => x.timestamp && isAfter(parseISO(x.timestamp), endOfDay(day))).reduce((s, x) => s + x.quantity, 0);
    trend.push({ date: format(day, 'MMM dd'), totalStock: Math.max(0, curr - post) });
  }
  return {
    totalProducts: prods.length, totalStockQuantity: inv.reduce((s, x) => s + x.quantity, 0),
    itemsExpiringSoon: soon, damagedItemsCount: inv.filter(x => x.itemType === 'Damage').length,
    totalSuppliers: new Set(prods.map(x => x.supplierName)).size, totalStockValue: val,
    stockBySupplier: Object.entries(sByS).map(([n, q]) => ({ name: n, totalStock: q })).sort((a,b) => b.totalStock - a.totalStock),
    netItemsAddedToday: added, dailyStockChangeDirection: added > 0 ? 'increase' : 'none', stockTrend: trend
  };
}

export async function getInventoryLogEntriesByBarcode(b: string) { 
    return (await getInventoryItems()).filter(i => i.barcode === b); 
}
