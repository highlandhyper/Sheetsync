
// tsx scripts/migrate-to-firestore.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
// Explicitly load .env.local from the root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import type { Product, InventoryItem, Supplier } from '../src/lib/types';

// ////////////////////////////////////////////////////////////////////
// SETUP: CONFIGURE YOUR FIREBASE ADMIN SDK
// ////////////////////////////////////////////////////////////////////
// This script uses Application Default Credentials.
// 1. Authenticate with Google Cloud CLI: `gcloud auth application-default login`
// 2. Set the project in your environment: `gcloud config set project YOUR_PROJECT_ID`
// 3. Your NEXT_PUBLIC_FIREBASE_PROJECT_ID from .env.local should match YOUR_PROJECT_ID.

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in your .env.local file.");
  process.exit(1);
}

try {
  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`Firebase Admin SDK initialized for project: ${projectId}`);
} catch (error: any) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.log("Please ensure you have authenticated with Google Cloud CLI (`gcloud auth application-default login`) and set your project (`gcloud config set project YOUR_PROJECT_ID`).");
  process.exit(1);
}

const db = admin.firestore();
const BATCH_SIZE = 250; // Firestore batch writes can have max 500 operations


// ////////////////////////////////////////////////////////////////////
// GOOGLE SHEETS CLIENT LOGIC (Restored for Migration)
// ////////////////////////////////////////////////////////////////////
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

const sheets = google.sheets({
  version: 'v4',
  auth: GOOGLE_SHEETS_API_KEY,
});

async function readSheetData(range: string): Promise<any[][] | undefined> {
  if (!SPREADSHEET_ID || !GOOGLE_SHEETS_API_KEY) {
      console.error(`Google Sheets API Error reading range "${range}": Missing GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY from .env.local file.`);
      throw new Error('Failed to read data from Google Sheet due to missing configuration.');
  }
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values;
  } catch (error) {
    console.error(`Google Sheets API Error reading range "${range}":`, error);
    throw new Error('Failed to read data from Google Sheet.');
  }
}

async function getProductsFromSheet(): Promise<Product[]> {
    const barData = await readSheetData("'BAR DATA'!A2:C");
    if (!barData) return [];

    return barData.map((row) => ({
        id: row[0], // Barcode
        barcode: row[0],
        productName: row[1],
        supplierName: row[2] || null,
    }));
}

async function getSuppliersFromSheet(): Promise<Supplier[]> {
    const supData = await readSheetData("'SUP DATA'!A2:A");
    if (!supData) return [];
    
    const uniqueSupplierNames = [...new Set(supData.flat())].filter(Boolean);

    return uniqueSupplierNames.map((name, index) => ({
        id: name.replace(/\s+/g, '-').toLowerCase() + `-${index}`, // Create a stable ID
        name: name,
    }));
}

async function getInventoryItemsFromSheet(): Promise<InventoryItem[]> {
    const inventoryData = await readSheetData("'Form responses 2'!A2:I");
    if (!inventoryData) return [];

    const products = await getProductsFromSheet();
    const productMap = new Map(products.map(p => [p.productName, p]));

    return inventoryData.map((row, index) => {
        const productName = row[1];
        const productInfo = productMap.get(productName) || { barcode: 'N/A', supplierName: 'N/A' };
        
        return {
            id: `sheet-item-${index + 2}`, // Create a stable ID based on row number
            timestamp: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
            productName: productName,
            barcode: productInfo.barcode,
            supplierName: productInfo.supplierName,
            itemType: row[2] as 'Expiry' | 'Damage',
            quantity: parseInt(row[3], 10) || 0,
            expiryDate: row[4] ? new Date(row[4]).toISOString().split('T')[0] : undefined,
            location: row[5] || 'N/A',
            staffName: row[6] || 'N/A',
        };
    }).filter(item => item.quantity > 0); // Only migrate items with quantity > 0
}


// ////////////////////////////////////////////////////////////////////
// BATCH COMMIT LOGIC
// ////////////////////////////////////////////////////////////////////
async function batchCommit<T>(collectionName: string, data: T[], transform: (item: T) => { id: string, data: any }) {
  console.log(`Starting batch commit for ${data.length} items to '${collectionName}' collection...`);
  let batch = db.batch();
  let operationCount = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const { id, data: docData } = transform(item);
    const docRef = db.collection(collectionName).doc(id);
    batch.set(docRef, docData);
    operationCount++;

    if (operationCount >= BATCH_SIZE || i === data.length - 1) {
      console.log(`  Committing batch of ${operationCount} documents to '${collectionName}'...`);
      await batch.commit();
      console.log(`  Batch committed successfully.`);
      batch = db.batch();
      operationCount = 0;
    }
  }
  console.log(`Finished batch committing all ${data.length} items to '${collectionName}'.`);
}


// --- Migration Functions ---

async function migrateSuppliers() {
  console.log("\n--- Starting Supplier Migration ---");
  const suppliers = await getSuppliersFromSheet();
  if (!suppliers || suppliers.length === 0) {
    console.log("No suppliers found in Google Sheet. Skipping migration.");
    return;
  }
  console.log(`Found ${suppliers.length} unique suppliers in Google Sheet.`);
  
  await batchCommit<Supplier>(
    'suppliers',
    suppliers,
    (supplier) => ({
      id: supplier.id,
      data: { name: supplier.name, createdAt: admin.firestore.FieldValue.serverTimestamp() }
    })
  );
}

async function migrateProducts() {
  console.log("\n--- Starting Product Migration ---");
  const products = await getProductsFromSheet();
   if (!products || products.length === 0) {
    console.log("No products found in Google Sheet. Skipping migration.");
    return;
  }
  console.log(`Found ${products.length} products in Google Sheet.`);
  
  await batchCommit<Product>(
    'products',
    products,
    (product) => ({
      id: product.barcode, // Using barcode as the document ID for products
      data: {
        productName: product.productName,
        supplierName: product.supplierName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    })
  );
}

async function migrateInventory() {
  console.log("\n--- Starting Inventory Migration ---");
  const inventoryItems = await getInventoryItemsFromSheet();
   if (!inventoryItems || inventoryItems.length === 0) {
    console.log("No inventory items found in Google Sheet. Skipping migration.");
    return;
  }
  console.log(`Found ${inventoryItems.length} active inventory items in Google Sheet.`);

  await batchCommit<InventoryItem>(
    'inventory',
    inventoryItems,
    (item) => ({
      id: item.id, // Using the unique ID from the sheet
      data: {
        productName: item.productName,
        barcode: item.barcode,
        supplierName: item.supplierName || null,
        quantity: item.quantity,
        expiryDate: item.expiryDate ? admin.firestore.Timestamp.fromDate(new Date(item.expiryDate)) : null,
        location: item.location,
        staffName: item.staffName,
        itemType: item.itemType,
        timestamp: item.timestamp ? admin.firestore.Timestamp.fromDate(new Date(item.timestamp)) : admin.firestore.FieldValue.serverTimestamp(),
      }
    })
  );
}


// --- Main Execution ---

async function main() {
  console.log("=============================================");
  console.log("  STARTING GOOGLE SHEETS TO FIRESTORE MIGRATION  ");
  console.log("=============================================");
  console.log("This script will READ data from your Google Sheet and WRITE it to Firestore.");
  console.log("It will NOT modify or delete any data in your Google Sheet.");
  
  try {
    await migrateSuppliers();
    await migrateProducts();
    await migrateInventory();
    
    console.log("\n=============================================");
    console.log("      ✅ MIGRATION COMPLETED SUCCESSFULLY ✅     ");
    console.log("=============================================");
    console.log("All data has been transferred to Firestore. You can now proceed with updating the application code to use Firestore as the database.");

  } catch (error) {
    console.error("\n=============================================");
    console.error("      ❌ MIGRATION FAILED ❌      ");
    console.error("=============================================");
    console.error("An error occurred during the migration process:", error);
    process.exit(1);
  }
}

main();
