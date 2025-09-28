
'use client';

import 'dotenv/config'; 
import { initializeAdminApp } from '../src/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);


// --- Google Sheets Reading Logic (Self-Contained) ---

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


async function readSheetData(sheets: sheets_v4.Sheets, range: string): Promise<any[][] | null> {
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
    return response.data.values || [];
  } catch (error: any) {
    console.error(`Google Sheets API Error for range '${range}': ${error.message}`);
    throw new Error(`Google Sheets API responded with status ${error.code}.`);
  }
}

// --- Data Fetching from Sheets ---

interface RawSupplier {
  name: string;
}
async function getSuppliersFromSheet(sheets: sheets_v4.Sheets): Promise<RawSupplier[]> {
  const sheetData = await readSheetData(sheets, "'Form_Responses2'!H2:H");
  if (!sheetData) return [];
  return sheetData.map(row => ({ name: row[0] })).filter(s => s.name);
}

interface RawProduct {
  barcode: string;
  productName: string;
  supplierName: string;
}
async function getProductsFromSheet(sheets: sheets_v4.Sheets): Promise<RawProduct[]> {
    const sheetData = await readSheetData(sheets, "'Form_Responses2'!B2:H");
    if (!sheetData) return [];
    // Correct mapping based on 'Form_Responses2'
    // B: BARCODE, G: PRODUCT NAME, H: SUPPLIER
    return sheetData.map(row => ({
        barcode: row[0],       // Column B
        productName: row[5],   // Column G
        supplierName: row[6],  // Column H
    })).filter(p => p.barcode && p.productName);
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
    const sheetData = await readSheetData(sheets, "'Form_Responses2'!A2:I");
    if (!sheetData) return [];
    // Correct mapping based on 'Form_Responses2'
    // A: Timestamp, B: BARCODE, C: QTY, D: DATE OF EX, E: where, F: WHO I, I: EXP OR DMG
    return sheetData.map(row => ({
        timestamp: row[0],
        barcode: row[1],
        quantity: row[2],
        expiryDate: row[3],
        location: row[4],
        staffName: row[5],
        itemType: row[8],
    })).filter(i => i.barcode && i.quantity);
}

// --- Migration Functions ---

async function migrateSuppliers(suppliers: RawSupplier[]) {
  console.log(`--- Starting Supplier Migration ---`);
  if (suppliers.length === 0) {
    console.log("No suppliers found in sheet to migrate.");
    return;
  }
  const batch = db.batch();
  const suppliersCol = db.collection('suppliers');
  let uniqueCount = 0;
  
  for (const supplier of suppliers) {
    const q = suppliersCol.where("name", "==", supplier.name.trim());
    const existing = await q.get();
    if (existing.empty) {
      const docRef = suppliersCol.doc(); 
      batch.set(docRef, {
        name: supplier.name.trim(),
        createdAt: FieldValue.serverTimestamp()
      });
      uniqueCount++;
    } else {
        console.log(`Skipping existing supplier: ${supplier.name}`);
    }
  }
  
  if (uniqueCount > 0) {
    await batch.commit();
    console.log(`✅ Migrated ${uniqueCount} unique suppliers to Firestore.`);
  } else {
    console.log("All suppliers from sheet already exist in Firestore.");
  }
}

async function migrateProducts(products: RawProduct[], productMap: Map<string, any>) {
    console.log(`--- Starting Product Migration ---`);
    if (products.length === 0) {
        console.log("No products found in sheet to migrate.");
        return;
    }
    const batch = db.batch();
    const productsCol = db.collection('products');

    for (const product of products) {
        const docRef = productsCol.doc(product.barcode);
        const productData = {
            productName: product.productName.trim(),
            supplierName: product.supplierName ? product.supplierName.trim() : null,
            createdAt: FieldValue.serverTimestamp()
        };
        batch.set(docRef, productData);
        productMap.set(product.barcode, productData);
    }

    await batch.commit();
    console.log(`✅ Migrated ${products.length} products to Firestore.`);
}

async function migrateInventory(inventory: RawInventoryItem[], productMap: Map<string, any>) {
  console.log(`--- Starting Inventory Migration ---`);
  if (inventory.length === 0) {
    console.log("No inventory items found in sheet to migrate.");
    return;
  }
  const batch = db.batch();
  const inventoryCol = db.collection('inventory');
  let migratedCount = 0;

  for (const item of inventory) {
    const productDetails = productMap.get(item.barcode);
    if (!productDetails) {
        console.warn(`-  Skipping inventory item with unknown barcode: ${item.barcode}`);
        continue;
    }
    const docRef = inventoryCol.doc();
    batch.set(docRef, {
      productName: productDetails.productName,
      supplierName: productDetails.supplierName,
      barcode: item.barcode,
      quantity: parseInt(item.quantity, 10) || 0,
      location: item.location ? item.location.trim() : 'N/A',
      staffName: item.staffName ? item.staffName.trim() : 'N/A',
      itemType: item.itemType === 'Damage' ? 'Damage' : 'Expiry',
      timestamp: new Date(item.timestamp),
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    });
    migratedCount++;
  }

  if (migratedCount > 0) {
    await batch.commit();
    console.log(`✅ Migrated ${migratedCount} inventory items to Firestore.`);
  } else {
      console.log("No new inventory items to migrate.");
  }
}


// Main migration function
async function main() {
    console.log(`
=============================================
  STARTING GOOGLE SHEETS TO FIRESTORE MIGRATION  
=============================================
This script will READ data from your Google Sheet and WRITE it to Firestore.
It will NOT modify or delete any data in your Google Sheet.
`);

    try {
        console.log("Authenticating with Google Sheets API...");
        const sheets = await getSheetsClient();
        console.log("Authentication successful.");

        const suppliers = await getSuppliersFromSheet(sheets);
        const products = await getProductsFromSheet(sheets);
        const inventory = await getInventoryFromSheet(sheets);
        
        const productMap = new Map<string, any>();

        await migrateSuppliers(suppliers);
        await migrateProducts(products, productMap);
        await migrateInventory(inventory, productMap);

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
