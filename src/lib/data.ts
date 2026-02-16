

import type { Product, Supplier, InventoryItem, ReturnedItem, AddInventoryItemFormValues, EditInventoryItemFormValues, ItemType, DashboardMetrics, StockBySupplier, Permissions, StockTrendData, AuditLogEntry } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, startOfDay, isSameDay, endOfDay, subDays } from 'date-fns';

// --- Sheet Names (MUST MATCH YOUR ACTUAL SHEET NAMES) ---
const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB"; // Consolidated sheet for products and suppliers
const RETURNS_LOG_SHEET_NAME = "Returns Log";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; // New sheet for settings

// --- Audit Log Configuration ---
// The following constants define the sheet and columns for storing audit trail data.
// The app is configured to write to a sheet named "Audit Log" as specified below.
const AUDIT_LOG_SHEET_NAME = "Audit Log";

// --- Column Indices (0-based - MUST MATCH YOUR ACTUAL SHEET STRUCTURE) ---
// "Form responses 2" - Inventory Log (Assuming A-I, with J for app-generated Unique ID)
const INV_COL_TIMESTAMP = 0;        // A - Timestamp
const INV_COL_BARCODE = 1;          // B - Barcode
const INV_COL_QTY = 2;              // C - Qty
const INV_COL_EXPIRY = 3;           // D - Expiry Date (EXPECTED AS DD/MM/YYYY from sheet)
const INV_COL_LOCATION = 4;         // E - Location
const INV_COL_STAFF = 5;            // F - Staff Name (Who are you?)
const INV_COL_PRODUCT_NAME = 6;     // G - Product Name
const INV_COL_SUPPLIER_NAME = 7;    // H - Supplier Name
const INV_COL_TYPE = 8;             // I - Item Type (Expiry/Damage)
const INV_COL_UNIQUE_ID = 9;        // J - Unique ID for the inventory row (written by app)

const INVENTORY_EXPECTED_COLUMNS_FROM_SHEET = 9;
const INVENTORY_TOTAL_COLUMNS_FOR_WRITE = 10;


// "DB" - Product and Supplier Catalog
const DB_COL_BARCODE_A = 0;           // A - Barcode
const DB_COL_BARCODE_B = 1;           // B - Barcode
const DB_COL_PRODUCT_NAME = 2;      // C - Product Name
const DB_COL_SUPPLIER_NAME = 3;     // D - Supplier Name
const DB_COL_COST_PRICE = 4;        // E - Cost Price


// "Returns Log"
const RL_COL_ORIGINAL_INV_ID = 0;   // A - Original Inventory Item ID from "Form responses 2" Column J
const RL_COL_PRODUCT_NAME = 1;    // B
const RL_COL_BARCODE = 2;         // C
const RL_COL_SUPPLIER_NAME = 3;   // D
const RL_COL_RETURNED_QTY = 4;    // E
const RL_COL_EXPIRY_DATE = 5;     // F (Stored as YYYY-MM-DD from transformToInventoryItem)
const RL_COL_LOCATION = 6;        // G
const RL_COL_ORIGINAL_STAFF = 7;  // H (Staff who originally logged the item)
const RL_COL_ITEM_TYPE = 8;       // I
const RL_COL_PROCESSED_BY = 9;    // J (Staff who processed the return)
const RL_COL_RETURN_TIMESTAMP = 10; // K (Timestamp of when the return was processed)

// "APP_SETTINGS" - Key-Value store for application settings
const SETTINGS_COL_KEY = 0;       // A - Key (e.g., 'permissions')
const SETTINGS_COL_VALUE = 1;     // B - Value (e.g., a JSON string)

// "Audit Log" Column Indices
const AUDIT_COL_TIMESTAMP = 0;    // A
const AUDIT_COL_USER = 1;         // B
const AUDIT_COL_ACTION = 2;       // C
const AUDIT_COL_TARGET = 3;       // D
const AUDIT_COL_DETAILS = 4;      // E


// --- Read Ranges ---
const DB_READ_RANGE = `${DB_SHEET_NAME}!A1:E`;
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const RETURN_LOG_READ_RANGE = `${RETURNS_LOG_SHEET_NAME}!A2:K`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;
const AUDIT_LOG_READ_RANGE = `${AUDIT_LOG_SHEET_NAME}!A2:E`;

// --- Append Ranges (for adding new rows) ---
const DB_APPEND_RANGE = `${DB_SHEET_NAME}!A:E`;
const INVENTORY_APPEND_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A:J`;
const RETURN_LOG_APPEND_RANGE = `${RETURNS_LOG_SHEET_NAME}!A:K`;
const APP_SETTINGS_APPEND_RANGE = `${APP_SETTINGS_SHEET_NAME}!A:B`;
const AUDIT_LOG_APPEND_RANGE = `${AUDIT_LOG_SHEET_NAME}!A:E`;

function excelSerialDateToJSDate(serial: number): Date | null {
  if (isNaN(serial) || serial <= 0) return null;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const jsDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return isValid(jsDate) ? jsDate : null;
}

function parseFlexibleTimestamp(timestampValue: any): Date | null {
  if (!timestampValue || String(timestampValue).trim() === '') return null;

  if (timestampValue instanceof Date && isValid(timestampValue)) {
    return timestampValue;
  }
  if (typeof timestampValue === 'number') {
    const d = excelSerialDateToJSDate(timestampValue);
    if (d && isValid(d)) return d;
  }
  if (typeof timestampValue === 'string') {
    const trimmedTimestampValue = timestampValue.trim();

    // Try parsing as ISO 8601 first, as it's the most reliable format
    const isoDate = parseISO(trimmedTimestampValue);
    if (isValid(isoDate)) return isoDate;

    // Special handling for "dd/MM/yyyy HH:mm:ss" to avoid locale issues
    const dmyHmsMatch = trimmedTimestampValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (dmyHmsMatch) {
      const [_, day, month, year, hours, minutes, seconds] = dmyHmsMatch;
      // Reconstruct into a format that parseISO can handle without ambiguity
      const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
      const d = parseISO(isoString);
      if (isValid(d)) return d;
    }

    // Fallback for other potential formats, though less preferred
    const formatsToTry: string[] = [
      "yyyy-MM-dd HH:mm:ss",
      "M/d/yyyy H:mm:ss",
      "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy",
      "yyyy-MM-dd"
    ];
    for (const fmt of formatsToTry) {
      const d = dateParse(trimmedTimestampValue, fmt, new Date());
      if (isValid(d)) return d;
    }
  }
  
  console.warn(`GS_Data: parseFlexibleTimestamp was unable to parse the date value:`, timestampValue);
  return null;
}


function transformToProduct(row: any[], rowIndex: number): Product | null {
  const sheetRowNumber = rowIndex + 1; // Data starts at row 1
  try {
    if (!row || row.length < 1) { return null; }
    // As per user, check column A, then B for barcode.
    const barcode = String(row[DB_COL_BARCODE_A] || row[DB_COL_BARCODE_B] || '').trim();
    const productName = String(row[DB_COL_PRODUCT_NAME] || '').trim();
    const supplierName = String(row[DB_COL_SUPPLIER_NAME] || '').trim();
    if (!barcode || !productName) { return null; }

    const costPriceRaw = row[DB_COL_COST_PRICE];
    const costPrice = (costPriceRaw !== undefined && costPriceRaw !== null && String(costPriceRaw).trim() !== '')
      ? parseFloat(String(costPriceRaw).replace(/[^0-9.-]+/g,"")) // Clean up currency symbols etc.
      : undefined;
      
    return { 
        id: barcode, 
        barcode: barcode, 
        productName: productName,
        supplierName: supplierName || undefined,
        costPrice: costPrice && !isNaN(costPrice) ? costPrice : undefined,
    };
  } catch (error) {
    console.error(`GS_Data: Error transforming product row ${sheetRowNumber} from "${DB_SHEET_NAME}":`, error, "Row data:", row);
    return null;
  }
}

function transformToSupplier(supplierName: string, index: number): Supplier {
  const id = `supplier_gs_${supplierName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${index}`;
  return { id: id, name: supplierName.trim(), createdAt: new Date().toISOString() };
}

function transformToInventoryItem(row: any[], rowIndex: number): InventoryItem | null {
  const sheetRowNumber = rowIndex + 2;
  const minExpectedCols = 8;

  try {
    if (!row || row.length < minExpectedCols) {
      return null;
    }

    const barcode = String(row[INV_COL_BARCODE] || '').trim();
    const productName = String(row[INV_COL_PRODUCT_NAME] || 'Not Found').trim();
    const quantityStr = String(row[INV_COL_QTY] || '0').trim();
    const quantity = parseInt(quantityStr, 10);

    if (!barcode || isNaN(quantity)) {
      return null;
    }

    const idFromSheet = row.length > INV_COL_UNIQUE_ID && row[INV_COL_UNIQUE_ID] ? String(row[INV_COL_UNIQUE_ID]).trim() : '';
    const clientSideGeneratedId = `inv_temp_display_${sheetRowNumber}_${barcode}_${Date.now()}`;
    const itemId = idFromSheet || clientSideGeneratedId;

    let expiryDateStr: string | undefined = undefined;
    const expiryValue = row[INV_COL_EXPIRY];
     if (expiryValue !== undefined && expiryValue !== null && String(expiryValue).trim() !== '') {
        const parsedDate = parseFlexibleTimestamp(expiryValue);
        if (parsedDate && isValid(parsedDate)) {
            expiryDateStr = format(parsedDate, 'yyyy-MM-dd');
        }
    }

    let itemTimestamp: string | undefined = undefined;
    const timestampValue = row[INV_COL_TIMESTAMP];
    if (timestampValue !== undefined && timestampValue !== null && String(timestampValue).trim() !== '') {
      const parsedTimestamp = parseFlexibleTimestamp(timestampValue);
      if (parsedTimestamp && isValid(parsedTimestamp)) {
        itemTimestamp = parsedTimestamp.toISOString();
      }
    }

    const itemTypeString = row.length > INV_COL_TYPE && row[INV_COL_TYPE] ? String(row[INV_COL_TYPE]).trim() : 'Expiry';
    const itemType: 'Expiry' | 'Damage' = (itemTypeString.toLowerCase() === 'damage') ? 'Damage' : 'Expiry';

    return {
      id: itemId,
      productName: productName,
      barcode: barcode,
      supplierName: String(row[INV_COL_SUPPLIER_NAME] || '').trim(),
      quantity: quantity,
      expiryDate: expiryDateStr,
      location: String(row[INV_COL_LOCATION] || '').trim(),
      staffName: String(row[INV_COL_STAFF] || '').trim(),
      itemType: itemType,
      timestamp: itemTimestamp,
    };
  } catch (error) {
    console.error(`GS_Data: Error transforming inventory row ${sheetRowNumber} from "${FORM_RESPONSES_SHEET_NAME}":`, error, "Row data:", row);
    return null;
  }
}

function transformToReturnedItem(row: any[], rowIndex: number): ReturnedItem | null {
  const sheetRowNumber = rowIndex + 2;
  try {
    const expectedCols = 11;
    if (!row || row.length < expectedCols -1 ) { return null; }
    const clientSideUniqueId = `ret_log_sheet_gs_${sheetRowNumber}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    const originalInvIdFromSheet = String(row[RL_COL_ORIGINAL_INV_ID] || '').trim();
    const productName = String(row[RL_COL_PRODUCT_NAME] || '').trim();
    const barcode = String(row[RL_COL_BARCODE] || '').trim();
    const returnedQuantity = parseInt(String(row[RL_COL_RETURNED_QTY] || '0').trim(), 10);
    if (!productName || !barcode || isNaN(returnedQuantity) || returnedQuantity <= 0) { return null; }

    let expiryDateStr: string | undefined = undefined;
    const expiryValue = row[RL_COL_EXPIRY_DATE];
    if (expiryValue !== undefined && expiryValue !== null && String(expiryValue).trim() !== '') {
      const parsedDate = parseFlexibleTimestamp(expiryValue);
      if (parsedDate && isValid(parsedDate)) {
        expiryDateStr = format(parsedDate, 'yyyy-MM-dd');
      }
    }

    let returnTimestamp: string | undefined = undefined;
    const returnTimestampValue = row[RL_COL_RETURN_TIMESTAMP];
     if(returnTimestampValue) {
        const parsedTimestamp = parseFlexibleTimestamp(returnTimestampValue);
        if (parsedTimestamp && isValid(parsedTimestamp)) returnTimestamp = parsedTimestamp.toISOString();
     }

    const itemTypeString = row.length > RL_COL_ITEM_TYPE && row[RL_COL_ITEM_TYPE] ? String(row[RL_COL_ITEM_TYPE]).trim() : 'Expiry';
    const itemType: 'Expiry' | 'Damage' = (itemTypeString.toLowerCase() === 'damage') ? 'Damage' : 'Expiry';

    return {
      id: clientSideUniqueId,
      originalInventoryItemId: originalInvIdFromSheet || undefined,
      productName: productName,
      barcode: barcode,
      supplierName: String(row[RL_COL_SUPPLIER_NAME] || '').trim(),
      returnedQuantity: returnedQuantity,
      expiryDate: expiryDateStr,
      location: String(row[RL_COL_LOCATION] || '').trim(),
      staffName: String(row[RL_COL_ORIGINAL_STAFF] || '').trim(),
      itemType: itemType,
      processedBy: String(row[RL_COL_PROCESSED_BY] || '').trim(),
      returnTimestamp: returnTimestamp,
    };
  } catch (error) {
    console.error(`GS_Data: Error transforming returned item row ${sheetRowNumber} from "${RETURNS_LOG_SHEET_NAME}":`, error, "Row data:", row);
    return null;
  }
}

export async function getProducts(): Promise<Product[]> {
  const timeLabel = "GS_Data: getProducts total duration";
  console.time(timeLabel);
  try {
    const productSheetData = await readSheetData(DB_READ_RANGE);

    if (!productSheetData) {
      console.log("GS_Data: getProducts - No product data returned from DB sheet.");
      return [];
    }

    const products = productSheetData.map((row, index) => transformToProduct(row, index))
      .filter(p => p !== null) as Product[];
    
    console.log(`GS_Data: getProducts - Transformed ${products.length} products from DB sheet.`);
    return products;
  } catch (error) {
    console.error("GS_Data: Critical error in getProducts:", error);
    return [];
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function getSuppliers(): Promise<Supplier[]> {
  const timeLabel = "GS_Data: getSuppliers total duration";
  console.time(timeLabel);
  try {
    const sheetData = await readSheetData(DB_READ_RANGE);
    if (!sheetData) {
      console.log("GS_Data: getSuppliers - No sheet data returned from readSheetData.");
      return [];
    }
    const supplierNames = new Set<string>();
    sheetData.forEach(row => {
      if (row && row.length > DB_COL_SUPPLIER_NAME && row[DB_COL_SUPPLIER_NAME]) {
        const name = String(row[DB_COL_SUPPLIER_NAME]).trim();
        if (name) supplierNames.add(name);
      }
    });
    const suppliers = Array.from(supplierNames).map((name, index) => transformToSupplier(name, index));
    console.log(`GS_Data: getSuppliers - Found ${suppliers.length} unique suppliers from DB sheet.`);
    return suppliers;
  } catch (error) {
    console.error("GS_Data: Critical error in getSuppliers:", error);
    return [];
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function getInventoryItems(filters?: { supplierName?: string; staffName?: string }): Promise<InventoryItem[]> {
  try {
    const sheetData = await readSheetData(INVENTORY_READ_RANGE);
    if (!sheetData) {
        return [];
    }
    
    let transformedCount = 0;
    const allTransformedItems = sheetData
      .map((row, index) => {
        const item = transformToInventoryItem(row, index);
        if (item) transformedCount++;
        return item;
      })
      .filter(item => item !== null) as InventoryItem[];

    const itemsWithPositiveQuantity = allTransformedItems.filter(item => item.quantity > 0);
    
    console.log(`GS_Data: getInventoryItems - Transformed ${transformedCount} items total. Filtering from ${itemsWithPositiveQuantity.length} items with quantity > 0.`);

    const items = itemsWithPositiveQuantity.filter(item => {
      if (filters?.supplierName && item.supplierName?.toLowerCase() !== filters.supplierName.toLowerCase()) { return false; }
      if (filters?.staffName && item.staffName?.toLowerCase() !== filters.staffName.toLowerCase()) { return false; }
      return true;
    });

    items.sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp) : null;
      const dateB = b.timestamp ? parseISO(b.timestamp) : null;
      if (dateA && isValid(dateA) && dateB && isValid(dateB)) { return dateB.getTime() - dateA.getTime(); }
      if (dateA && isValid(dateA)) return -1;
      if (dateB && isValid(dateB)) return 1;
      return 0;
    });
    return items;
  } catch (error) {
    console.error(`GS_Data: Critical error in getInventoryItems:`, error);
    return [];
  }
}

export async function getUniqueStaffNames(): Promise<string[]> {
  const timeLabel = "GS_Data: getUniqueStaffNames total duration";
  console.time(timeLabel);
  try {
    const inventoryData = await readSheetData(INVENTORY_READ_RANGE);
    if (!inventoryData) {
      console.log("GS_Data: getUniqueStaffNames - No inventory data from readSheetData.");
      return [];
    }
    const staffNames = new Set<string>();
    inventoryData.forEach(row => {
      if (row && row.length > INV_COL_STAFF && row[INV_COL_STAFF]) {
        const name = String(row[INV_COL_STAFF]).trim();
        if (name) staffNames.add(name);
      }
    });
    const sortedNames = Array.from(staffNames).sort((a,b) => a.localeCompare(b));
    console.log(`GS_Data: getUniqueStaffNames - Found ${sortedNames.length} unique staff names.`);
    return sortedNames;
  } catch (error) {
    console.error("GS_Data: Error in getUniqueStaffNames:", error);
    return [];
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function getUniqueLocations(): Promise<string[]> {
  const timeLabel = "GS_Data: getUniqueLocations total duration";
  console.time(timeLabel);
  try {
    const inventoryData = await readSheetData(INVENTORY_READ_RANGE);
    if (!inventoryData) {
      console.log("GS_Data: getUniqueLocations - No inventory data from readSheetData.");
      console.timeEnd(timeLabel);
      return [];
    }
    const locations = new Set<string>();
    inventoryData.forEach(row => {
      if (row && row.length > INV_COL_LOCATION && row[INV_COL_LOCATION]) {
        const loc = String(row[INV_COL_LOCATION]).trim();
        if (loc) locations.add(loc);
      }
    });
    const sortedLocations = Array.from(locations).sort((a,b) => a.localeCompare(b));
    console.log(`GS_Data: getUniqueLocations - Found ${sortedLocations.length} unique locations.`);
    console.timeEnd(timeLabel);
    return sortedLocations;
  } catch (error) {
    console.error("GS_Data: Error in getUniqueLocations:", error);
    console.timeEnd(timeLabel);
    return [];
  }
}


export async function getReturnedItems(): Promise<ReturnedItem[]> {
  const timeLabel = "GS_Data: getReturnedItems total duration";
  console.time(timeLabel);
  try {
    const sheetData = await readSheetData(RETURN_LOG_READ_RANGE);
    if (!sheetData) {
      console.log("GS_Data: getReturnedItems - No sheet data from readSheetData.");
      return [];
    }
    const items = sheetData.map((row, index) => transformToReturnedItem(row, index)).filter(item => item !== null) as ReturnedItem[];
    items.sort((a,b) => {
        const dateA = a.returnTimestamp ? parseISO(a.returnTimestamp) : null;
        const dateB = b.returnTimestamp ? parseISO(b.returnTimestamp) : null;
        if (dateA && isValid(dateA) && dateB && isValid(dateB)) return dateB.getTime() - dateA.getTime();
        if (dateA && isValid(dateA)) return -1;
        if (dateB && isValid(dateB)) return 1;
        return 0;
    });
    console.log(`GS_Data: getReturnedItems - Transformed and sorted ${items.length} returned items.`);
    return items;
  } catch (error) {
    console.error("GS_Data: Critical error in getReturnedItems:", error);
    return [];
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function addProduct(userEmail: string, productData: { barcode: string; productName: string; supplierName: string; costPrice?: number }): Promise<Product | null> {
  const timeLabel = "GS_Data: addProduct total duration";
  console.time(timeLabel);
  try {
    const dbSheet = await readSheetData(DB_READ_RANGE);
    let productExists = false;
    if (dbSheet) {
      productExists = dbSheet.some(row => (String(row[DB_COL_BARCODE_A] || '').trim() === productData.barcode.trim()) || (String(row[DB_COL_BARCODE_B] || '').trim() === productData.barcode.trim()));
    }

    if (productExists) {
        console.warn(`GS_Data: addProduct - Product with barcode ${productData.barcode} already exists.`);
        return null; // Or handle as an update
    }

    // New row will have barcode in A, empty B, product name in C, supplier name in D, cost in E
    const newRow = [
      productData.barcode.trim(),
      '',
      productData.productName.trim(),
      productData.supplierName.trim(),
      productData.costPrice ?? ''
    ];
    
    if (!await appendSheetData(DB_APPEND_RANGE, [newRow])) {
      console.error("GS_Data: addProduct - Failed to append to DB sheet.");
      return null;
    }
    
    await logAuditEvent(userEmail, 'CREATE_PRODUCT', productData.barcode.trim(), `Created product "${productData.productName.trim()}"`);
    
    return {
      id: productData.barcode,
      barcode: productData.barcode.trim(),
      productName: productData.productName.trim(),
      supplierName: productData.supplierName.trim(),
      costPrice: productData.costPrice,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("GS_Data: Critical error in addProduct:", error);
    return null;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function addSupplier(userEmail: string, supplierData: { name: string }): Promise<{ supplier: Supplier | null; error?: string }> {
  const timeLabel = "GS_Data: addSupplier total duration";
  console.time(timeLabel);
  try {
    const dbSheet = await readSheetData(DB_READ_RANGE);
    const supplierNameLower = supplierData.name.trim().toLowerCase();
    if (dbSheet?.some(row => String(row[DB_COL_SUPPLIER_NAME] || '').trim().toLowerCase() === supplierNameLower)) {
      console.warn(`GS_Data: addSupplier - Attempted to add existing supplier: "${supplierData.name.trim()}"`);
      return { supplier: transformToSupplier(supplierData.name.trim(), 0), error: `Supplier "${supplierData.name.trim()}" already exists.` };
    }
    
    // To add a supplier, we add a new row to DB with a placeholder barcode/product name
    const placeholderBarcode = `SUPPLIER_ONLY_${Date.now()}`;
    const placeholderProduct = `[System Placeholder for Supplier: ${supplierData.name.trim()}]`;

    const newRow = [placeholderBarcode, '', placeholderProduct, supplierData.name.trim()];

    if (await appendSheetData(DB_APPEND_RANGE, [newRow])) {
      await logAuditEvent(userEmail, 'CREATE_SUPPLIER', supplierData.name.trim(), `Created supplier "${supplierData.name.trim()}"`);
      return { supplier: transformToSupplier(supplierData.name.trim(), dbSheet?.length || 0) };
    } else {
      console.error(`GS_Data: addSupplier - Failed to append new supplier "${supplierData.name.trim()}" to sheet.`);
      return { supplier: null, error: "Failed to add supplier to sheet." };
    }
  } catch (error) {
    console.error("GS_Data: Critical error in addSupplier:", error);
    return { supplier: null, error: `Failed to add supplier: ${error instanceof Error ? error.message : "Unknown error"}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function getProductDetailsByBarcode(barcode: string): Promise<Product | null> {
  const timeLabel = `GS_Data: getProductDetailsByBarcode for ${barcode} total duration`;
  console.time(timeLabel);
  try {
    const productsData = await readSheetData(DB_READ_RANGE);
    if (!productsData) {
      console.warn(`GS_Data: getProductDetailsByBarcode - No products data from DB sheet for barcode ${barcode}.`);
      return null;
    }
    const productRow = productsData.find(row => 
        String(row[DB_COL_BARCODE_A] || '').trim() === barcode.trim() || 
        String(row[DB_COL_BARCODE_B] || '').trim() === barcode.trim()
    );
    if (!productRow) {
      console.warn(`GS_Data: getProductDetailsByBarcode - Barcode ${barcode} not found in DB sheet.`);
      return null;
    }
    const productName = String(productRow[DB_COL_PRODUCT_NAME] || '').trim();
    const supplierName = String(productRow[DB_COL_SUPPLIER_NAME] || '').trim();
    const costPriceRaw = productRow[DB_COL_COST_PRICE];
    const costPrice = (costPriceRaw !== undefined && costPriceRaw !== null && String(costPriceRaw).trim() !== '')
      ? parseFloat(String(costPriceRaw).replace(/[^0-9.-]+/g,""))
      : undefined;

    return {
      id: barcode,
      productName: productName,
      barcode: barcode.trim(),
      supplierName: supplierName || undefined,
      costPrice: costPrice && !isNaN(costPrice) ? costPrice : undefined,
    };
  } catch (error) {
    console.error(`GS_Data: Critical error in getProductDetailsByBarcode for ${barcode}:`, error);
    return null;
  } finally {
    console.timeEnd(timeLabel);
  }
}

async function getNextInventoryRowNumber(): Promise<number> {
    const inventoryData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A:A`);
    // +2 because sheets are 1-indexed and we have a header row
    return (inventoryData?.length || 0) + 2; 
}

export async function addInventoryItem(
  userEmail: string,
  itemFormValues: AddInventoryItemFormValues,
  resolvedProductDetails: { productName: string; supplierName: string; }
): Promise<InventoryItem | null> {
  const timeLabel = "GS_Data: addInventoryItem total duration";
  console.time(timeLabel);
  try {
    const now = new Date();
    const nextRowNumber = await getNextInventoryRowNumber();
    const clientSideUniqueId = `${nextRowNumber}-${format(now, "yyyyMMddHHmmss")}`;

    const newRowData = new Array(INVENTORY_TOTAL_COLUMNS_FOR_WRITE).fill('');

    newRowData[INV_COL_TIMESTAMP] = format(now, "dd/MM/yyyy HH:mm:ss");
    newRowData[INV_COL_BARCODE] = itemFormValues.barcode.trim();
    newRowData[INV_COL_QTY] = itemFormValues.quantity;
    newRowData[INV_COL_EXPIRY] = itemFormValues.expiryDate ? format(new Date(itemFormValues.expiryDate), 'dd/MM/yyyy') : '';
    newRowData[INV_COL_LOCATION] = itemFormValues.location.trim();
    newRowData[INV_COL_STAFF] = itemFormValues.staffName.trim();
    newRowData[INV_COL_PRODUCT_NAME] = resolvedProductDetails.productName.trim();
    newRowData[INV_COL_SUPPLIER_NAME] = resolvedProductDetails.supplierName.trim();
    newRowData[INV_COL_TYPE] = itemFormValues.itemType;
    newRowData[INV_COL_UNIQUE_ID] = clientSideUniqueId;

    if (!await appendSheetData(INVENTORY_APPEND_RANGE, [newRowData])) {
      console.error("GS_Data: addInventoryItem - Failed to append data to sheet.");
      return null;
    }
    
    await logAuditEvent(userEmail, 'LOG_INVENTORY', clientSideUniqueId, `Logged ${itemFormValues.quantity} of "${resolvedProductDetails.productName.trim()}" (Barcode: ${itemFormValues.barcode.trim()}) to location ${itemFormValues.location.trim()}.`);
    
    const parsedTimestamp = dateParse(newRowData[INV_COL_TIMESTAMP] as string, "dd/MM/yyyy HH:mm:ss", new Date());
    return {
      id: clientSideUniqueId, productName: resolvedProductDetails.productName.trim(), barcode: itemFormValues.barcode.trim(),
      supplierName: resolvedProductDetails.supplierName.trim(), quantity: Number(itemFormValues.quantity),
      expiryDate: itemFormValues.expiryDate ? format(new Date(itemFormValues.expiryDate), 'yyyy-MM-dd') : undefined,
      location: itemFormValues.location.trim(), staffName: itemFormValues.staffName.trim(), itemType: itemFormValues.itemType,
      timestamp: isValid(parsedTimestamp) ? parsedTimestamp.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error("GS_Data: Critical error in addInventoryItem:", error);
    return null;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function processReturn(userEmail: string, itemId: string, quantityToReturn: number, staffNameProcessingReturn: string): Promise<{ success: boolean; message?: string }> {
  const timeLabel = `GS_Data: processReturn for item ${itemId} total duration`;
  console.time(timeLabel);
  try {
    if (!itemId) return { success: false, message: "Item ID is required."};
    if (quantityToReturn <= 0) { return { success: false, message: 'Return quantity must be positive.' }; }
    const rowNumber = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, itemId, INV_COL_UNIQUE_ID);
    if (!rowNumber) {
      console.warn(`GS_Data: processReturn - Item ID ${itemId} not found in sheet (Col J).`);
      return { success: false, message: `Item ID ${itemId} not found in sheet (Col J).` };
    }
    const itemRowData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${rowNumber}:${String.fromCharCode('A'.charCodeAt(0) + INVENTORY_TOTAL_COLUMNS_FOR_WRITE - 1)}${rowNumber}`);
    if (!itemRowData || !itemRowData[0]) {
      console.warn(`GS_Data: processReturn - Could not read item ${itemId} at row ${rowNumber}.`);
      return { success: false, message: `Could not read item ${itemId}.` };
    }
    const currentItem = transformToInventoryItem(itemRowData[0], rowNumber - 2);
    if (!currentItem) {
      console.warn(`GS_Data: processReturn - Could not parse item ${itemId} from row data.`);
      return { success: false, message: `Could not parse item ${itemId}.` };
    }
    if (currentItem.quantity <= 0) {
      return { success: false, message: `Item ${currentItem.productName} has 0 quantity.` };
    }
    const actualReturnedQty = Math.min(quantityToReturn, currentItem.quantity);
    let operationSuccessful: boolean;
    let resultMessage: string;
    if (actualReturnedQty >= currentItem.quantity) {
      operationSuccessful = await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, rowNumber);
      resultMessage = operationSuccessful ? `Item ${currentItem.productName} (all ${currentItem.quantity}) fully returned.` : `Failed to delete item ${itemId}.`;
    } else {
      const newQuantity = currentItem.quantity - actualReturnedQty;
      const qtyCell = `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_QTY)}${rowNumber}`;
      operationSuccessful = await updateSheetData(qtyCell, [[newQuantity]]);
      resultMessage = operationSuccessful ? `Returned ${actualReturnedQty} of ${currentItem.productName}. New quantity: ${newQuantity}.` : `Failed to update quantity for ${itemId}.`;
    }
    if (operationSuccessful) {
      await logAuditEvent(userEmail, 'PROCESS_RETURN', itemId, `Returned ${actualReturnedQty} of "${currentItem.productName}". Processed by ${staffNameProcessingReturn}.`);
      const logEntry = [
        itemId,
        currentItem.productName,
        currentItem.barcode,
        currentItem.supplierName || '',
        actualReturnedQty,
        currentItem.expiryDate || '',
        currentItem.location,
        currentItem.staffName,
        currentItem.itemType,
        staffNameProcessingReturn.trim(),
        format(new Date(), "dd/MM/yyyy HH:mm:ss")
      ];
      if (!await appendSheetData(RETURN_LOG_APPEND_RANGE, [logEntry])) {
        resultMessage += ` WARNING: Failed to log return.`;
      } else {
        resultMessage += " Return logged.";
      }
    }
    return { success: operationSuccessful, message: resultMessage };
  } catch (error) {
    console.error(`GS_Data: Critical error in processReturn for ${itemId}:`, error);
    return { success: false, message: `Failed to process return: ${error instanceof Error ? error.message : "Unknown error"}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function updateSupplierNameAndReferences(userEmail: string, currentName: string, newName: string): Promise<boolean> {
  const timeLabel = "GS_Data: updateSupplierNameAndReferences total duration";
  console.time(timeLabel);
  try {
    const batchUpdates: { range: string; values: any[][] }[] = [];

    // Part 1: Update DB sheet
    const dbSheetData = await readSheetData(DB_READ_RANGE);
    if (!dbSheetData) {
      console.error("GS_Data: updateSupplierName - Failed to read DB sheet.");
      return false;
    }
    
    let dbRowsUpdated = 0;
    dbSheetData.forEach((row, index) => {
      if (row.length > DB_COL_SUPPLIER_NAME) {
        const existingName = String(row[DB_COL_SUPPLIER_NAME] || '').trim();
        if (existingName.toLowerCase() === currentName.toLowerCase()) {
          const cell = `${DB_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + DB_COL_SUPPLIER_NAME)}${index + 1}`; // +1 because no header
          batchUpdates.push({ range: cell, values: [[newName.trim()]] });
          dbRowsUpdated++;
        }
      }
    });

    if (dbRowsUpdated === 0) {
      console.warn(`GS_Data: updateSupplierName - No supplier found with name "${currentName}" in DB sheet to update.`);
    }
    
    // Part 2: Update denormalized names in Form Responses sheet
    const inventorySheetData = await readSheetData(INVENTORY_READ_RANGE);
    let invDataRowsUpdated = 0;
    if (inventorySheetData) {
        inventorySheetData.forEach((row, index) => {
            if (row.length > INV_COL_SUPPLIER_NAME) {
                const existingName = String(row[INV_COL_SUPPLIER_NAME] || '').trim();
                if (existingName.toLowerCase() === currentName.toLowerCase()) {
                    const cell = `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_SUPPLIER_NAME)}${index + 2}`;
                    batchUpdates.push({ range: cell, values: [[newName.trim()]] });
                    invDataRowsUpdated++;
                }
            }
        });
    } else {
        console.warn("GS_Data: updateSupplierName - Could not read inventory data. Skipping update of denormalized supplier names.");
    }

    // Part 3: Update denormalized names in Returns Log sheet
    const returnsLogSheetData = await readSheetData(RETURN_LOG_READ_RANGE);
    let returnsLogRowsUpdated = 0;
    if (returnsLogSheetData) {
        returnsLogSheetData.forEach((row, index) => {
            if (row.length > RL_COL_SUPPLIER_NAME) {
                const existingName = String(row[RL_COL_SUPPLIER_NAME] || '').trim();
                if (existingName.toLowerCase() === currentName.toLowerCase()) {
                    const cell = `${RETURNS_LOG_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + RL_COL_SUPPLIER_NAME)}${index + 2}`;
                    batchUpdates.push({ range: cell, values: [[newName.trim()]] });
                    returnsLogRowsUpdated++;
                }
            }
        });
    } else {
        console.warn("GS_Data: updateSupplierName - Could not read returns log data. Skipping update of denormalized supplier names in returns log.");
    }
    
    // Execute Batch Update
    if (batchUpdates.length === 0) {
      console.warn(`GS_Data: updateSupplierName - No supplier found with name "${currentName}" anywhere. No update performed.`);
      return false;
    }
    
    const success = await batchUpdateSheetCells(batchUpdates);
    if(success) {
        await logAuditEvent(userEmail, 'UPDATE_SUPPLIER', currentName, `Renamed supplier to "${newName.trim()}"`);
    }
    console.log(`GS_Data: updateSupplierName - Batch update for "${currentName}" to "${newName}" ${success ? 'succeeded' : 'failed'}. Updates: ${dbRowsUpdated} in DB, ${invDataRowsUpdated} in Inventory Log, ${returnsLogRowsUpdated} in Returns Log.`);
    return success;
  } catch (error) {
    console.error("GS_Data: Critical error in updateSupplierNameAndReferences:", error);
    return false;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function updateInventoryItemDetails(
  userEmail: string,
  itemId: string,
  updates: { location?: string; expiryDate?: string | null; itemType?: ItemType, quantity?: number }
): Promise<InventoryItem | null> {
  const timeLabel = `GS_Data: updateInventoryItemDetails for item ${itemId} total duration`;
  console.time(timeLabel);
  try {
    const rowNumber = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, itemId, INV_COL_UNIQUE_ID);
    if (!rowNumber) {
      console.warn(`GS_Data: updateInventoryItemDetails - Item ID ${itemId} not found.`);
      return null;
    }

    const itemRowData = await readSheetData(`${FORM_RESPONSES_SHEET_NAME}!A${rowNumber}:${String.fromCharCode('A'.charCodeAt(0) + INVENTORY_TOTAL_COLUMNS_FOR_WRITE - 1)}${rowNumber}`);
    if (!itemRowData || itemRowData.length === 0) {
      console.error(`GS_Data: Could not read row ${rowNumber} for item ${itemId} to construct return object.`);
      return null;
    }
    
    const originalItem = transformToInventoryItem(itemRowData[0], rowNumber - 2);
    if (!originalItem) {
      console.error(`GS_Data: Could not parse original item ${itemId} from sheet row data.`);
      return null;
    }

    const cellUpdates: { range: string; values: any[][] }[] = [];
    const changesForLog: string[] = [];

    // Compare and build updates & log messages
    if (updates.location !== undefined && updates.location !== originalItem.location) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_LOCATION)}${rowNumber}`, values: [[updates.location]] });
      changesForLog.push(`location: from "${originalItem.location}" to "${updates.location}"`);
    }
    if (updates.quantity !== undefined && updates.quantity !== originalItem.quantity) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_QTY)}${rowNumber}`, values: [[updates.quantity]] });
      changesForLog.push(`quantity: from ${originalItem.quantity} to ${updates.quantity}`);
    }
    if (updates.itemType !== undefined && updates.itemType !== originalItem.itemType) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_TYPE)}${rowNumber}`, values: [[updates.itemType]] });
      changesForLog.push(`itemType: from "${originalItem.itemType}" to "${updates.itemType}"`);
    }

    // Special handling for expiry date comparison
    const originalExpiry = originalItem.expiryDate || null; // Normalize undefined to null
    if (updates.expiryDate !== undefined && updates.expiryDate !== originalExpiry) {
      let expiryValueForSheet = '';
      if (updates.expiryDate) {
        const parsedForSheet = parseISO(updates.expiryDate);
        if (isValid(parsedForSheet)) {
          expiryValueForSheet = format(parsedForSheet, 'dd/MM/yyyy');
        } else {
          console.warn(`GS_Data: updateInventoryItemDetails - Invalid expiry date string received: ${updates.expiryDate}. Writing empty string.`);
        }
      }
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_EXPIRY)}${rowNumber}`, values: [[expiryValueForSheet]] });
      changesForLog.push(`expiryDate: from "${originalExpiry || 'none'}" to "${updates.expiryDate || 'none'}"`);
    }

    if (cellUpdates.length === 0) {
      console.log(`GS_Data: updateInventoryItemDetails - No actual changes to update for item ${itemId}.`);
      return originalItem;
    }

    const success = await batchUpdateSheetCells(cellUpdates);
    console.log(`GS_Data: updateInventoryItemDetails - Batch update for item ${itemId} ${success ? 'succeeded' : 'failed'}.`);
    
    if (success) {
        const changesSummary = changesForLog.join('; ');
        await logAuditEvent(userEmail, 'UPDATE_INVENTORY_ITEM', itemId, `Updated item details: ${changesSummary}`);
        
        // Construct the updated item object locally to return it without another read
        const updatedItem = { ...originalItem };
        if (updates.location !== undefined) updatedItem.location = updates.location;
        if (updates.quantity !== undefined) updatedItem.quantity = updates.quantity;
        if (updates.itemType !== undefined) updatedItem.itemType = updates.itemType;
        if (updates.expiryDate !== undefined) updatedItem.expiryDate = updates.expiryDate || undefined;
        return updatedItem;
    }

    return null;
  } catch (error) {
    console.error(`GS_Data: Critical error in updateInventoryItemDetails for ${itemId}:`, error);
    return null;
  } finally {
    console.timeEnd(timeLabel);
  }
}

async function findProductRowByBarcode(barcode: string): Promise<number | null> {
    const searchRange = `${DB_SHEET_NAME}!A1:B`; // Read first two columns
    const barcodeData = await readSheetData(searchRange);

    if (!barcodeData) {
        console.warn(`findProductRowByBarcode: Could not read barcode columns from ${DB_SHEET_NAME}.`);
        return null;
    }
    const trimmedBarcode = barcode.trim();
    for (let i = 0; i < barcodeData.length; i++) {
        const row = barcodeData[i];
        const barcodeA = String(row[DB_COL_BARCODE_A] || '').trim();
        const barcodeB = String(row[DB_COL_BARCODE_B] || '').trim();
        if (barcodeA === trimmedBarcode || barcodeB === trimmedBarcode) {
            return i + 1; // Return 1-based row number
        }
    }
    return null;
}

export async function updateProductAndSupplierLinks(userEmail: string, barcode: string, newProductName: string, newSupplierName: string, newCostPrice?: number): Promise<boolean> {
  const timeLabel = `GS_Data: updateProductAndSupplierLinks for barcode ${barcode}`;
  console.time(timeLabel);
  try {
      const rowNumber = await findProductRowByBarcode(barcode);
      if (!rowNumber) {
          console.error(`GS_Data: updateProductAndSupplierLinks - Barcode ${barcode} not found in DB sheet. Cannot update.`);
          return false;
      }

      const batchUpdates: { range: string; values: any[][] }[] = [];

      batchUpdates.push({
          range: `${DB_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + DB_COL_PRODUCT_NAME)}${rowNumber}`,
          values: [[newProductName.trim()]]
      });
      batchUpdates.push({
          range: `${DB_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + DB_COL_SUPPLIER_NAME)}${rowNumber}`,
          values: [[newSupplierName.trim()]]
      });
      if (newCostPrice !== undefined) {
        batchUpdates.push({
            range: `${DB_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + DB_COL_COST_PRICE)}${rowNumber}`,
            values: [[newCostPrice]]
        });
      }
      
      if (batchUpdates.length === 0) {
          console.log("GS_Data: updateProductAndSupplierLinks - No changes to apply.");
          return true;
      }

      const allSuccessful = await batchUpdateSheetCells(batchUpdates);
      if(allSuccessful) {
        await logAuditEvent(userEmail, 'UPDATE_PRODUCT', barcode, `Updated product details. Name: "${newProductName}", Supplier: "${newSupplierName}", Cost: ${newCostPrice ?? 'N/A'}`);
      }
      console.log(`GS_Data: updateProductAndSupplierLinks - Processed updates for barcode ${barcode}. Success: ${allSuccessful}`);
      return allSuccessful;

  } catch (error) {
      console.error(`GS_Data: Critical error in updateProductAndSupplierLinks for barcode ${barcode}:`, error);
      return false;
  } finally {
      console.timeEnd(timeLabel);
  }
}

export async function getInventoryLogEntriesByBarcode(barcode: string): Promise<InventoryItem[]> {
  const timeLabel = `GS_Data: getInventoryLogEntriesByBarcode for ${barcode} duration`;
  console.time(timeLabel);
  try {
    const sheetData = await readSheetData(INVENTORY_READ_RANGE);
    if (!sheetData) {
      console.log(`GS_Data: getInventoryLogEntriesByBarcode - No sheet data for barcode ${barcode}.`);
      return [];
    }

    const items = sheetData
      .map((row, index) => {
        if (String(row[INV_COL_BARCODE] || '').trim() === barcode.trim()) {
          return transformToInventoryItem(row, index);
        }
        return null;
      })
      .filter(item => item !== null) as InventoryItem[];

    items.sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp) : null;
      const dateB = b.timestamp ? parseISO(b.timestamp) : null;
      if (dateA && isValid(dateA) && dateB && isValid(dateB)) { return dateB.getTime() - dateA.getTime(); }
      if (dateA && isValid(dateA)) return -1;
      if (dateB && isValid(dateB)) return 1;
      return 0;
    });

    console.log(`GS_Data: getInventoryLogEntriesByBarcode - Found ${items.length} log entries for barcode ${barcode}.`);
    return items;
  } catch (error) {
    console.error(`GS_Data: Critical error in getInventoryLogEntriesByBarcode for ${barcode}:`, error);
    return [];
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const timeLabel = "GS_Data: getDashboardMetrics total duration";
    console.time(timeLabel);
    try {
        const [inventoryLog, returnedLog, products, suppliersList] = await Promise.all([
            readSheetData(INVENTORY_READ_RANGE),
            readSheetData(RETURN_LOG_READ_RANGE),
            getProducts(),
            getSuppliers(),
        ]);

        const allInventoryEvents = (inventoryLog || []).map((row, index) => transformToInventoryItem(row, index)).filter(Boolean) as InventoryItem[];
        const currentInventoryItems = allInventoryEvents.filter(item => item.quantity > 0);

        const productsByBarcode = new Map(products.map(p => [p.barcode, p]));
        const totalStockValue = currentInventoryItems.reduce((sum, item) => {
            const product = productsByBarcode.get(item.barcode);
            const itemCost = product?.costPrice ?? 0;
            return sum + (item.quantity * itemCost);
        }, 0);


        const totalProducts = products.length;
        const totalStockQuantity = currentInventoryItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalSuppliers = suppliersList.length;

        let itemsExpiringSoon = 0;
        const today = startOfDay(new Date());
        const sevenDaysFromNow = addDays(today, 7);
        currentInventoryItems.forEach(item => {
            if (item.itemType === 'Expiry' && item.expiryDate) {
                try {
                    const expiry = startOfDay(parseISO(item.expiryDate));
                    if (isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, today)) {
                        itemsExpiringSoon++;
                    }
                } catch (e) {
                    console.warn(`GS_Data: getDashboardMetrics - Could not parse expiry date '${item.expiryDate}' for item ID ${item.id}`);
                }
            }
        });
        
        const damagedItemsCount = currentInventoryItems.filter(item => item.itemType === 'Damage').length;

        const stockBySupplierMap = new Map<string, number>();
        currentInventoryItems.forEach(item => {
            const supplier = item.supplierName || "Unknown Supplier";
            stockBySupplierMap.set(supplier, (stockBySupplierMap.get(supplier) || 0) + item.quantity);
        });

        const stockBySupplier: StockBySupplier[] = Array.from(stockBySupplierMap.entries())
            .map(([name, totalStock]) => ({ name, totalStock }))
            .sort((a, b) => b.totalStock - a.totalStock);

        const allReturnedItems = (returnedLog || []).map((row, index) => transformToReturnedItem(row, index)).filter(Boolean) as ReturnedItem[];
        
        const endOfYesterday = endOfDay(subDays(today, 1));
        const stockAtEndOfYesterday = allInventoryEvents.reduce((acc, item) => {
            if (item.timestamp && parseISO(item.timestamp) <= endOfYesterday) {
                acc[item.id] = (acc[item.id] || 0) + item.quantity;
            }
            return acc;
        }, {} as Record<string, number>);

        allReturnedItems.forEach(ret => {
            if (ret.originalInventoryItemId && ret.returnTimestamp && parseISO(ret.returnTimestamp) <= endOfYesterday) {
                if (stockAtEndOfYesterday[ret.originalInventoryItemId]) {
                    stockAtEndOfYesterday[ret.originalInventoryItemId] -= ret.returnedQuantity;
                }
            }
        });
        const totalStockYesterday = Object.values(stockAtEndOfYesterday).reduce((sum, qty) => sum + qty, 0);

        const netItemsAddedToday = totalStockQuantity - totalStockYesterday;
        let dailyStockChangePercent: number | undefined = undefined;
        if (totalStockYesterday > 0) {
            dailyStockChangePercent = (netItemsAddedToday / totalStockYesterday) * 100;
        }

        const metrics: DashboardMetrics = {
            totalProducts,
            totalStockQuantity,
            itemsExpiringSoon,
            damagedItemsCount,
            stockBySupplier,
            totalSuppliers,
            totalStockValue,
            dailyStockChangePercent: dailyStockChangePercent,
            dailyStockChangeDirection: netItemsAddedToday > 0 ? 'increase' : (netItemsAddedToday < 0 ? 'decrease' : 'none'),
            netItemsAddedToday: netItemsAddedToday
        };

        return metrics;

    } catch (error) {
        console.error("GS_Data: Critical error in getDashboardMetrics:", error);
        return {
            totalProducts: 0,
            totalStockQuantity: 0,
            itemsExpiringSoon: 0,
            damagedItemsCount: 0,
            stockBySupplier: [],
            totalSuppliers: 0,
            totalStockValue: 0,
        };
    } finally {
        console.timeEnd(timeLabel);
    }
}



export async function deleteInventoryItemById(userEmail: string, itemId: string): Promise<boolean> {
  const timeLabel = `GS_Data: deleteInventoryItemById for item ${itemId} total duration`;
  console.time(timeLabel);
  try {
    if (!itemId) {
      console.warn("GS_Data: deleteInventoryItemById - Item ID is required.");
      return false;
    }
    const rowNumber = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, itemId, INV_COL_UNIQUE_ID);
    if (!rowNumber) {
      console.warn(`GS_Data: deleteInventoryItemById - Item ID ${itemId} not found in sheet (Col J).`);
      return false; // Or throw an error to be caught by the action
    }
    
    const success = await deleteSheetRow(FORM_RESPONSES_SHEET_NAME, rowNumber);
    if (success) {
      await logAuditEvent(userEmail, 'DELETE_INVENTORY_ITEM', itemId, `Permanently deleted inventory log entry.`);
      console.log(`GS_Data: deleteInventoryItemById - Successfully deleted row ${rowNumber} for item ID ${itemId}.`);
    } else {
      console.error(`GS_Data: deleteInventoryItemById - Failed to delete row ${rowNumber} for item ID ${itemId}.`);
    }
    return success;
  } catch (error) {
    console.error(`GS_Data: Critical error in deleteInventoryItemById for ${itemId}:`, error);
    return false;
  } finally {
    console.timeEnd(timeLabel);
  }
}

// --- New Functions for Centralized Permissions ---

const PERMISSIONS_KEY = 'accessPermissions';

export async function loadPermissionsFromSheet(): Promise<Permissions | null> {
    try {
        const settingsData = await readSheetData(APP_SETTINGS_READ_RANGE);
        if (!settingsData) {
            console.warn("GS_Data: loadPermissionsFromSheet - Could not read from APP_SETTINGS sheet. It might not exist yet.");
            return null;
        }

        const permissionsRow = settingsData.find(row => row[SETTINGS_COL_KEY] === PERMISSIONS_KEY);
        if (permissionsRow && permissionsRow[SETTINGS_COL_VALUE]) {
            try {
                const permissionsJson = permissionsRow[SETTINGS_COL_VALUE];
                const permissions = JSON.parse(permissionsJson);
                if (permissions.admin && permissions.viewer) {
                    console.log("GS_Data: loadPermissionsFromSheet - Successfully loaded and parsed permissions from sheet.");
                    return permissions;
                }
            } catch (e) {
                console.error("GS_Data: loadPermissionsFromSheet - Failed to parse permissions JSON from sheet.", e);
                return null;
            }
        }
        console.log("GS_Data: loadPermissionsFromSheet - No permissions entry found in APP_SETTINGS sheet.");
        return null;
    } catch (error) {
        console.error("GS_Data: Critical error in loadPermissionsFromSheet:", error);
        return null;
    }
}

export async function savePermissionsToSheet(permissions: Permissions): Promise<boolean> {
    const timeLabel = "GS_Data: savePermissionsToSheet total duration";
    console.time(timeLabel);
    try {
        const permissionsJson = JSON.stringify(permissions);
        const settingsData = await readSheetData(APP_SETTINGS_READ_RANGE);

        let rowNumberToUpdate: number | null = null;
        if (settingsData) {
            const rowIndex = settingsData.findIndex(row => row[SETTINGS_COL_KEY] === PERMISSIONS_KEY);
            if (rowIndex !== -1) {
                rowNumberToUpdate = rowIndex + 2; // +2 because read range starts at A2
            }
        }
        
        if (rowNumberToUpdate) {
            const range = `${APP_SETTINGS_SHEET_NAME}!B${rowNumberToUpdate}`;
            console.log(`GS_Data: savePermissionsToSheet - Updating permissions at range: ${range}`);
            return await updateSheetData(range, [[permissionsJson]]);
        } else {
            console.log("GS_Data: savePermissionsToSheet - No existing permissions found, appending new row.");
            return await appendSheetData(APP_SETTINGS_APPEND_RANGE, [[PERMISSIONS_KEY, permissionsJson]]);
        }
    } catch (error) {
        console.error("GS_Data: Critical error in savePermissionsToSheet:", error);
        return false;
    } finally {
        console.timeEnd(timeLabel);
    }
}

// --- New Functions for Audit Log ---

/**
 * This helper function transforms a row from the 'Audit Log' sheet into a structured AuditLogEntry object.
 * It's designed to be robust against common sheet data issues like missing values.
 */
function transformToAuditLogEntry(row: any[], rowIndex: number): AuditLogEntry | null {
  const sheetRowNumber = rowIndex + 2; // Assuming data starts at row 2
  try {
    if (!row || row.length < 5) return null;
    
    const timestampValue = row[AUDIT_COL_TIMESTAMP];
    // Use the robust flexible parser. If it fails, fallback to now, but log it.
    const timestamp = parseFlexibleTimestamp(timestampValue)?.toISOString() || new Date().toISOString();
    if (!parseFlexibleTimestamp(timestampValue)) {
        console.warn(`GS_Data: Could not parse timestamp "${timestampValue}" on row ${sheetRowNumber} of Audit Log. Using current time as fallback.`);
    }

    const entry: AuditLogEntry = {
      id: `audit_${sheetRowNumber}_${timestamp}`,
      timestamp: timestamp,
      user: String(row[AUDIT_COL_USER] || 'Unknown'),
      action: String(row[AUDIT_COL_ACTION] || 'UNKNOWN_ACTION'),
      target: String(row[AUDIT_COL_TARGET] || 'N/A'),
      details: String(row[AUDIT_COL_DETAILS] || ''),
    };
    return entry;
  } catch (error) {
    console.error(`GS_Data: Error transforming audit log row ${sheetRowNumber}:`, error, "Row data:", row);
    return null;
  }
}

/**
 * This function appends a new event to the 'Audit Log' sheet.
 * It now writes timestamps in an unambiguous "yyyy-MM-dd HH:mm:ss" format.
 */
export async function logAuditEvent(user: string, action: string, target: string, details: string): Promise<boolean> {
  try {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss"); // Use unambiguous format
    const newRow = [timestamp, user, action, target, details];
    if (!await appendSheetData(AUDIT_LOG_APPEND_RANGE, [newRow])) {
      console.error("GS_Data: logAuditEvent - Failed to append event to sheet.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("GS_Data: Critical error in logAuditEvent:", error);
    return false;
  }
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const sheetData = await readSheetData(AUDIT_LOG_READ_RANGE);
    if (!sheetData) return [];

    const logs = sheetData.map(transformToAuditLogEntry).filter(Boolean) as AuditLogEntry[];
    // Sort logs by timestamp descending (most recent first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs;
  } catch (error) {
    console.error("GS_Data: Critical error in getAuditLogs:", error);
    return [];
  }
}
    

    













