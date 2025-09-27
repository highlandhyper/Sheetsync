
// tsx scripts/migrate-to-firestore.ts
import 'dotenv/config'; // Load .env files
import * as admin from 'firebase-admin';
import {
  getProducts as getProductsFromSheet,
  getInventoryItems as getInventoryItemsFromSheet,
  getSuppliers as getSuppliersFromSheet,
} from '../src/lib/data';
import type { Product, InventoryItem, Supplier } from '../src/lib/types';
import {-l} from "firebase-admin/lib/auth";

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
      data: { name: supplier.name } // Only storing name, id is the doc id
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
