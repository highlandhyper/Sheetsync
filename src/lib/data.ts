
import { Product, Supplier, InventoryItem, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry, SpecialEntryRequest, ExpiryReminder, StaffMember } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells, deleteSheetRowsRange, deleteSheetRowsBatch, clearSheetData, ensureSheetRows } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, isAfter, startOfDay, isSameDay, endOfDay, subDays } from 'date-fns';

const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB"; 
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; 
const AUDIT_LOG_SHEET_NAME = "Audit Log";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";

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

const WATCH_COL_ID = 0;
const WATCH_COL_BARCODE = 1;
const WATCH_COL_NAME = 2;
const WATCH_COL_EXPIRY = 3;
const WATCH_COL_SUPPLIER = 4;
const WATCH_COL_STATUS = 5;
const WATCH_COL_TIMESTAMP = 6;

const DB_READ_RANGE = `${DB_SHEET_NAME}!A2:H`; 
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;
const AUDIT_LOG_READ_RANGE = `${AUDIT_LOG_SHEET_NAME}!A2:E`;
const EXPIRY_WATCH_READ_RANGE = `${EXPIRY_WATCH_SHEET_NAME}!A2:G`;

const PERMISSIONS_KEY = 'accessPermissions';
const SPECIAL_REQUESTS_KEY = 'specialRequests';
const STAFF_LIST_KEY = 'staffList';
const LOCATION_LIST_KEY = 'locationList';

const APPSCRIPT_API_URL = "https://script.google.com/macros/s/AKfycby__866_Y_0XFiaPPCUaX6U1oZK329Ek6SRg9iU4u-aq5ARhxmkTmIHq6gvTpxXMf-8Lw/exec";
const APPSCRIPT_PASS = "0438"; 

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
  
  const formats = ["d/M/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "d/M/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];
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
  if (data === null) throw new Error("Registry Catalog Unavailable");
  
  return data.reduce((acc: Product[], row) => {
    const p = transformToProduct(row);
    if (p && p.barcode) acc.push(p);
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
  if (data === null) throw new Error("Inventory Registry Offline");
  
  return data.reduce((acc: InventoryItem[], row, i) => {
    const item = transformToInventoryItem(row, i);
    if (item && item.quantity > 0) acc.push(item);
    return acc;
  }, []);
}

export async function getExpiryReminders(): Promise<ExpiryReminder[]> {
    const data = await readSheetData(EXPIRY_WATCH_READ_RANGE);
    if (!data) return [];
    
    return data.map(row => {
        const expRaw = row[WATCH_COL_EXPIRY];
        const expDate = parseFlexibleTimestamp(expRaw);
        const tsRaw = row[WATCH_COL_TIMESTAMP];
        const tsDate = parseFlexibleTimestamp(tsRaw);

        return {
            id: String(row[WATCH_COL_ID] || ''),
            barcode: String(row[WATCH_COL_BARCODE] || ''),
            productName: String(row[WATCH_COL_NAME] || ''),
            expiryDate: expDate && isValid(expDate) ? format(expDate, 'yyyy-MM-dd') : String(expRaw || ''),
            supplierName: String(row[WATCH_COL_SUPPLIER] || ''),
            status: (String(row[WATCH_COL_STATUS] || 'pending').toLowerCase() as any),
            timestamp: tsDate && isValid(tsDate) ? tsDate.toISOString() : String(tsRaw || ''),
            staffName: '' 
        };
    }).filter(r => r.id && r.status === 'pending');
}

/**
 * EXCLUSIVE EXPIRY WATCH LOGGING
 * Strictly logs to "Expiry Watch" sheet only. Does NOT trigger main inventory log.
 */
export async function addExpiryReminder(reminder: Omit<ExpiryReminder, 'id' | 'timestamp' | 'status'>) {
    const id = `rem_${Date.now()}`;
    const ts = new Date().toISOString();
    
    // STRUCTURE: ID | Barcode | Name | Expiry | Supplier | Status | Timestamp
    const row = [id, reminder.barcode, reminder.productName, reminder.expiryDate, reminder.supplierName || '', 'pending', ts];
    
    // CRITICAL: Isolated write to "Expiry Watch"
    await appendSheetData(`${EXPIRY_WATCH_SHEET_NAME}!A:G`, [row]);
    
    // Specialized fetch to AppsScript with isWatchEntry flag
    try {
        await fetch(APPSCRIPT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'scheduleExpiryWatch',
                password: APPSCRIPT_PASS,
                isWatchEntry: true, 
                reminderId: id,
                barcode: reminder.barcode,
                productName: reminder.productName,
                expiryDate: reminder.expiryDate,
                staffName: reminder.staffName,
                supplierName: reminder.supplierName
            }),
            redirect: 'follow'
        });
    } catch (e) {
        console.error("Expiry Watch: AppsScript trigger failed.", e);
    }
    
    return { ...reminder, id, timestamp: ts, status: 'pending' as const };
}

export async function resolveExpiryReminder(id: string, email: string) {
    const row = await findRowByUniqueValue(EXPIRY_WATCH_SHEET_NAME, id, WATCH_COL_ID);
    if (row) {
        await updateSheetData(`${EXPIRY_WATCH_SHEET_NAME}!F${row}`, [['resolved']]);
        await logAuditEvent(email, 'RESOLVE_WATCH', id, `Cleared product from Expiry Watch.`);
        return true;
    }
    return false;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const data = await readSheetData(AUDIT_LOG_READ_RANGE);
  if (data === null) throw new Error("Audit Trail Unavailable");
  
  const oneYearAgo = subDays(new Date(), 365);
  
  const logs = data.map((r, i) => {
    const ts = parseFlexibleTimestamp(r[AUDIT_COL_TIMESTAMP]);
    return {
      id: `a_${i}`,
      timestamp: ts?.toISOString() || new Date().toISOString(),
      user: String(r[AUDIT_COL_USER] || 'Unknown'),
      action: String(r[AUDIT_COL_ACTION] || ''),
      target: String(r[AUDIT_COL_TARGET] || ''),
      details: String(r[AUDIT_COL_DETAILS] || ''),
      _date: ts
    };
  });

  return logs
    .filter(log => log._date && isAfter(log._date, oneYearAgo))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10000)
    .map(({ _date, ...rest }) => rest) as AuditLogEntry[];
}

export async function pruneAuditLogs() {
    const data = await readSheetData(AUDIT_LOG_READ_RANGE);
    if (!data || data.length < 500) return; 

    const oneYearAgo = subDays(new Date(), 365);
    const rowsToDelete: number[] = [];

    data.forEach((row, i) => {
        const ts = parseFlexibleTimestamp(row[AUDIT_COL_TIMESTAMP]);
        if (ts && isBefore(ts, oneYearAgo)) {
            rowsToDelete.push(i + 2); 
        }
    });

    if (rowsToDelete.length > 0) {
        await deleteSheetRowsBatch(AUDIT_LOG_SHEET_NAME, rowsToDelete);
    }
}

export async function deleteAuditLogsByBarcode(email: string, barcode: string) {
    const data = await readSheetData(AUDIT_LOG_READ_RANGE);
    if (!data || data.length === 0) return false;

    const lowerBarcode = barcode.toLowerCase().trim();
    const rowsToDelete: number[] = [];

    data.forEach((row, i) => {
        const target = String(row[AUDIT_COL_TARGET] || '').toLowerCase();
        const details = String(row[AUDIT_COL_DETAILS] || '').toLowerCase();
        if (target.includes(lowerBarcode) || details.includes(lowerBarcode)) {
            rowsToDelete.push(i + 2); 
        }
    });

    if (rowsToDelete.length > 0) {
        const success = await deleteSheetRowsBatch(AUDIT_LOG_SHEET_NAME, rowsToDelete);
        if (success) {
            await logAuditEvent(email, 'FORENSIC_WIPE', barcode, `[PURGE] Wiped traces for ${barcode}`);
        }
        return success;
    }
    return true;
}

export async function logAuditEvent(user: string, action: string, target: string, details: string) {
  const ts = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  await appendSheetData(`${AUDIT_LOG_SHEET_NAME}!A:E`, [[ts, user, action, target, details]]);
  if (Math.random() < 0.01) pruneAuditLogs().catch(() => {});
}

export async function getAppMetaData() {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  if (data === null) throw new Error("System configuration unreachable.");

  const findJson = (key: string) => {
    const rows = data.filter(r => r[SETTINGS_COL_KEY] === key);
    if (!rows || rows.length === 0) return null;
    const lastRow = rows[rows.length - 1];
    try {
        return lastRow ? JSON.parse(lastRow[SETTINGS_COL_VALUE]) : null;
    } catch { return null; }
  };

  const rawStaff = findJson(STAFF_LIST_KEY);
  let processedStaff: StaffMember[] = [];
  if (Array.isArray(rawStaff)) {
      processedStaff = rawStaff.map(s => typeof s === 'string' ? { name: s.toUpperCase() } : s);
  } else {
      processedStaff = ["ASLAM", "SALAM", "MOIDU", "RAMSHAD", "MUHAMMED", "ANAS", "SATTAR", "JOWEL", "AROOS", "SHAHID", "RALEEM"].map(n => ({ name: n }));
  }

  return {
    permissions: findJson(PERMISSIONS_KEY) as Permissions | null,
    specialRequests: (findJson(SPECIAL_REQUESTS_KEY) as SpecialEntryRequest[]) || [],
    staff: processedStaff,
    locations: (findJson(LOCATION_LIST_KEY) as string[]) || ["Back side", "On Display", "Front Side"]
  };
}

export async function loadPermissionsFromSheet() { return (await getAppMetaData()).permissions; }

export async function savePermissionsToSheet(perms: Permissions) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  let lastIdx = -1;
  data?.forEach((r, i) => { if (r[SETTINGS_COL_KEY] === PERMISSIONS_KEY) lastIdx = i; });
  if (lastIdx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${lastIdx + 2}`, [[JSON.stringify(perms)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[PERMISSIONS_KEY, JSON.stringify(perms)]]);
}

export async function saveSpecialRequestsToSheet(reqs: SpecialEntryRequest[]) {
  const prunedReqs = reqs.slice(0, 100);
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  let lastIdx = -1;
  data?.forEach((r, i) => { if (r[SETTINGS_COL_KEY] === SPECIAL_REQUESTS_KEY) lastIdx = i; });
  if (lastIdx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${lastIdx + 2}`, [[JSON.stringify(prunedReqs)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[SPECIAL_REQUESTS_KEY, JSON.stringify(prunedReqs)]]);
}

export async function saveStaffListToSheet(staff: StaffMember[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  let lastIdx = -1;
  data?.forEach((r, i) => { if (r[SETTINGS_COL_KEY] === STAFF_LIST_KEY) lastIdx = i; });
  if (lastIdx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${lastIdx + 2}`, [[JSON.stringify(staff)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[STAFF_LIST_KEY, JSON.stringify(staff)]]);
}

export async function saveLocationListToSheet(locations: string[]) {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  let lastIdx = -1;
  data?.forEach((r, i) => { if (r[SETTINGS_COL_KEY] === LOCATION_LIST_KEY) lastIdx = i; });
  if (lastIdx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${lastIdx + 2}`, [[JSON.stringify(locations)]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[LOCATION_LIST_KEY, JSON.stringify(locations)]]);
}

export async function getProductDetailsByBarcode(barcode: string): Promise<Product | null> {
  const row = await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_BARCODE_A) || 
              await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_BARCODE_B);
  if (row) {
    const data = await readSheetData(`${DB_SHEET_NAME}!A${row}:H${row}`);
    if (data && data[0]) return transformToProduct(data[0]);
  }
  return null;
}

export async function addProduct(email: string, p: any) {
  const uniqueId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const row = [p.barcode, '', p.productName, p.supplierName, p.costPrice || '', '', '', uniqueId];
  await appendSheetData(`${DB_SHEET_NAME}!A:H`, [row]);
  await logAuditEvent(email, 'CREATE_PRODUCT', p.barcode, `[CREATED] Product: ${p.productName} | Barcode: ${p.barcode}`);
  return { id: uniqueId, uniqueId, ...p };
}

export async function deleteProductByBarcode(email: string, barcode: string) {
  let row = await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_UNIQUE_ID) ||
            await findRowByUniqueValue(DB_SHEET_NAME, barcode, DB_COL_BARCODE_A);
  if (row) {
    await deleteSheetRow(DB_SHEET_NAME, row);
    await logAuditEvent(email, 'DELETE_PRODUCT', barcode, `[REMOVED] Barcode: ${barcode}`);
    return true;
  }
  return false;
}

export async function deleteProductsByBarcodes(email: string, identifiers: string[]) {
  const sheetData = await readSheetData(DB_READ_RANGE);
  if (sheetData === null) return false;
  const idSet = new Set(identifiers.map(id => id.trim()));
  const rowIndicesToDelete: number[] = [];
  sheetData.forEach((row, i) => {
    const rowUniqueId = String(row[DB_COL_UNIQUE_ID] || '').trim();
    const rowBarcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
    if ((rowUniqueId && idSet.has(rowUniqueId)) || idSet.has(rowBarcode)) {
        rowIndicesToDelete.push(i + 2); 
    }
  });
  if (rowIndicesToDelete.length === 0) return false;
  return deleteSheetRowsBatch(DB_SHEET_NAME, rowIndicesToDelete);
}

export async function clearProductDatabase(email: string) {
  return clearSheetData(`${DB_SHEET_NAME}!A2:H`);
}

export async function updateProductBatch(batch: any[][], startRow: number) {
  const endRow = startRow + batch.length - 1;
  await ensureSheetRows(DB_SHEET_NAME, endRow);
  const range = `${DB_SHEET_NAME}!A${startRow}:H${endRow}`;
  return updateSheetData(range, batch);
}

export async function updateProductAndSupplierLinks(email: string, b: string, n: string, s: string, c?: number, uniqueId?: string) {
  let row = uniqueId ? await findRowByUniqueValue(DB_SHEET_NAME, uniqueId, DB_COL_UNIQUE_ID) : null;
  if (!row) row = await findRowByUniqueValue(DB_SHEET_NAME, b, DB_COL_BARCODE_A);
  if (row) {
    const costValue = (c === undefined || Number.isNaN(c)) ? '' : c;
    await batchUpdateSheetCells([
      { range: `${DB_SHEET_NAME}!C${row}`, values: [[n]] }, 
      { range: `${DB_SHEET_NAME}!D${row}`, values: [[s]] }, 
      { range: `${DB_SHEET_NAME}!E${row}`, values: [[costValue]] }
    ]);
    return true;
  }
  return false;
}

export async function updateSupplierNameAndReferences(email: string, oldName: string, newName: string) {
  const dbData = await readSheetData(DB_READ_RANGE);
  if (dbData) {
    const dbUpdates: { range: string; values: any[][] }[] = [];
    dbData.forEach((row, i) => {
      if (String(row[DB_COL_SUPPLIER_NAME] || '').trim() === oldName.trim()) {
        dbUpdates.push({ range: `${DB_SHEET_NAME}!D${i + 2}`, values: [[newName]] });
      }
    });
    if (dbUpdates.length > 0) await batchUpdateSheetCells(dbUpdates);
  }
  return true;
}

/**
 * STANDARD INVENTORY LOGGING
 * Logs exclusively to "Form responses 2".
 */
export async function addInventoryItemToSheet(item: any) {
  try {
    const payload = {
      action: 'standardLog', 
      isStandardLog: true,
      barcode: item.barcode,
      quantity: item.quantity,
      expiryDate: item.expiryDate, 
      location: item.location,
      staff: item.staffName,
      productName: item.productName,
      supplierName: item.supplierName || '', 
      itemType: item.itemType,        
      timestamp: item.timestamp || new Date().toISOString(),
      disableNotification: item.disableNotification === true
    };

    const response = await fetch(APPSCRIPT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow', 
      signal: AbortSignal.timeout(15000) 
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success') return true;
    }
  } catch (error) {
    console.error("AppsScript Standard Log Error:", error);
  }

  // FALLBACK
  try {
    const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
    const sdkRowData = [
      format(entryDate, "d/M/yyyy HH:mm:ss"), 
      item.barcode, 
      item.quantity, 
      item.expiryDate, 
      item.location, 
      item.staffName, 
      item.productName, 
      item.supplierName || '', 
      item.itemType, 
      item.id
    ];
    return await appendSheetData(`${FORM_RESPONSES_SHEET_NAME}!A:J`, [sdkRowData]);
  } catch (error) {
    return false;
  }
}

export async function updateInventoryItemDetails(email: string, id: string, u: any) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) throw new Error("Record Identification Failure.");
  const ups = [];
  if (u.quantity !== undefined) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!C${row}`, values: [[Number(u.quantity)]] });
  if (u.location) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!E${row}`, values: [[u.location]] });
  if (u.itemType) ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!I${row}`, values: [[u.itemType]] });
  if (u.expiryDate) {
    const formattedDate = format(parseISO(u.expiryDate), "d/M/yyyy");
    ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!D${row}`, values: [[formattedDate]] });
  }
  if (ups.length > 0) await batchUpdateSheetCells(ups);
  return { id, ...u };
}

export async function processReturn(email: string, id: string, q: number | undefined, staff: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) return;
  const data = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!C${row}:C${row}`);
  const qty = parseInt(String(data?.[0]?.[0] || '0'), 10);
  const final = Math.max(0, qty - (q === undefined ? qty : q));
  if (final > 0) await updateSheetData(`${FORM_RESPONSES_SHEET_NAME}!C${row}`, [[final]]);
  else await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
  return { success: true };
}

export async function deleteInventoryItemById(email: string, id: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (row) return deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
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
  for (let d = 14; d >= 0; d--) {
    const day = subDays(today, d);
    const curr = inv.reduce((s, x) => s + x.quantity, 0);
    const post = inv.filter(x => x.timestamp && isAfter(parseISO(x.timestamp), endOfDay(day))).reduce((s, x) => s + x.quantity, 0);
    trend.push({ date: format(day, 'MMM d'), totalStock: Math.max(0, curr - post) });
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
    const items = await getInventoryItems();
    return items.filter(i => i.barcode === b); 
}
