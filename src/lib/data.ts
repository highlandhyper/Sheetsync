import { Product, Supplier, InventoryItem, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry, SpecialEntryRequest } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells, deleteSheetRowsRange, deleteSheetRowsBatch, clearSheetData, ensureSheetRows } from './google-sheets-client';
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

const SCRIPT_URL = process.env.GOOGLE_APPSCRIPT_API || "";

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
        console.log(`Pruned ${rowsToDelete.length} expired audit logs.`);
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
            rowsToDelete.push(i + 2); // A2 is row 2
        }
    });

    if (rowsToDelete.length > 0) {
        const success = await deleteSheetRowsBatch(AUDIT_LOG_SHEET_NAME, rowsToDelete);
        if (success) {
            await logAuditEvent(email, 'FORENSIC_WIPE', barcode, `[PURGE] Wiped ${rowsToDelete.length} security traces for barcode: ${barcode}`);
        }
        return success;
    }
    return true;
}

export async function logAuditEvent(user: string, action: string, target: string, details: string) {
  const ts = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  await appendSheetData(`${AUDIT_LOG_SHEET_NAME}!A:E`, [[ts, user, action, target, details]]);
  
  if (Math.random() < 0.01) {
      pruneAuditLogs().catch(err => console.error("Auto-pruning failed:", err));
  }
}

export async function getAppMetaData() {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  const findJson = (key: string) => {
    const rows = data?.filter(r => r[SETTINGS_COL_KEY] === key);
    if (!rows || rows.length === 0) return null;
    const lastRow = rows[rows.length - 1];
    try {
        return lastRow ? JSON.parse(lastRow[SETTINGS_COL_VALUE]) : null;
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

export async function saveStaffListToSheet(staff: string[]) {
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
    const data = await readSheetData(`${DB_SHEET_NAME}!C${row}:C${row}`);
    const name = data?.[0]?.[0] || 'Unknown';
    await deleteSheetRow(DB_SHEET_NAME, row);
    await logAuditEvent(email, 'DELETE_PRODUCT', barcode, `[REMOVED] Barcode: ${barcode} | Product: ${name}`);
    return true;
  }
  return false;
}

export async function deleteProductsByBarcodes(email: string, identifiers: string[]) {
  const sheetData = await readSheetData(DB_READ_RANGE);
  if (!sheetData || sheetData.length === 0) return false;
  const idSet = new Set(identifiers.map(id => id.trim()));
  const rowIndicesToDelete: number[] = [];
  const deletedInfo: string[] = [];

  sheetData.forEach((row, i) => {
    const rowUniqueId = String(row[DB_COL_UNIQUE_ID] || '').trim();
    const rowBarcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
    if ((rowUniqueId && idSet.has(rowUniqueId)) || idSet.has(rowBarcode)) {
        rowIndicesToDelete.push(i + 2); 
        deletedInfo.push(`${row[DB_COL_PRODUCT_NAME]} (${rowBarcode})`);
    }
  });
  if (rowIndicesToDelete.length === 0) return false;
  const success = await deleteSheetRowsBatch(DB_SHEET_NAME, rowIndicesToDelete);
  if (success) await logAuditEvent(email, 'BULK_DELETE_PRODUCT', identifiers.join(','), `[BATCH REMOVAL] Deleted ${deletedInfo.length} catalog items: ${deletedInfo.join(', ')}`);
  return success;
}

export async function clearProductDatabase(email: string) {
  const success = await clearSheetData(`${DB_SHEET_NAME}!A2:H`);
  if (success) await logAuditEvent(email, 'WIPE_DATABASE', 'GLOBAL', `[FULL WIPE] Catalog cleared by administrator.`);
  return success;
}

export async function updateProductBatch(batch: any[][], startRow: number) {
  const endRow = startRow + batch.length - 1;
  await ensureSheetRows(DB_SHEET_NAME, endRow);
  const range = `${DB_SHEET_NAME}!A${startRow}:H${endRow}`;
  return updateSheetData(range, batch);
}

export async function appendProductBatch(batch: any[][]) {
  return appendSheetData(`${DB_SHEET_NAME}!A:H`, batch);
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
    await logAuditEvent(email, 'UPDATE_PRODUCT', b, `[UPDATED] Barcode: ${b} | Product: ${n} | Supplier: ${s} | Unit Cost: ${costValue}`);
    return true;
  }
  return false;
}

export async function updateSupplierNameAndReferences(email: string, oldName: string, newName: string) {
  const oldSupplier = oldName.trim();
  const newSupplier = newName.trim();
  if (!oldSupplier || !newSupplier || oldSupplier === newSupplier) return false;
  const dbData = await readSheetData(DB_READ_RANGE);
  if (dbData) {
    const dbUpdates: { range: string; values: any[][] }[] = [];
    dbData.forEach((row, i) => {
      if (String(row[DB_COL_SUPPLIER_NAME] || '').trim() === oldSupplier) {
        dbUpdates.push({ range: `${DB_SHEET_NAME}!D${i + 2}`, values: [[newSupplier]] });
      }
    });
    if (dbUpdates.length > 0) await batchUpdateSheetCells(dbUpdates);
  }
  await logAuditEvent(email, 'UPDATE_SUPPLIER', oldSupplier, `[RENAMED VENDOR] Changed from "${oldSupplier}" to "${newSupplier}" across all registries.`);
  return true;
}

export async function addInventoryItemToSheet(item: any) {
  try {
    const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
    const sdkRowData = [
      format(entryDate, "d/M/yyyy HH:mm:ss"), 
      item.barcode, item.quantity, item.expiryDate, item.location, item.staffName, 
      item.productName, item.supplierName || '', item.itemType, item.id
    ];
    const sdkWriteSuccess = await appendSheetData(`${FORM_RESPONSES_SHEET_NAME}!A:J`, [sdkRowData]);
    return sdkWriteSuccess;
  } catch (error) {
    return false;
  }
}

export async function updateInventoryItemDetails(email: string, id: string, u: any) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) throw new Error("Not found.");
  
  const existingData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${row}:J${row}`);
  if (!existingData || !existingData[0]) throw new Error("Data retrieval failed.");
  
  const rowData = existingData[0];
  const barcode = rowData[INV_COL_BARCODE];
  const productName = rowData[INV_COL_PRODUCT_NAME];
  const oldQty = rowData[INV_COL_QTY];
  const oldLoc = rowData[INV_COL_LOCATION];
  const oldType = rowData[INV_COL_TYPE];

  const ups = [];
  const changes = [];

  if (u.quantity !== undefined && String(u.quantity) !== String(oldQty)) {
    ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!C${row}`, values: [[Number(u.quantity)]] });
    changes.push(`Qty: ${oldQty} -> ${u.quantity}`);
  }
  if (u.location && u.location !== oldLoc) {
    ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!E${row}`, values: [[u.location]] });
    changes.push(`Zone: ${oldLoc} -> ${u.location}`);
  }
  if (u.itemType && u.itemType !== oldType) {
    ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!I${row}`, values: [[u.itemType]] });
    changes.push(`Type: ${oldType} -> ${u.itemType}`);
  }
  if (u.expiryDate) {
    const formattedDate = format(parseISO(u.expiryDate), "d/M/yyyy");
    ups.push({ range: `${FORM_RESPONSES_SHEET_NAME}!D${row}`, values: [[formattedDate]] });
  }

  if (ups.length > 0) { 
    await batchUpdateSheetCells(ups); 
    await logAuditEvent(email, 'UPDATE_INVENTORY', id, `[EDITED] Barcode: ${barcode} | Product: ${productName} | Changes: ${changes.join(', ')}`); 
  }
  return { id, ...u };
}

export async function processReturn(email: string, id: string, q: number | undefined, staff: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (!row) throw new Error("Not found.");
  
  const data = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${row}:J${row}`);
  if (!data || !data[0]) throw new Error("Data retrieval failed.");
  
  const rowData = data[0];
  const barcode = rowData[INV_COL_BARCODE];
  const productName = rowData[INV_COL_PRODUCT_NAME];
  const qty = parseInt(String(rowData[INV_COL_QTY] || '0'), 10);
  const amt = q === undefined ? qty : q;
  const final = Math.max(0, qty - amt);

  if (final > 0) await updateSheetData(`${FORM_RESPONSES_SHEET_NAME}!C${row}`, [[final]]);
  else await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
  
  await logAuditEvent(email, 'RETURN_INVENTORY', id, `[RETURN] Barcode: ${barcode} | Product: ${productName} | Returned ${amt} units. Remaining: ${final}. By: ${staff}`);
  return { success: true };
}

export async function deleteInventoryItemById(email: string, id: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (row) {
    const data = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${row}:J${row}`);
    if (data && data[0]) {
        const barcode = data[0][INV_COL_BARCODE];
        const productName = data[0][INV_COL_PRODUCT_NAME];
        await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
        await logAuditEvent(email, 'DELETE_INVENTORY', id, `[DELETED] Barcode: ${barcode} | Product: ${productName} | Permanent log removal.`);
        return true;
    }
    await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
    return true;
  }
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
