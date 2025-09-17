

import type { Product, Supplier, InventoryItem, ReturnedItem, AddInventoryItemFormValues, EditInventoryItemFormValues, ItemType, DashboardMetrics, StockBySupplier, Permissions } from '@/lib/types';
import { readSheetData, appendSheetData, updateSheetData, findRowByUniqueValue, deleteSheetRow, batchUpdateSheetCells } from './google-sheets-client';
import { format, parseISO, isValid, parse as dateParse, addDays, isBefore, startOfDay, isSameDay, endOfDay } from 'date-fns';

// --- Sheet Names (MUST MATCH YOUR ACTUAL SHEET NAMES) ---
const FORM_RESPONSES_SHEET_NAME = "Form responses 2";
const BAR_DATA_SHEET_NAME = "BAR DATA";
const SUP_DATA_SHEET_NAME = "SUP DATA";
const RETURNS_LOG_SHEET_NAME = "Returns Log";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS"; // New sheet for settings

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


// "BAR DATA" - Product Catalog
const BAR_COL_BARCODE_PROD = 0;      // A - Barcode
const BAR_COL_PRODUCT_NAME_PROD = 1; // B - Product Name

// "SUP DATA" - Supplier Information (Links Product Name to Supplier Name)
const SUP_COL_PRODUCT_NAME_LINK = 0; // A - Product Name used to link to supplier
const SUP_COL_SUPPLIER_NAME_LINK = 1;  // B - Actual Supplier Name

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


// --- Read Ranges ---
const PRODUCTS_READ_RANGE = `${BAR_DATA_SHEET_NAME}!A2:B`;
const SUPPLIERS_READ_RANGE = `${SUP_DATA_SHEET_NAME}!A2:B`;
const INVENTORY_READ_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A2:J`;
const RETURN_LOG_READ_RANGE = `${RETURNS_LOG_SHEET_NAME}!A2:K`;
const APP_SETTINGS_READ_RANGE = `${APP_SETTINGS_SHEET_NAME}!A2:B`;

// --- Append Ranges (for adding new rows) ---
const PRODUCTS_APPEND_RANGE = `${BAR_DATA_SHEET_NAME}!A:B`;
const SUPPLIERS_APPEND_RANGE = `${SUP_DATA_SHEET_NAME}!A:B`;
const INVENTORY_APPEND_RANGE = `${FORM_RESPONSES_SHEET_NAME}!A:J`;
const RETURN_LOG_APPEND_RANGE = `${RETURNS_LOG_SHEET_NAME}!A:K`;
const APP_SETTINGS_APPEND_RANGE = `${APP_SETTINGS_SHEET_NAME}!A:B`;


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
    const formatsToTry: string[] = [
      "dd/MM/yyyy HH:mm:ss", "d/M/yyyy HH:mm:ss",
      "dd/MM/yyyy H:mm:ss", "d/M/yyyy H:mm:ss",
      "dd/MM/yyyy HH:mm", "d/M/yyyy HH:mm",
      "dd/MM/yyyy H:mm", "d/M/yyyy H:mm",
      "M/d/yyyy HH:mm:ss", "MM/dd/yyyy HH:mm:ss",
      "M/d/yyyy H:mm:ss", "MM/dd/yyyy H:mm:ss",
      "M/d/yyyy H:mm", "MM/dd/yyyy H:mm",
      "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'",
      "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy", // Date only formats
      "yyyy-MM-dd"
    ];
    for (const fmt of formatsToTry) {
      const d = dateParse(trimmedTimestampValue, fmt, new Date());
      if (isValid(d)) return d;
    }
    const isoDate = parseISO(trimmedTimestampValue);
    if (isValid(isoDate)) return isoDate;
  }
  return null;
}


function transformToProduct(row: any[], rowIndex: number): Product | null {
  const sheetRowNumber = rowIndex + 2;
  try {
    if (!row || row.length < 2) { return null; }
    const barcode = String(row[BAR_COL_BARCODE_PROD] || '').trim();
    const productName = String(row[BAR_COL_PRODUCT_NAME_PROD] || '').trim();
    if (!barcode || !productName) { return null; }
    return { id: barcode, barcode: barcode, productName: productName };
  } catch (error) {
    console.error(`GS_Data: Error transforming product row ${sheetRowNumber} from "${BAR_DATA_SHEET_NAME}":`, error, "Row data:", row);
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
    const productName = String(row[INV_COL_PRODUCT_NAME] || '').trim();
    const quantityStr = String(row[INV_COL_QTY] || '0').trim();
    const quantity = parseInt(quantityStr, 10);

    if (!barcode || !productName || isNaN(quantity)) {
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
    const [productSheetData, supSheetData] = await Promise.all([
      readSheetData(PRODUCTS_READ_RANGE),
      readSheetData(SUPPLIERS_READ_RANGE)
    ]);

    if (!productSheetData) {
      console.log("GS_Data: getProducts - No product data returned from BAR DATA sheet.");
      return [];
    }

    const supplierMap = new Map<string, string>();
    if (supSheetData) {
      supSheetData.forEach(row => {
        if (row && row.length > SUP_COL_SUPPLIER_NAME_LINK && row[SUP_COL_PRODUCT_NAME_LINK] && row[SUP_COL_SUPPLIER_NAME_LINK]) {
          const productName = String(row[SUP_COL_PRODUCT_NAME_LINK]).trim().toLowerCase();
          const supplierName = String(row[SUP_COL_SUPPLIER_NAME_LINK]).trim();
          if (productName && supplierName && !supplierMap.has(productName)) { // Avoid overwriting with older entries if duplicates exist
            supplierMap.set(productName, supplierName);
          }
        }
      });
    }

    const products = productSheetData.map((row, index) => {
        const product = transformToProduct(row, index);
        if (product) {
          const supplierName = supplierMap.get(product.productName.toLowerCase());
          if (supplierName) {
            product.supplierName = supplierName;
          }
        }
        return product;
    }).filter(p => p !== null) as Product[];
    
    console.log(`GS_Data: getProducts - Transformed ${products.length} products and enriched with supplier data.`);
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
    const sheetData = await readSheetData(SUPPLIERS_READ_RANGE);
    if (!sheetData) {
      console.log("GS_Data: getSuppliers - No sheet data returned from readSheetData.");
      return [];
    }
    const supplierNames = new Set<string>();
    sheetData.forEach(row => {
      if (row && row.length > SUP_COL_SUPPLIER_NAME_LINK && row[SUP_COL_SUPPLIER_NAME_LINK]) {
        const name = String(row[SUP_COL_SUPPLIER_NAME_LINK]).trim();
        if (name) supplierNames.add(name);
      }
    });
    const suppliers = Array.from(supplierNames).map((name, index) => transformToSupplier(name, index));
    console.log(`GS_Data: getSuppliers - Found ${suppliers.length} unique suppliers.`);
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

export async function addProduct(productData: { barcode: string; productName: string; supplierName: string }): Promise<Product | null> {
  const timeLabel = "GS_Data: addProduct total duration";
  console.time(timeLabel);
  try {
    const barDataSheet = await readSheetData(PRODUCTS_READ_RANGE);
    let productExistsInBarData = false;
    if (barDataSheet) {
      productExistsInBarData = barDataSheet.some(row => String(row[BAR_COL_BARCODE_PROD] || '').trim() === productData.barcode.trim());
    }
    if (!productExistsInBarData) {
      const barDataRow = [productData.barcode.trim(), productData.productName.trim()];
      if (!await appendSheetData(PRODUCTS_APPEND_RANGE, [barDataRow])) {
        console.error("GS_Data: addProduct - Failed to append to BAR DATA sheet.");
        return null;
      }
      console.log("GS_Data: addProduct - Added to BAR DATA sheet.");
    } else {
       console.log("GS_Data: addProduct - Product already exists in BAR DATA sheet.");
    }
    const supDataSheet = await readSheetData(SUPPLIERS_READ_RANGE);
    let linkExistsInSupData = false;
    if (supDataSheet) {
      linkExistsInSupData = supDataSheet.some(row =>
        String(row[SUP_COL_PRODUCT_NAME_LINK] || '').trim().toLowerCase() === productData.productName.trim().toLowerCase() &&
        String(row[SUP_COL_SUPPLIER_NAME_LINK] || '').trim().toLowerCase() === productData.supplierName.trim().toLowerCase()
      );
    }
    if (!linkExistsInSupData) {
      const supDataRow = [productData.productName.trim(), productData.supplierName.trim()];
      if(!await appendSheetData(SUPPLIERS_APPEND_RANGE, [supDataRow])) {
         console.warn("GS_Data: addProduct - Failed to append to SUP DATA sheet, but product might have been added to BAR DATA.");
      } else {
        console.log("GS_Data: addProduct - Added to SUP DATA sheet.");
      }
    } else {
       console.log("GS_Data: addProduct - Product-Supplier link already exists in SUP DATA sheet.");
    }
    return {
      id: productData.barcode, barcode: productData.barcode.trim(), productName: productData.productName.trim(),
      supplierName: productData.supplierName.trim(), createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("GS_Data: Critical error in addProduct:", error);
    return null;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function addSupplier(supplierData: { name: string }): Promise<{ supplier: Supplier | null; error?: string }> {
  const timeLabel = "GS_Data: addSupplier total duration";
  console.time(timeLabel);
  try {
    const supDataSheet = await readSheetData(SUPPLIERS_READ_RANGE);
    const supplierNameLower = supplierData.name.trim().toLowerCase();
    if (supDataSheet?.some(row => String(row[SUP_COL_SUPPLIER_NAME_LINK] || '').trim().toLowerCase() === supplierNameLower)) {
      console.warn(`GS_Data: addSupplier - Attempted to add existing supplier: "${supplierData.name.trim()}"`);
      return { supplier: transformToSupplier(supplierData.name.trim(), 0), error: `Supplier "${supplierData.name.trim()}" already exists.` };
    }
    const placeholderProduct = `[System_Placeholder_For_Supplier_${supplierData.name.trim().replace(/\s+/g, '_')}]`;
    const supDataRow = [placeholderProduct, supplierData.name.trim()];
    if (await appendSheetData(SUPPLIERS_APPEND_RANGE, [supDataRow])) {
      console.log(`GS_Data: addSupplier - Successfully added supplier: "${supplierData.name.trim()}"`);
      return { supplier: transformToSupplier(supplierData.name.trim(), supDataSheet?.length || 0) };
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
    const productsData = await readSheetData(PRODUCTS_READ_RANGE);
    if (!productsData) {
      console.warn(`GS_Data: getProductDetailsByBarcode - No products data from BAR DATA sheet for barcode ${barcode}.`);
      return null;
    }
    const productRow = productsData.find(row => String(row[BAR_COL_BARCODE_PROD] || '').trim() === barcode.trim());
    if (!productRow) {
      console.warn(`GS_Data: getProductDetailsByBarcode - Barcode ${barcode} not found in BAR DATA sheet.`);
      return null;
    }
    const productName = String(productRow[BAR_COL_PRODUCT_NAME_PROD] || '').trim();
    const supData = await readSheetData(SUPPLIERS_READ_RANGE);
    let supplierName = 'Unknown Supplier';
    if (supData) {
      const supRow = supData.find(row => String(row[SUP_COL_PRODUCT_NAME_LINK] || '').trim().toLowerCase() === productName.toLowerCase());
      if (supRow && supRow.length > SUP_COL_SUPPLIER_NAME_LINK && supRow[SUP_COL_SUPPLIER_NAME_LINK]) {
        supplierName = String(supRow[SUP_COL_SUPPLIER_NAME_LINK]).trim();
      }
    }
    return {
      id: barcode, productName: productName, barcode: barcode.trim(), supplierName: supplierName,
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

export async function processReturn(itemId: string, quantityToReturn: number, staffNameProcessingReturn: string): Promise<{ success: boolean; message?: string }> {
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

export async function updateSupplierNameAndReferences(currentName: string, newName: string): Promise<boolean> {
  const timeLabel = "GS_Data: updateSupplierNameAndReferences total duration";
  console.time(timeLabel);
  try {
    const batchUpdates: { range: string; values: any[][] }[] = [];

    // Part 1: Update SUP DATA sheet
    const supDataSheet = await readSheetData(SUPPLIERS_READ_RANGE);
    if (!supDataSheet) {
      console.error("GS_Data: updateSupplierName - Failed to read SUP DATA sheet.");
      return false;
    }
    
    let supDataRowsUpdated = 0;
    supDataSheet.forEach((row, index) => {
      if (row.length > SUP_COL_SUPPLIER_NAME_LINK) {
        const existingName = String(row[SUP_COL_SUPPLIER_NAME_LINK] || '').trim();
        if (existingName.toLowerCase() === currentName.toLowerCase()) {
          const cell = `${SUP_DATA_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + SUP_COL_SUPPLIER_NAME_LINK)}${index + 2}`;
          batchUpdates.push({ range: cell, values: [[newName.trim()]] });
          supDataRowsUpdated++;
        }
      }
    });

    if (supDataRowsUpdated === 0) {
      console.warn(`GS_Data: updateSupplierName - No supplier found with name "${currentName}" in SUP DATA to update.`);
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
    console.log(`GS_Data: updateSupplierName - Batch update for "${currentName}" to "${newName}" ${success ? 'succeeded' : 'failed'}. Updates: ${supDataRowsUpdated} in SUP DATA, ${invDataRowsUpdated} in Inventory Log, ${returnsLogRowsUpdated} in Returns Log.`);
    return success;
  } catch (error) {
    console.error("GS_Data: Critical error in updateSupplierNameAndReferences:", error);
    return false;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function updateInventoryItemDetails(
  itemId: string,
  updates: { location?: string; expiryDate?: string | null; itemType?: ItemType, quantity?: number }
): Promise<boolean> {
  const timeLabel = `GS_Data: updateInventoryItemDetails for item ${itemId} total duration`;
  console.time(timeLabel);
  try {
    const rowNumber = await findRowByUniqueValue(FORM_RESPONSES_SHEET_NAME, itemId, INV_COL_UNIQUE_ID);
    if (!rowNumber) {
      console.warn(`GS_Data: updateInventoryItemDetails - Item ID ${itemId} not found.`);
      return false;
    }
    const cellUpdates: { range: string; values: any[][] }[] = [];
    if (updates.location !== undefined) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_LOCATION)}${rowNumber}`, values: [[updates.location]] });
    }
    if (updates.quantity !== undefined) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_QTY)}${rowNumber}`, values: [[updates.quantity]] });
    }
    if (updates.expiryDate !== undefined) {
      let expiryValueForSheet = '';
      if (updates.expiryDate) {
        const parsedForSheet = parseISO(updates.expiryDate);
        if (isValid(parsedForSheet)) {
          expiryValueForSheet = format(parsedForSheet, 'dd/MM/yyyy');
        } else {
          console.warn(`GS_Data: updateInventoryItemDetails - Invalid expiry date string received for item ${itemId}: ${updates.expiryDate}. Writing empty string.`);
        }
      }
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_EXPIRY)}${rowNumber}`, values: [[expiryValueForSheet]] });
    }
    if (updates.itemType) {
      cellUpdates.push({ range: `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_TYPE)}${rowNumber}`, values: [[updates.itemType]] });
    }
    if (cellUpdates.length === 0) {
      console.log(`GS_Data: updateInventoryItemDetails - No actual changes to update for item ${itemId}.`);
      return true;
    }
    const success = await batchUpdateSheetCells(cellUpdates);
    console.log(`GS_Data: updateInventoryItemDetails - Batch update for item ${itemId} ${success ? 'succeeded' : 'failed'}. Changes: ${JSON.stringify(updates)}`);
    return success;
  } catch (error) {
    console.error(`GS_Data: Critical error in updateInventoryItemDetails for ${itemId}:`, error);
    return false;
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function updateProductAndSupplierLinks(barcode: string, newProductName: string, newSupplierName: string): Promise<boolean> {
  const timeLabel = `GS_Data: updateProductAndSupplierLinks for barcode ${barcode}`;
  console.time(timeLabel);
  try {
    const batchUpdates: { range: string; values: any[][] }[] = [];
    const supDataAppends: any[][] = [];

    // --- Part 1: Update BAR DATA (Product Catalog) ---
    const barDataRowNumber = await findRowByUniqueValue(BAR_DATA_SHEET_NAME, barcode, BAR_COL_BARCODE_PROD);
    if (!barDataRowNumber) {
      console.error(`GS_Data: updateProductAndSupplierLinks - Barcode ${barcode} not found in BAR DATA. Cannot update.`);
      return false;
    }
    const existingProductRow = await readSheetData(`${BAR_DATA_SHEET_NAME}!A${barDataRowNumber}:B${barDataRowNumber}`);
    const oldProductName = (existingProductRow && existingProductRow[0]) ? String(existingProductRow[0][BAR_COL_PRODUCT_NAME_PROD] || '').trim() : '';

    if (!oldProductName) {
      console.error(`GS_Data: updateProductAndSupplierLinks - Could not read existing product name for barcode ${barcode}.`);
      return false;
    }

    const productNameChanged = oldProductName.toLowerCase() !== newProductName.trim().toLowerCase();
    if (productNameChanged) {
      batchUpdates.push({
        range: `${BAR_DATA_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + BAR_COL_PRODUCT_NAME_PROD)}${barDataRowNumber}`,
        values: [[newProductName.trim()]]
      });
    }

    // --- Part 2: Update SUP DATA (Product-Supplier Link) ---
    const supDataSheet = await readSheetData(SUPPLIERS_READ_RANGE);
    if (!supDataSheet) {
      console.warn("GS_Data: updateProductAndSupplierLinks - Could not read SUP DATA sheet. Will attempt to create new link.");
    }
    
    let oldLinkRowNumber: number | null = null;
    let newLinkExists = false;

    if (supDataSheet) {
      for (let i = 0; i < supDataSheet.length; i++) {
        const row = supDataSheet[i];
        const pName = String(row[SUP_COL_PRODUCT_NAME_LINK] || '').trim();
        const sName = String(row[SUP_COL_SUPPLIER_NAME_LINK] || '').trim();
        
        if (pName.toLowerCase() === oldProductName.toLowerCase()) {
          oldLinkRowNumber = i + 2; // 1-based row number
        }
        if (pName.toLowerCase() === newProductName.trim().toLowerCase() && sName.toLowerCase() === newSupplierName.trim().toLowerCase()) {
          newLinkExists = true;
        }
      }
    }
    
    if (oldLinkRowNumber) {
      batchUpdates.push({
        range: `${SUP_DATA_SHEET_NAME}!A${oldLinkRowNumber}:B${oldLinkRowNumber}`,
        values: [[newProductName.trim(), newSupplierName.trim()]]
      });
    } else if (!newLinkExists) {
      supDataAppends.push([newProductName.trim(), newSupplierName.trim()]);
    }

    // --- Part 3: Execute Core Updates ---
    let allSuccessful = true;
    if (batchUpdates.length > 0) {
      if (!await batchUpdateSheetCells(batchUpdates)) {
        console.error("GS_Data: updateProductAndSupplierLinks - Failed during core batch cell updates (BAR DATA, SUP DATA).");
        allSuccessful = false;
      }
    }

    if (supDataAppends.length > 0) {
      if (!await appendSheetData(SUPPLIERS_APPEND_RANGE, supDataAppends)) {
        console.error("GS_Data: updateProductAndSupplierLinks - Failed to append new supplier links.");
        allSuccessful = false;
      }
    }
    
    // --- Part 4: Cascade product name update to denormalized logs ---
    if (productNameChanged) {
      console.log(`GS_Data: Product name changed from "${oldProductName}" to "${newProductName}". Searching for inventory and return log entries to update.`);
      const [inventorySheetData, returnLogSheetData] = await Promise.all([
        readSheetData(INVENTORY_READ_RANGE),
        readSheetData(RETURN_LOG_READ_RANGE)
      ]);
      
      const logUpdates: { range: string; values: any[][] }[] = [];
      
      if (inventorySheetData) {
        inventorySheetData.forEach((row, index) => {
          if (String(row[INV_COL_PRODUCT_NAME] || '').trim().toLowerCase() === oldProductName.toLowerCase()) {
            const cell = `${FORM_RESPONSES_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + INV_COL_PRODUCT_NAME)}${index + 2}`;
            logUpdates.push({ range: cell, values: [[newProductName.trim()]] });
          }
        });
      }
      
      if (returnLogSheetData) {
        returnLogSheetData.forEach((row, index) => {
          if(String(row[RL_COL_PRODUCT_NAME] || '').trim().toLowerCase() === oldProductName.toLowerCase()) {
            const cell = `${RETURNS_LOG_SHEET_NAME}!${String.fromCharCode('A'.charCodeAt(0) + RL_COL_PRODUCT_NAME)}${index + 2}`;
            logUpdates.push({range: cell, values: [[newProductName.trim()]]});
          }
        });
      }

      if (logUpdates.length > 0) {
        console.log(`GS_Data: Found ${logUpdates.length} total log entries to update with new product name.`);
        if (!await batchUpdateSheetCells(logUpdates)) {
          console.error("GS_Data: updateProductAndSupplierLinks - Failed during batch update of inventory/return product names.");
          allSuccessful = false;
        }
      }
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
    const [products, currentInventoryItems, suppliersList, allInventoryLogRows, allReturnLogRows] = await Promise.all([
        getProducts(),
        getInventoryItems(), 
        getSuppliers(),
        readSheetData(INVENTORY_READ_RANGE), // Raw inventory log for today's additions
        readSheetData(RETURN_LOG_READ_RANGE)  // Raw returns log for today's returns
    ]);

    const totalProducts = products.length; 
    const totalStockQuantity = currentInventoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalSuppliers = suppliersList.length;
    
    let itemsExpiringSoon = 0;
    const todayDate = startOfDay(new Date()); // Use startOfDay for consistent comparison
    const sevenDaysFromNow = addDays(todayDate, 7);
    currentInventoryItems.forEach(item => {
      if (item.itemType === 'Expiry' && item.expiryDate) {
        try {
          const expiry = startOfDay(parseISO(item.expiryDate)); 
          if (isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, todayDate)) {
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

    // Calculate daily changes
    let quantityAddedToday = 0;
    if (allInventoryLogRows) {
        allInventoryLogRows.forEach(row => {
            const timestampValue = row[INV_COL_TIMESTAMP];
            const itemDate = parseFlexibleTimestamp(timestampValue);
            if (itemDate && isValid(itemDate) && isSameDay(itemDate, todayDate)) {
                const quantityStr = String(row[INV_COL_QTY] || '0').trim();
                const quantity = parseInt(quantityStr, 10);
                if (!isNaN(quantity) && quantity > 0) {
                    quantityAddedToday += quantity;
                }
            }
        });
    }

    let quantityReturnedToday = 0;
    if (allReturnLogRows) {
        allReturnLogRows.forEach(row => {
            const timestampValue = row[RL_COL_RETURN_TIMESTAMP];
            const returnDate = parseFlexibleTimestamp(timestampValue);
            if (returnDate && isValid(returnDate) && isSameDay(returnDate, todayDate)) {
                const quantityStr = String(row[RL_COL_RETURNED_QTY] || '0').trim();
                const quantity = parseInt(quantityStr, 10);
                if (!isNaN(quantity) && quantity > 0) {
                    quantityReturnedToday += quantity;
                }
            }
        });
    }

    const netChangeToday = quantityAddedToday - quantityReturnedToday;
    const stockAtStartOfDay = totalStockQuantity - netChangeToday;

    let dailyStockChangePercent: number | undefined = undefined;
    let dailyStockChangeDirection: 'increase' | 'decrease' | 'none' = 'none';

    if (stockAtStartOfDay > 0) {
        dailyStockChangePercent = (netChangeToday / stockAtStartOfDay) * 100;
    } else if (netChangeToday > 0) { 
        dailyStockChangePercent = undefined;
    }
    
    if (netChangeToday > 0) {
      dailyStockChangeDirection = 'increase';
    } else if (netChangeToday < 0) {
      dailyStockChangeDirection = 'decrease';
    }


    const metrics: DashboardMetrics = {
      totalProducts,
      totalStockQuantity,
      itemsExpiringSoon,
      damagedItemsCount,
      stockBySupplier,
      totalSuppliers,
      dailyStockChangePercent,
      dailyStockChangeDirection,
      netItemsAddedToday: dailyStockChangeDirection === 'increase' ? netChangeToday : undefined,
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
      dailyStockChangePercent: undefined,
      dailyStockChangeDirection: 'none',
      netItemsAddedToday: undefined,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function deleteInventoryItemById(itemId: string): Promise<boolean> {
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

/**
 * Loads the permissions object from the APP_SETTINGS sheet.
 */
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
                // Basic validation
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

/**
 * Saves the permissions object to the APP_SETTINGS sheet.
 * It will overwrite the existing permissions entry or create a new one.
 */
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
            // Update existing row
            const range = `${APP_SETTINGS_SHEET_NAME}!B${rowNumberToUpdate}`;
            console.log(`GS_Data: savePermissionsToSheet - Updating permissions at range: ${range}`);
            return await updateSheetData(range, [[permissionsJson]]);
        } else {
            // Append new row
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
    
