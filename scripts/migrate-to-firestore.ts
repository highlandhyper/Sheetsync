
'use client';

import 'dotenv/config'; 
import { initializeAdminApp } from '../src/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);


// --- Google Sheets Reading Logic ---

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      private_key: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}


async function readSheetData(sheets: sheets_v4.Sheets, range: string): Promise<any[][]> {
  if (!GOOGLE_SHEET_ID) {
    console.error("Google Sheets API Error reading range", range + ": Missing GOOGLE_SHEET_ID from .env.local file.");
    throw new Error("Failed to read data from Google Sheet due to missing configuration.");
  }
  
  try {
    console.log(`Reading from range: ${range}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range,
    });
    const values = response.data.values || [];
    console.log(`- Found ${values.length} rows in ${range}`);
    return values;
  } catch (error: any) {
    console.error(`Google Sheets API Error for range '${range}': ${error.message}`);
    throw new Error(`Google Sheets API responded with status ${error.code}.`);
  }
}

// --- Data Fetching from Sheets ---

interface RawBarData {
  barcode: string;
  productName: string;
}
async function getBarDataFromSheet(sheets: sheets_v4.Sheets): Promise<RawBarData[]> {
  const sheetData = await readSheetData(sheets, "'BAR DATA'!A2:B");
  return sheetData
    .map(row => ({ barcode: row[0], productName: row[1] }))
    .filter(d => d.barcode && d.productName);
}

interface RawSupData {
  productName: string;
  supplierName: string;
}
async function getSupDataFromSheet(sheets: sheets_v4.Sheets): Promise<RawSupData[]> {
  const sheetData = await readSheetData(sheets, "'SUP DATA'!A2:B");
  return sheetData
    .map(row => ({ productName: row[0], supplierName: row[1] }))
    .filter(d => d.productName && d.supplierName); 
}


interface RawInventoryItem {
  timestamp: string;
  barcode: string;
  quantity: string;
  expiryDate: string;
  location: string;
  staffName: string;
  itemType: string;
}
async function getInventoryFromSheet(sheets: sheets_v4.Sheets): Promise<RawInventoryItem[]> {
    const sheetData = await readSheetData(sheets, "'Form responses 2'!A2:I");
    // A: Timestamp, B: BARCODE, C: QTY, D: DATE OF EX, E: where, F: WHO I, I: EXP OR DMG
    return sheetData.map(row => ({
        timestamp: row[0],
        barcode: row[1],
        quantity: row[2],
        expiryDate: row[3],
        location: row[4],
        staffName: row[5],
        itemType: row[8],
    })).filter(i => i && i.barcode && i.quantity);
}

// --- Migration Functions ---

/**
 * Parses a date string in DD/MM/YYYY format, optionally with time.
 * @param dateString The date string from the sheet.
 * @returns A Date object or null if parsing fails.
 */
function parseDateString(dateString: string): Date | null {
    if (!dateString || !dateString.trim()) {
        return null;
    }
    // Handles "DD/MM/YYYY" or "DD/MM/YYYY HH:mm:ss"
    const parts = dateString.split(' ')[0].split('/');
    if (parts.length !== 3) {
        return null; // Invalid date format
    }
    // Reassemble into YYYY-MM-DD which is universally parsable by `new Date()`
    const [day, month, year] = parts;

    // Basic sanity check for year, month, day parts
    if (isNaN(parseInt(year, 10)) || isNaN(parseInt(month, 10)) || isNaN(parseInt(day, 10)) ||
        parseInt(year, 10) < 1900 || parseInt(year, 10) > 2100 ||
        parseInt(month, 10) < 1 || parseInt(month, 10) > 12 ||
        parseInt(day, 10) < 1 || parseInt(day, 10) > 31) {
        return null;
    }

    const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(isoDateString);
     if (isNaN(date.getTime())) {
        return null;
    }

    // If there is a time part, add it
    const timePart = dateString.split(' ')[1];
    if(timePart){
        const timeParts = timePart.split(':');
        if(timeParts.length === 3){
            date.setHours(parseInt(timeParts[0], 10));
            date.setMinutes(parseInt(timeParts[1], 10));
            date.setSeconds(parseInt(timeParts[2], 10));
        }
    }
    
    return date;
}

async function clearCollection(collectionPath: string) {
    console.log(`--- Clearing collection: ${collectionPath} ---`);
    const collectionRef = db.collection(collectionPath);
    const BATCH_SIZE = 400;
    
    return new Promise<void>((resolve, reject) => {
        deleteQueryBatch(collectionRef.limit(BATCH_SIZE), resolve).catch(reject);
    });

    async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: () => void) {
        const snapshot = await query.get();

        if (snapshot.size === 0) {
            console.log(`- Collection ${collectionPath} is now empty.`);
            resolve();
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        console.log(`- Deleted a batch of ${snapshot.size} documents from ${collectionPath}.`);

        // Recurse on the next process tick, to avoid exploding the stack.
        process.nextTick(() => {
            deleteQueryBatch(query, resolve);
        });
    }
}


async function migrateSuppliers(supData: RawSupData[]) {
  console.log(`--- Starting Supplier Migration ---`);
  if (supData.length === 0) {
    console.log("No supplier data found in 'SUP DATA' sheet to migrate.");
    return;
  }
  const suppliersCol = db.collection('suppliers');
  const uniqueSupplierNames = new Set<string>();
  
  supData.forEach(item => {
    if (item.supplierName && item.supplierName.trim()) {
      uniqueSupplierNames.add(item.supplierName.trim());
    }
  });

  if (uniqueSupplierNames.size === 0) {
      console.log("No valid supplier names found to migrate.");
      return;
  }
  
  console.log(`Found ${uniqueSupplierNames.size} unique supplier names from 'SUP DATA'. Checking against Firestore...`);
  
  const existingSuppliersSnapshot = await suppliersCol.get();
  const existingSupplierNames = new Set(existingSuppliersSnapshot.docs.map(doc => doc.data().name));
  
  let newSuppliersCount = 0;
  let batch = db.batch();
  let operations = 0;
  const BATCH_SIZE = 400;

  for (const name of uniqueSupplierNames) {
    if (!existingSupplierNames.has(name)) {
      const docRef = suppliersCol.doc(); 
      batch.set(docRef, {
        name: name,
        createdAt: FieldValue.serverTimestamp()
      });
      newSuppliersCount++;
      operations++;

      if (operations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`- Committed a batch of ${operations} new suppliers.`);
        batch = db.batch();
        operations = 0;
      }
    }
  }
  
  if (operations > 0) {
    await batch.commit();
    console.log(`- Committed the final batch of ${operations} new suppliers.`);
  }

  if (newSuppliersCount > 0) {
    console.log(`✅ Migrated ${newSuppliersCount} new unique suppliers to Firestore.`);
  } else {
    console.log("All suppliers from 'SUP DATA' sheet already exist in Firestore.");
  }
}


async function migrateProducts(barData: RawBarData[], supplierNameMap: Map<string, string>) {
    console.log(`--- Starting Product Migration ---`);
    if (barData.length === 0) {
        console.log("No product data found in 'BAR DATA' sheet to migrate.");
        return;
    }
    const productsCol = db.collection('products');
    let migratedCount = 0;
    let batch = db.batch();
    let operations = 0;
    const BATCH_SIZE = 400;

    for (const product of barData) {
        if (!product.barcode || !product.productName) continue;

        if (product.barcode.includes('/')) {
            console.warn(`- Skipping product with invalid barcode (contains '/'): "${product.barcode}"`);
            continue;
        }

        const docRef = productsCol.doc(product.barcode);
        const supplierName = supplierNameMap.get(product.productName.trim());

        const productData = {
            productName: product.productName.trim(),
            supplierName: supplierName || null,
            createdAt: FieldValue.serverTimestamp()
        };
        batch.set(docRef, productData, { merge: true });
        migratedCount++;
        operations++;

        if (operations >= BATCH_SIZE) {
            await batch.commit();
            console.log(`- Committed a batch of ${operations} products.`);
            batch = db.batch();
            operations = 0;
        }
    }

    if (operations > 0) {
        await batch.commit();
        console.log(`- Committed the final batch of ${operations} products.`);
    }

    if (migratedCount > 0) {
        console.log(`✅ Migrated or updated ${migratedCount} products in Firestore from 'BAR DATA'.`);
    } else {
        console.log("No valid products found in 'BAR DATA' to migrate.");
    }
}


async function migrateInventory(inventoryData: RawInventoryItem[], productNameMap: Map<string, string>, supplierNameMap: Map<string, string>) {
  console.log(`--- Starting Inventory Migration ---`);
  if (inventoryData.length === 0) {
    console.log("No inventory items found in 'Form responses 2' to migrate.");
    return;
  }

  const inventoryCol = db.collection('inventory');
  let migratedCount = 0;
  let batch = db.batch();
  let operations = 0;
  const BATCH_SIZE = 400;

  for (const item of inventoryData) {
    if (!item.barcode) continue;
    
    const productName = productNameMap.get(item.barcode.trim());

    if (!productName) {
        console.warn(`-  Skipping inventory item with barcode: ${item.barcode}. Product name not found in 'BAR DATA'.`);
        continue;
    }
    
    const supplierName = supplierNameMap.get(productName);

    const validTimestamp = parseDateString(item.timestamp);
    if (!validTimestamp) {
        console.warn(`- Skipping inventory item with invalid timestamp: '${item.timestamp}' for barcode ${item.barcode}`);
        continue;
    }

    const validExpiryDate = parseDateString(item.expiryDate);
    if (!validExpiryDate && item.expiryDate && item.expiryDate.trim()) {
        console.warn(`- Invalid expiry date format: '${item.expiryDate}' for barcode ${item.barcode}. Setting to null.`);
    }

    const docRef = inventoryCol.doc();
    batch.set(docRef, {
      productName: productName,
      supplierName: supplierName || null,
      barcode: item.barcode,
      quantity: parseInt(item.quantity, 10) || 0,
      location: item.location ? item.location.trim() : 'N/A',
      staffName: item.staffName ? item.staffName.trim() : 'N/A',
      itemType: item.itemType === 'Damage' ? 'Damage' : 'Expiry',
      timestamp: validTimestamp,
      expiryDate: validExpiryDate,
    });
    migratedCount++;
    operations++;

    if (operations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`- Committed a batch of ${operations} inventory items.`);
        batch = db.batch();
        operations = 0;
    }
  }

  if (operations > 0) {
      await batch.commit();
      console.log(`- Committed the final batch of ${operations} inventory items.`);
  }

  if (migratedCount > 0) {
    console.log(`✅ Migrated ${migratedCount} inventory items to Firestore.`);
  } else {
      console.log("No new valid inventory items to migrate from 'Form responses 2'.");
  }
}


// Main migration function
async function main() {
    console.log(`
=============================================
  STARTING GOOGLE SHEETS TO FIRESTORE MIGRATION  
=============================================
This script will READ data from your Google Sheets and WRITE it to Firestore.
It will NOT modify or delete any data in your Google Sheet.
`);

    try {
        console.log("Authenticating with Google Sheets API...");
        const sheets = await getSheetsClient();
        console.log("Authentication successful.");

        // Fetch all data from all three sheets
        const [barData, supData, inventoryData] = await Promise.all([
          getBarDataFromSheet(sheets),
          getSupDataFromSheet(sheets),
          getInventoryFromSheet(sheets)
        ]);
        
        // --- Create Lookup Maps ---
        console.log("Creating lookup maps in memory...");
        // Map: barcode -> productName
        const productNameMap = new Map<string, string>();
        barData.forEach(item => {
          if(item.barcode && item.productName) {
            productNameMap.set(item.barcode.trim(), item.productName.trim());
          }
        });

        // Map: productName -> supplierName
        const supplierNameMap = new Map<string, string>();
        supData.forEach(item => {
          if (item.productName && item.supplierName) {
            supplierNameMap.set(item.productName.trim(), item.supplierName.trim());
          }
        });
        console.log(`- Created productNameMap with ${productNameMap.size} entries.`);
        console.log(`- Created supplierNameMap with ${supplierNameMap.size} entries.`);
        
        // --- Run Migrations ---
        // NOTE: Clearing inventory ensures a clean import every time.
        // This is safer if the script is run multiple times.
        // You can comment this out if you prefer to only add new records.
        await clearCollection('inventory');
        
        await migrateSuppliers(supData);
        await migrateProducts(barData, supplierNameMap);
        await migrateInventory(inventoryData, productNameMap, supplierNameMap);

        console.log(`
=============================================
      ✅ MIGRATION COMPLETED SUCCESSFULLY ✅      
=============================================
`);

    } catch(error) {
        console.error(`
=============================================
      ❌ MIGRATION FAILED ❌      
=============================================
An error occurred during the migration process:`, error);
    }
}

main();



    