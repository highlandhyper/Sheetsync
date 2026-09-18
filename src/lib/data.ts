import { Product, Supplier, InventoryItem, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry, SpecialEntryRequest, ExpiryReminder, StaffMember, OnDisplayAlert } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells, deleteSheetRowsRange, deleteSheetRowsBatch, clearSheetData, ensureSheetRows } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, isAfter, startOfDay, isSameDay, endOfDay, subDays } from 'date-fns';

const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB"; 
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; 
const AUDIT_LOG_SHEET_NAME = "Audit Log";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";

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
const DB_COL_UNIQUE_ID = 7; 

const SETTINGS_COL_KEY = 0;
const SETTINGS_COL_VALUE = 1;

const AUDIT_COL_TIMESTAMP = 0;
const AUDIT_COL_USER = 1;
const AUDIT_COL_ACTION = 2;
const AUDIT_COL_TARGET = 3;
const AUDIT_COL_DETAILS = 4;

const WATCH_COL_ID = 1;
const WATCH_COL_BARCODE = 2;
const WATCH_COL_PRODUCT = 3;
const WATCH_COL_EXPIRY = 4;
const WATCH_COL_SUPPLIER = 5;
const WATCH_COL_STATUS = 6;
const WATCH_COL_TIMESTAMP = 7;
const WATCH_COL_STAFF = 8;

const ODA_COL_ID = 0;
const ODA_COL_BARCODE = 1;
const ODA_COL_PRODUCT = 2;
const ODA_COL_EXPIRY = 3;
const ODA_COL_STAFF = 4;
const ODA_COL_TOKEN = 5;
const ODA_COL_PIN = 6;
const ODA_COL_EXPIRES = 7;
const ODA_COL_USED = 8;

const DB_READ_RANGE = `${DB_SHEET_NAME}!A2:H`; 
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;
const AUDIT_LOG_READ_RANGE = `${AUDIT_LOG_SHEET_NAME}!A2:E`;
const EXPIRY_WATCH_READ_RANGE = `${EXPIRY_WATCH_SHEET_NAME}!A2:H`;
const ON_DISPLAY_ALERTS_READ_RANGE = `${ON_DISPLAY_ALERTS_SHEET_NAME}!A2:I`;

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
  
  const barcodeA = String(row[DB_COL_BARCODE_A] || '').trim();
  const barcodeB = String(row[DB_COL_BARCODE_B] || '').trim();
  const barcode = barcodeA || barcodeB;
  
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
  const qty = parseFloat(qtyRaw.replace(/[^0-9.-]+/g,""));
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
        const expRaw = row[WATCH_COL_EXPIRY - 1];
        const expDate = parseFlexibleTimestamp(expRaw);
        const tsRaw = row[WATCH_COL_TIMESTAMP - 1];
        const tsDate = parseFlexibleTimestamp(tsRaw);

        return {
            id: String(row[WATCH_COL_ID - 1] || ''),
            barcode: String(row[WATCH_COL_BARCODE - 1] || ''),
            productName: String(row[WATCH_COL_PRODUCT - 1] || ''),
            expiryDate: expDate && isValid(expDate) ? format(expDate, 'yyyy-MM-dd') : String(expRaw || ''),
            supplierName: String(row[WATCH_COL_SUPPLIER - 1] || ''),
            status: (String(row[WATCH_COL_STATUS - 1] || 'pending').toLowerCase() as any),
            timestamp: tsDate && isValid(tsDate) ? tsDate.toISOString() : String(tsRaw || ''),
            staffName: String(row[WATCH_COL_STAFF - 1] || '').trim() 
        };
    }).filter(r => r.id && r.status === 'pending');
}

export async function getOnDisplayItemByToken(token: string): Promise<{ items: InventoryItem[]; pin: string } | null> {
  const alerts = await readSheetData(ON_DISPLAY_ALERTS_READ_RANGE);
  if (!alerts) return null;
  
  const alertRow = alerts.find(row => String(row[ODA_COL_TOKEN]).trim() === token);
  if (!alertRow) return null;
  
  const isUsed = String(alertRow[ODA_COL_USED]).toLowerCase() === 'yes';
  const expiresAt = parseFlexibleTimestamp(alertRow[ODA_COL_EXPIRES]);
  const pin = String(alertRow[ODA_COL_PIN] || '').trim();
  
  if (isUsed || (expiresAt && isBefore(expiresAt, new Date()))) return null;
  
  const barcode = String(alertRow[ODA_COL_BARCODE]).trim();
  const staffName = String(alertRow[ODA_COL_STAFF]).trim();
  const inventory = await getInventoryItems();
  
  // Grouped retrieval: find ALL active batches for this SKU/Staff in On Display
  const items = inventory.filter(i => 
    i.barcode.trim() === barcode && 
    i.location === "On Display" && 
    i.staffName === staffName &&
    i.quantity > 0
  );
  
  if (items.length === 0) return null;
  return { items, pin };
}

export async function markOnDisplayTokenUsed(token: string) {
  const row = await findRowByUniqueValue(ON_DISPLAY_ALERTS_SHEET_NAME, token, ODA_COL_TOKEN);
  if (row) {
    await updateSheetData(`${ON_DISPLAY_ALERTS_SHEET_NAME}!I${row}`, [['Yes']]);
    return true;
  }
  return false;
}

export async function addExpiryReminder(reminder: Omit<ExpiryReminder, 'id' | 'timestamp' | 'status'>) {
    const id = `rem_${Date.now()}`;
    const ts = new Date().toISOString();
    const row = [id, id, reminder.barcode, reminder.productName, reminder.expiryDate, reminder.supplierName || '', 'pending', ts, reminder.staffName || ''];
    await appendSheetData(`${EXPIRY_WATCH_SHEET_NAME}!A:I`, [row]);
    return { ...reminder, id, timestamp: ts, status: 'pending' as const };
}

export async function resolveExpiryReminder(id: string, email: string) {
    const row = await findRowByUniqueValue(EXPIRY_WATCH_SHEET_NAME, id, WATCH_COL_ID);
    if (row) {
        await updateSheetData(`${EXPIRY_WATCH_SHEET_NAME}!G${row}`, [['resolved']]);
        await logAuditEvent(email, 'RESOLVE_DIARY', id, `Cleared product from Diary Reminders.`);
        return true;
    }
    return false;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const data = await readSheetData(AUDIT_LOG_READ_RANGE);
  if (data === null) throw new Error("Audit Trail Unavailable");
  const logs = data.map((r, i) => {
    const ts = parseFlexibleTimestamp(r[AUDIT_COL_TIMESTAMP]);
    return {
      id: `a_${i}`,
      timestamp: ts?.toISOString() || new Date().toISOString(),
      user: String(r[AUDIT_COL_USER] || 'Unknown'),
      action: String(r[AUDIT_COL_ACTION] || ''),
      target: String(r[AUDIT_COL_TARGET] || ''),
      details: String(r[AUDIT_COL_DETAILS] || ''),
    };
  });
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5000);
}

export async function logAuditEvent(user: string, action: string, target: string, details: string) {
  const ts = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  await appendSheetData(`${AUDIT_LOG_SHEET_NAME}!A:E`, [[ts, user, action, target, details]]);
}

export async function getAppMetaData() {
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  if (data === null) throw new Error("System configuration unreachable.");
  const findJson = (key: string) => {
    const rows = data.filter(r => r[SETTINGS_COL_KEY] === key);
    if (!rows || rows.length === 0) return null;
    const lastRow = rows[rows.length - 1];
    try { return lastRow ? JSON.parse(lastRow[SETTINGS_COL_VALUE]) : null; } catch { return null; }
  };
  const rawStaff = findJson(STAFF_LIST_KEY);
  const processedStaff = Array.isArray(rawStaff) ? rawStaff.map(s => typeof s === 'string' ? { name: s.toUpperCase() } : s) : [];
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
  const data = await readSheetData(APP_SETTINGS_READ_RANGE);
  let lastIdx = -1;
  data?.forEach((r, i) => { if (r[SETTINGS_COL_KEY] === SPECIAL_REQUESTS_KEY) lastIdx = i; });
  if (lastIdx !== -1) return updateSheetData(`${APP_SETTINGS_SHEET_NAME}!B${lastIdx + 2}`, [[JSON.stringify(reqs.slice(0, 200))]]);
  return appendSheetData(`${APP_SETTINGS_SHEET_NAME}!A:B`, [[SPECIAL_REQUESTS_KEY, JSON.stringify(reqs.slice(0, 200))]]);
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

export async function addInventoryItemToSheet(item: any) {
    const ts = item.timestamp ? new Date(item.timestamp) : new Date();
    const row = [
        format(ts, "d/M/yyyy HH:mm:ss"), 
        item.barcode, 
        item.quantity, 
        item.expiryDate, 
        item.location, 
        item.staffName, 
        item.productName || "", 
        item.supplierName || "", 
        item.itemType, 
        item.id
    ];
    return appendSheetData(`${FORM_RESPONSES_SHEET_NAME}!A:J`, [row]);
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
  if (!row) return { success: false, message: "Record identification failure." };
  const fullRowData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${row}:J${row}`);
  if (!fullRowData || !fullRowData[0]) return { success: false };
  const currentItem = transformToInventoryItem(fullRowData[0], row - 2);
  if (!currentItem) return { success: false };
  const qtyToReturn = q === undefined ? currentItem.quantity : q;
  const newQty = Math.max(0, currentItem.quantity - qtyToReturn);
  if (newQty > 0) await updateSheetData(`${FORM_RESPONSES_SHEET_NAME}!C${row}`, [[newQty]]);
  else await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
  const auditDetails = `[RETURN] Product: ${currentItem.productName} | Barcode: ${currentItem.barcode} | Qty: ${qtyToReturn} | Staff: ${staff}`;
  await logAuditEvent(email, 'RETURN_INVENTORY', id, auditDetails);
  return { success: true };
}

export async function deleteInventoryItemById(email: string, id: string) {
  const row = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, id, INV_COL_UNIQUE_ID);
  if (row) return deleteSheetRow(FORM_RESPONSES_SHEET_NAME, row);
  return false;
}