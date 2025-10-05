// This file will be responsible for all data fetching and manipulation from Google Sheets.
'use server';

import type { Product, Supplier, InventoryItem, ReturnedItem, AddInventoryItemFormValues, DashboardMetrics, StockBySupplier, Permissions } from '@/lib/types';
import { google } from 'googleapis';
import { format, parseISO, isValid, addDays, isBefore, startOfDay, isSameDay } from 'date-fns';

// --- Google Sheets Client ---

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEETS_CREDENTIALS = {
  client_email: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
  private_key: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SHEETS_CREDENTIALS,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});
const sheetsClientPromise = auth.getClient().then(client => {
  google.options({ auth: client });
  return sheets;
});

async function getSheetsClient() {
  return sheetsClientPromise;
}

// --- Helper Functions ---

// Helper to append a single row to a sheet.
async function appendRow(range: string, values: any[]) {
    const sheets = await getSheetsClient();
    if (!GOOGLE_SHEET_ID) {
        throw new Error('Google Sheet ID not configured.');
    }
    await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [values],
        },
    });
}

// Helper to update a row in a sheet.
async function updateRow(range: string, values: any[]) {
    const sheets = await getSheetsClient();
    if (!GOOGLE_SHEET_ID) {
        throw new Error('Google Sheet ID not configured.');
    }
    await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [values],
        },
    });
}

// Helper to find a row index based on a value in a specific column.
async function findRowIndex(range: string, value: string, columnIndex: number): Promise<number | null> {
    const sheets = await getSheetsClient();
    if (!GOOGLE_SHEET_ID) {
        throw new Error('Google Sheet ID not configured.');
    }
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: range,
    });
    const rows = result.data.values;
    if (rows) {
        const rowIndex = rows.findIndex(row => row[columnIndex] && row[columnIndex].toLowerCase() === value.toLowerCase());
        return rowIndex !== -1 ? rowIndex + parseInt(range.match(/\d+$/)?.[0] || '1', 10) : null;
    }
    return null;
}

// Helper to read data from a sheet
async function readSheetData(range: string): Promise<any[][] | null> {
    try {
        const sheets = await getSheetsClient();
        if (!GOOGLE_SHEET_ID) {
            throw new Error('Google Sheet ID not configured.');
        }
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: range,
        });
        return response.data.values || [];
    } catch (error) {
        console.error('Error reading sheet data:', error);
        return null;
    }
}

// --- Data Fetching Functions ---

export async function getProducts(): Promise<Product[] | null> {
    const data = await readSheetData("'BAR DATA'!A2:C");
    if (!data) return [];
    return data.map((row, index) => ({
        id: row[0] || `product-${index}`, // Use barcode as ID
        barcode: row[0],
        productName: row[1],
        supplierName: row[2] || '', // Assuming supplier name is in column C
    }));
}

export async function getSuppliers(): Promise<Supplier[] | null> {
    const data = await readSheetData("'SUP DATA'!A2:B");
    if (!data) return [];
    const uniqueSuppliers: { [key: string]: Supplier } = {};
    data.forEach((row, index) => {
        const name = row[1]?.trim();
        if (name && !uniqueSuppliers[name.toLowerCase()]) {
            uniqueSuppliers[name.toLowerCase()] = {
                id: `supplier-${index}`,
                name: name,
            };
        }
    });
    return Object.values(uniqueSuppliers);
}

export async function getInventoryItems(): Promise<InventoryItem[] | null> {
    // A: Timestamp, B: BARCODE, C: QTY, D: DATE OF EX, E: where, F: WHO I, G: (blank), H: RowID, I: EXP OR DMG
    const data = await readSheetData("'Form responses 2'!A2:I");
    if (!data) return [];

    const barData = await readSheetData("'BAR DATA'!A2:B");
    const supData = await readSheetData("'SUP DATA'!A2:B");

    const productMap = new Map(barData?.map(row => [row[0], row[1]]));
    const supplierMap = new Map(supData?.map(row => [row[0], row[1]]));

    return data.map((row) => {
        const barcode = row[1];
        const productName = productMap.get(barcode) || 'Unknown Product';
        const supplierName = supplierMap.get(productName) || 'Unknown Supplier';

        return {
            id: row[7] || `${row[0]}-${row[1]}`, // Use RowID if available, else generate
            timestamp: row[0],
            barcode: barcode,
            productName: productName,
            supplierName: supplierName,
            quantity: parseInt(row[2], 10) || 0,
            expiryDate: row[3],
            location: row[4],
            staffName: row[5],
            itemType: row[8] || 'Expiry',
        };
    }).filter(item => item.quantity > 0);
}


export async function getReturnedItems(): Promise<ReturnedItem[] | null> {
    const data = await readSheetData("'RETURN LOG'!A2:I");
    if (!data) return [];

    return data.map((row, index) => ({
        id: `return-${index}`,
        productName: row[0],
        barcode: row[1],
        supplierName: row[2],
        returnedQuantity: parseInt(row[3], 10) || 0,
        expiryDate: row[4],
        location: row[5],
        staffName: row[6], // Original logger
        processedBy: row[7], // Who processed the return
        returnTimestamp: row[8],
        itemType: row[9] || 'Expiry',
    }));
}

export async function getUniqueStaffNames(): Promise<string[] | null> {
    const data = await readSheetData("'Form responses 2'!F2:F");
    if (!data) return [];
    const names = new Set<string>();
    data.forEach(row => {
        if (row[0]) names.add(row[0].trim());
    });
    return Array.from(names).sort();
}

export async function getUniqueLocations(): Promise<string[] | null> {
    const data = await readSheetData("'Form responses 2'!E2:E");
    if (!data) return [];
    const locations = new Set<string>();
    data.forEach(row => {
        if (row[0]) locations.add(row[0].trim());
    });
    return Array.from(locations).sort();
}


// --- Data Mutation Functions ---

export async function addProduct(productData: { barcode: string; productName: string; supplierName: string }): Promise<Product | null> {
    try {
        await appendRow("'BAR DATA'!A:C", [productData.barcode, productData.productName, productData.supplierName]);
        await addSupplier({ name: productData.supplierName }); // Ensure supplier exists
        return {
            id: productData.barcode,
            ...productData
        };
    } catch (error) {
        console.error("Error in addProduct (Google Sheets):", error);
        return null;
    }
}

export async function addSupplier(supplierData: { name: string }): Promise<{ supplier: Supplier | null; error?: string }> {
    const name = supplierData.name.trim();
    if (!name) return { supplier: null, error: "Supplier name cannot be empty." };

    const suppliers = await getSuppliers() || [];
    const existing = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        return { supplier: existing };
    }

    try {
        // This assumes SUP DATA has Product Name in A and Supplier Name in B
        // We'll leave Product Name blank as it's a new supplier with no products yet.
        await appendRow("'SUP DATA'!A:B", ['', name]);
        return { supplier: { id: `new-supplier-${Date.now()}`, name: name } };
    } catch (error) {
        console.error("Error in addSupplier (Google Sheets):", error);
        return { supplier: null, error: 'Failed to add supplier to sheet.' };
    }
}

export async function getProductDetailsByBarcode(barcode: string): Promise<Product | null> {
    const products = await getProducts();
    if (!products) return null;
    return products.find(p => p.barcode === barcode) || null;
}

export async function addInventoryItem(itemFormValues: AddInventoryItemFormValues): Promise<InventoryItem | null> {
    try {
        const timestamp = new Date().toLocaleString("en-GB"); // Format: DD/MM/YYYY, HH:MM:SS
        const expiryDate = itemFormValues.expiryDate ? format(itemFormValues.expiryDate, 'dd/MM/yyyy') : '';
        const newRow = [
            timestamp,
            itemFormValues.barcode,
            itemFormValues.quantity,
            expiryDate,
            itemFormValues.location,
            itemFormValues.staffName,
            '', // Placeholder for G column
            `ID-${Date.now()}`, // Generate a unique-ish ID
            itemFormValues.itemType,
        ];
        await appendRow("'Form responses 2'!A:I", newRow);
        
        // This is a mock return object. The real data is in the sheet.
        const productDetails = await getProductDetailsByBarcode(itemFormValues.barcode);
        return {
            id: newRow[7],
            timestamp: new Date().toISOString(),
            barcode: itemFormValues.barcode,
            productName: productDetails?.productName || 'Unknown',
            supplierName: productDetails?.supplierName || 'Unknown',
            quantity: itemFormValues.quantity,
            expiryDate: itemFormValues.expiryDate?.toISOString(),
            location: itemFormValues.location,
            staffName: itemFormValues.staffName,
            itemType: itemFormValues.itemType,
        };
    } catch (error) {
        console.error("Error in addInventoryItem (Google Sheets):", error);
        return null;
    }
}

export async function processReturn(itemId: string, quantityToReturn: number, staffNameProcessingReturn: string): Promise<{ success: boolean; message?: string }> {
    const rowIndex = await findRowIndex("'Form responses 2'!H:H", itemId, 0);
    if (rowIndex === null) {
        return { success: false, message: `Item with ID ${itemId} not found.` };
    }
    
    try {
        const sheets = await getSheetsClient();
        const rangeToGet = `'Form responses 2'!A${rowIndex}:I${rowIndex}`;
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: rangeToGet,
        });

        const row = result.data.values?.[0];
        if (!row) {
            return { success: false, message: `Could not read data for item ID ${itemId}.` };
        }

        const currentQuantity = parseInt(row[2], 10) || 0;
        const newQuantity = currentQuantity - quantityToReturn;

        if (newQuantity < 0) {
            return { success: false, message: `Cannot return more than available quantity (${currentQuantity}).` };
        }

        // Update the quantity in the inventory sheet
        await updateRow(`'Form responses 2'!C${rowIndex}`, [newQuantity]);

        // Log the return
        const productName = (await getProductDetailsByBarcode(row[1]))?.productName || 'Unknown Product';
        const supplierName = (await getProductDetailsByBarcode(row[1]))?.supplierName || 'Unknown Supplier';

        const returnLog = [
            productName,
            row[1], // barcode
            supplierName,
            quantityToReturn,
            row[3], // expiry
            row[4], // location
            row[5], // staffName
            staffNameProcessingReturn,
            new Date().toLocaleString("en-GB"),
            row[8], // item type
        ];
        await appendRow("'RETURN LOG'!A:J", returnLog);
        return { success: true, message: 'Return processed successfully.' };

    } catch (error) {
        console.error("Error in processReturn (Google Sheets):", error);
        return { success: false, message: 'Failed to process return.' };
    }
}

export async function updateSupplierNameAndReferences(currentName: string, newName: string): Promise<boolean> {
    // This is complex with sheets. For now, we only update the supplier list.
    // A full implementation would need to iterate over all other sheets.
    try {
        const rowIndex = await findRowIndex("'SUP DATA'!B:B", currentName, 0);
        if (rowIndex !== null) {
            await updateRow(`'SUP DATA'!B${rowIndex}`, [newName]);
        }
        // NOTE: This does not update the denormalized supplier name in 'BAR DATA'.
        // This is a limitation of the Sheets-based approach without more complex scripting.
        return true;
    } catch (error) {
        console.error("Error in updateSupplierNameAndReferences (Google Sheets):", error);
        return false;
    }
}

export async function updateInventoryItemDetails(itemId: string, updates: { location?: string; expiryDate?: Date | null; itemType?: 'Expiry' | 'Damage', quantity?: number }): Promise<boolean> {
    const rowIndex = await findRowIndex("'Form responses 2'!H:H", itemId, 0);
    if (rowIndex === null) {
        console.error(`updateInventoryItemDetails: Item with ID ${itemId} not found.`);
        return false;
    }
    
    try {
        const rangeToGet = `'Form responses 2'!A${rowIndex}:I${rowIndex}`;
        const sheets = await getSheetsClient();
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: rangeToGet,
        });
        const row = result.data.values?.[0];
        if (!row) return false;

        const newRow = [...row];
        if (updates.quantity !== undefined) newRow[2] = updates.quantity;
        if (updates.expiryDate !== undefined) newRow[3] = updates.expiryDate ? format(updates.expiryDate, 'dd/MM/yyyy') : '';
        if (updates.location !== undefined) newRow[4] = updates.location;
        if (updates.itemType !== undefined) newRow[8] = updates.itemType;

        await updateRow(rangeToGet, newRow);
        return true;
    } catch (error) {
        console.error("Error updating inventory item details in Sheets:", error);
        return false;
    }
}

export async function updateProductAndSupplierLinks(barcode: string, newProductName: string, newSupplierName: string): Promise<boolean> {
    const rowIndex = await findRowIndex("'BAR DATA'!A:A", barcode, 0);
    if (rowIndex === null) {
        return false; // Product not found
    }
    try {
        await updateRow(`'BAR DATA'!B${rowIndex}:C${rowIndex}`, [newProductName, newSupplierName]);
        return true;
    } catch (error) {
        console.error("Error updating product details in Sheets:", error);
        return false;
    }
}

export async function getInventoryLogEntriesByBarcode(barcode: string): Promise<InventoryItem[]> {
    const allItems = await getInventoryItems();
    if (!allItems) return [];
    return allItems.filter(item => item.barcode === barcode);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const [products, inventory, suppliers, returns] = await Promise.all([
        getProducts(),
        getInventoryItems(),
        getSuppliers(),
        getReturnedItems(),
    ]);

    const totalProducts = products?.length || 0;
    const totalStockQuantity = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const totalSuppliers = suppliers?.length || 0;

    const today = startOfDay(new Date());
    const sevenDaysFromNow = addDays(today, 7);
    const itemsExpiringSoon = inventory?.filter(item => {
        if (!item.expiryDate) return false;
        try {
            const [day, month, year] = item.expiryDate.split('/');
            const expiry = startOfDay(new Date(`${year}-${month}-${day}`));
            return isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, today);
        } catch {
            return false;
        }
    }).length || 0;

    const damagedItemsCount = inventory?.filter(item => item.itemType === 'Damage').length || 0;

    const stockBySupplierMap = new Map<string, number>();
    inventory?.forEach(item => {
        const supplier = item.supplierName || "Unknown Supplier";
        stockBySupplierMap.set(supplier, (stockBySupplierMap.get(supplier) || 0) + item.quantity);
    });

    const stockBySupplier: StockBySupplier[] = Array.from(stockBySupplierMap.entries())
        .map(([name, totalStock]) => ({ name, totalStock }))
        .sort((a, b) => b.totalStock - a.totalStock);

    return {
        totalProducts,
        totalStockQuantity,
        itemsExpiringSoon,
        damagedItemsCount,
        stockBySupplier,
        totalSuppliers,
        dailyStockChangePercent: 0, // Not implemented for Sheets
        dailyStockChangeDirection: 'none',
    };
}


export async function deleteInventoryItemById(itemId: string): Promise<boolean> {
    const rowIndex = await findRowIndex("'Form responses 2'!H:H", itemId, 0);
    if (rowIndex === null) {
        return false;
    }
    // Deleting a row is a more complex operation involving batchUpdate.
    // For simplicity, we will just clear the row content.
    try {
        await updateRow(`'Form responses 2'!A${rowIndex}:I${rowIndex}`, Array(9).fill(''));
        return true;
    } catch (error) {
        console.error("Error 'deleting' (clearing) row in Sheets:", error);
        return false;
    }
}

// Permissions are not stored in Google Sheets in this version, so we return defaults.
export async function loadPermissions(): Promise<Permissions | null> {
    // This is a mock implementation.
    return null;
}

export async function savePermissions(permissions: Permissions): Promise<boolean> {
    // This is a mock implementation.
    console.log("Permissions saved (mock):", permissions);
    return true;
}