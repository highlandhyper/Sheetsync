
'use client';

import * as fs from 'fs';
import * as path from 'path';

// --- Robust .env loader ---
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFileContent = fs.readFileSync(envPath, 'utf8');
  envFileContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
  console.log('.env.local file loaded successfully by migration script.');
} else {
    console.warn('Migration Script: .env.local file not found. The script may fail if required variables are not set elsewhere.');
}
// --- End .env loader ---


import { getAdminApp } from '../src/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore(getAdminApp());

// --- Google Sheets Reading Logic (Self-Contained) ---

const GOOGLE_SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

interface SheetData {
  range: string;
  majorDimension: string;
  values: string[][];
}

async function readSheetData(range: string): Promise<string[][] | null> {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SHEETS_API_KEY) {
    console.error("Google Sheets API Error reading range", range + ": Missing GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY from .env.local file.");
    throw new Error("Failed to read data from Google Sheet due to missing configuration.");
  }
  
  const url = `${GOOGLE_SHEETS_API_BASE_URL}/${GOOGLE_SHEET_ID}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Google Sheets API Error for range '${range}': ${errorData.error.message}`);
      throw new Error(`Google Sheets API responded with status ${response.status}.`);
    }
    const data: SheetData = await response.json();
    return data.values || [];
  } catch (error) {
    console.error(`Failed to fetch data from Google Sheets for range '${range}'.`, error);
    return null;
  }
}

// --- Data Fetching from Sheets ---

interface RawSupplier {
  name: string;
}
async function getSuppliersFromSheet(): Promise<RawSupplier[]> {
  const sheetData = await readSheetData("'SUP DATA'!A2:A");
  if (!sheetData) return [];
  return sheetData.map(row => ({ name: row[0] })).filter(s => s.name);
}

interface RawProduct {
  barcode: string;
  productName: string;
  supplierName: string;
}
async function getProductsFromSheet(): Promise<RawProduct[]> {
    const sheetData = await readSheetData("'BAR DATA'!A2:C");
    if (!sheetData) return [];
    return sheetData.map(row => ({
        barcode: row[0],
        productName: row[1],
        supplierName: row[2],
    })).filter(p => p.barcode && p.productName);
}

interface RawInventoryItem {
  timestamp: string;
  staffName: string;
  itemType: string;
  barcode: string;
  quantity: string;
  expiryDate: string;
  location: string;
}
async function getInventoryFromSheet(): Promise<RawInventoryItem[]> {
    const sheetData = await readSheetData("'INV DATA'!A2:G");
    if (!sheetData) return [];
    return sheetData.map(row => ({
        timestamp: row[0],
        staffName: row[1],
        itemType: row[2],
        barcode: row[3],
        quantity: row[4],
        expiryDate: row[5],
        location: row[6],
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
  
  for (const supplier of suppliers) {
    // Check if supplier already exists to avoid duplicates
    const q = suppliersCol.where("name", "==", supplier.name.trim());
    const existing = await q.get();
    if (existing.empty) {
      const docRef = suppliersCol.doc(); // Auto-generate ID
      batch.set(docRef, {
        name: supplier.name.trim(),
        createdAt: FieldValue.serverTimestamp()
      });
    } else {
        console.log(`Skipping existing supplier: ${supplier.name}`);
    }
  }
  
  await batch.commit();
  console.log(`✅ Migrated ${suppliers.length} unique suppliers to Firestore.`);
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
      // Timestamps
      timestamp: new Date(item.timestamp),
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    });
  }

  await batch.commit();
  console.log(`✅ Migrated ${inventory.length} inventory items to Firestore.`);
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
        const suppliers = await getSuppliersFromSheet();
        const products = await getProductsFromSheet();
        const inventory = await getInventoryFromSheet();
        
        // This map will store product details to enrich inventory items
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
