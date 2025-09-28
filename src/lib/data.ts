

import type { Product, Supplier, InventoryItem, ReturnedItem, AddInventoryItemFormValues, DashboardMetrics, StockBySupplier, Permissions } from '@/lib/types';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  addDoc, 
  writeBatch,
  query, 
  where,
  limit,
  orderBy,
  Timestamp,
  serverTimestamp,
  runTransaction,
  deleteDoc,
  updateDoc,
  collectionGroup
} from 'firebase/firestore';
import { initializeAdminApp } from './firebase-admin'; // Only used for type, but will ensure it's initialized on server
import { format, parseISO, isValid, addDays, isBefore, startOfDay, isSameDay } from 'date-fns';

// Initialize on first data access on the server
let db: FirebaseFirestore.Firestore;
try {
  const adminApp = initializeAdminApp();
  db = getFirestore(adminApp);
} catch (e) {
  console.error("data.ts: Failed to get Firestore instance. The Admin SDK may not be initialized.", e);
  // We don't throw here, to allow client-side to still work.
  // Server-side functions will fail if db is not initialized.
}


// Collection names
const PRODUCTS_COLLECTION = 'products';
const SUPPLIERS_COLLECTION = 'suppliers';
const INVENTORY_COLLECTION = 'inventory';
const RETURNS_LOG_COLLECTION = 'returns';
const SETTINGS_COLLECTION = 'settings';

function docToProduct(doc: FirebaseFirestore.DocumentSnapshot): Product {
    const data = doc.data() as any;
    return {
        id: doc.id,
        barcode: doc.id, // Using barcode as document ID
        productName: data.productName,
        supplierName: data.supplierName || null,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
    };
}

function docToSupplier(doc: FirebaseFirestore.DocumentSnapshot): Supplier {
    const data = doc.data() as any;
    return {
        id: doc.id,
        name: data.name,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
    };
}

function docToInventoryItem(doc: FirebaseFirestore.DocumentSnapshot): InventoryItem {
    const data = doc.data() as any;
    return {
        id: doc.id,
        productName: data.productName,
        barcode: data.barcode,
        supplierName: data.supplierName,
        quantity: data.quantity,
        expiryDate: data.expiryDate instanceof Timestamp ? data.expiryDate.toDate().toISOString().split('T')[0] : undefined,
        location: data.location,
        staffName: data.staffName,
        itemType: data.itemType,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
    };
}

function docToReturnedItem(doc: FirebaseFirestore.DocumentSnapshot): ReturnedItem {
    const data = doc.data() as any;
    return {
        id: doc.id,
        originalInventoryItemId: data.originalInventoryItemId,
        productName: data.productName,
        barcode: data.barcode,
        supplierName: data.supplierName,
        returnedQuantity: data.returnedQuantity,
        expiryDate: data.expiryDate instanceof Timestamp ? data.expiryDate.toDate().toISOString().split('T')[0] : undefined,
        location: data.location,
        staffName: data.staffName,
        itemType: data.itemType,
        processedBy: data.processedBy,
        returnTimestamp: data.returnTimestamp instanceof Timestamp ? data.returnTimestamp.toDate().toISOString() : new Date().toISOString(),
    };
}


export async function getProducts(): Promise<Product[]> {
    const productsSnapshot = await db.collection(PRODUCTS_COLLECTION).get();
    const products = productsSnapshot.docs.map(docToProduct);
    console.log(`Firestore: getProducts - Fetched ${products.length} products.`);
    return products;
}

export async function getSuppliers(): Promise<Supplier[]> {
    const suppliersSnapshot = await db.collection(SUPPLIERS_COLLECTION).get();
    const suppliers = suppliersSnapshot.docs.map(docToSupplier);
    console.log(`Firestore: getSuppliers - Fetched ${suppliers.length} suppliers.`);
    return suppliers;
}

export async function getInventoryItems(filters?: { supplierName?: string; staffName?: string }): Promise<InventoryItem[]> {
    let q: FirebaseFirestore.Query = db.collection(INVENTORY_COLLECTION)
        .where('quantity', '>', 0)
        .orderBy('timestamp', 'desc');

    if (filters?.supplierName) {
        q = q.where('supplierName', '==', filters.supplierName);
    }
    if (filters?.staffName) {
        q = q.where('staffName', '==', filters.staffName);
    }
    
    const inventorySnapshot = await q.get();
    const items = inventorySnapshot.docs.map(docToInventoryItem);
    console.log(`Firestore: getInventoryItems - Fetched ${items.length} items.`);
    return items;
}


export async function getUniqueStaffNames(): Promise<string[]> {
    const inventorySnapshot = await db.collection(INVENTORY_COLLECTION).orderBy('staffName').get();
    const staffNames = new Set<string>();
    inventorySnapshot.docs.forEach(doc => {
        const name = doc.data().staffName;
        if (name) staffNames.add(name);
    });
    console.log(`Firestore: getUniqueStaffNames - Found ${staffNames.size} unique staff names.`);
    return Array.from(staffNames).sort((a,b) => a.localeCompare(b));
}

export async function getUniqueLocations(): Promise<string[]> {
    const inventorySnapshot = await db.collection(INVENTORY_COLLECTION).orderBy('location').get();
    const locations = new Set<string>();
    inventorySnapshot.docs.forEach(doc => {
        const loc = doc.data().location;
        if (loc) locations.add(loc);
    });
    console.log(`Firestore: getUniqueLocations - Found ${locations.size} unique locations.`);
    return Array.from(locations).sort((a,b) => a.localeCompare(b));
}

export async function getReturnedItems(): Promise<ReturnedItem[]> {
    const returnsSnapshot = await db.collection(RETURNS_LOG_COLLECTION).orderBy('returnTimestamp', 'desc').get();
    const items = returnsSnapshot.docs.map(docToReturnedItem);
    console.log(`Firestore: getReturnedItems - Fetched ${items.length} returned items.`);
    return items;
}

export async function addProduct(productData: { barcode: string; productName: string; supplierName: string }): Promise<Product | null> {
    try {
        const productRef = db.collection(PRODUCTS_COLLECTION).doc(productData.barcode);
        
        await db.runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (productDoc.exists) {
                // Update existing product if needed
                transaction.update(productRef, { 
                    productName: productData.productName,
                    supplierName: productData.supplierName,
                });
            } else {
                // Create new product
                transaction.set(productRef, {
                    productName: productData.productName,
                    supplierName: productData.supplierName,
                    createdAt: FieldValue.serverTimestamp()
                });
            }
        });

        // Also ensure supplier exists
        await addSupplier({ name: productData.supplierName });
        
        return {
            id: productData.barcode,
            ...productData,
            createdAt: new Date().toISOString()
        };
    } catch (error) {
        console.error("Firestore: Error in addProduct:", error);
        return null;
    }
}

export async function addSupplier(supplierData: { name: string }): Promise<{ supplier: Supplier | null; error?: string }> {
    const supplierName = supplierData.name.trim();
    const suppliersRef = db.collection(SUPPLIERS_COLLECTION);
    const q = suppliersRef.where('name', '==', supplierName).limit(1);
    const existing = await q.get();

    if (!existing.empty) {
        console.log(`Firestore: addSupplier - Supplier "${supplierName}" already exists.`);
        return { supplier: docToSupplier(existing.docs[0]) };
    }
    
    try {
        const docRef = await suppliersRef.add({
            name: supplierName,
            createdAt: FieldValue.serverTimestamp()
        });
        return { supplier: { id: docRef.id, name: supplierName, createdAt: new Date().toISOString() } };
    } catch (error) {
        console.error("Firestore: Critical error in addSupplier:", error);
        return { supplier: null, error: `Failed to add supplier: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
}

export async function getProductDetailsByBarcode(barcode: string): Promise<Product | null> {
    const productRef = db.collection(PRODUCTS_COLLECTION).doc(barcode);
    const productDoc = await productRef.get();
    if (!productDoc.exists) {
        console.warn(`Firestore: getProductDetailsByBarcode - Barcode ${barcode} not found.`);
        return null;
    }
    return docToProduct(productDoc);
}


export async function addInventoryItem(
  itemFormValues: AddInventoryItemFormValues,
  resolvedProductDetails: { productName: string; supplierName: string; }
): Promise<InventoryItem | null> {
    try {
        const docRef = await db.collection(INVENTORY_COLLECTION).add({
            barcode: itemFormValues.barcode.trim(),
            productName: resolvedProductDetails.productName,
            supplierName: resolvedProductDetails.supplierName,
            quantity: itemFormValues.quantity,
            expiryDate: itemFormValues.expiryDate ? Timestamp.fromDate(itemFormValues.expiryDate) : null,
            location: itemFormValues.location.trim(),
            staffName: itemFormValues.staffName.trim(),
            itemType: itemFormValues.itemType,
            timestamp: FieldValue.serverTimestamp(),
        });

        return {
            id: docRef.id,
            ...itemFormValues,
            ...resolvedProductDetails,
            expiryDate: itemFormValues.expiryDate?.toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
        };

    } catch (error) {
        console.error("Firestore: Critical error in addInventoryItem:", error);
        return null;
    }
}

export async function processReturn(itemId: string, quantityToReturn: number, staffNameProcessingReturn: string): Promise<{ success: boolean; message?: string }> {
    const itemRef = db.collection(INVENTORY_COLLECTION).doc(itemId);

    try {
        await db.runTransaction(async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) {
                throw new Error(`Item with ID ${itemId} not found.`);
            }

            const currentItem = docToInventoryItem(itemDoc);
            if (currentItem.quantity <= 0) {
                throw new Error(`Item ${currentItem.productName} has 0 quantity.`);
            }

            const actualReturnedQty = Math.min(quantityToReturn, currentItem.quantity);
            const newQuantity = currentItem.quantity - actualReturnedQty;

            if (newQuantity > 0) {
                transaction.update(itemRef, { quantity: newQuantity });
            } else {
                transaction.delete(itemRef);
            }

            // Log the return
            const returnLogRef = db.collection(RETURNS_LOG_COLLECTION).doc();
            transaction.set(returnLogRef, {
                originalInventoryItemId: itemId,
                productName: currentItem.productName,
                barcode: currentItem.barcode,
                supplierName: currentItem.supplierName,
                returnedQuantity: actualReturnedQty,
                expiryDate: currentItem.expiryDate ? Timestamp.fromDate(new Date(currentItem.expiryDate)) : null,
                location: currentItem.location,
                staffName: currentItem.staffName,
                itemType: currentItem.itemType,
                processedBy: staffNameProcessingReturn.trim(),
                returnTimestamp: FieldValue.serverTimestamp()
            });
        });
        return { success: true, message: `Return processed successfully for item ID ${itemId}.`};
    } catch (error: any) {
        console.error(`Firestore: Critical error in processReturn for ${itemId}:`, error);
        return { success: false, message: `Failed to process return: ${error.message}` };
    }
}


export async function updateSupplierNameAndReferences(currentName: string, newName: string): Promise<boolean> {
    const batch = db.batch();
    try {
        // 1. Find the supplier document to update its name
        const suppliersQuery = db.collection(SUPPLIERS_COLLECTION).where('name', '==', currentName);
        const suppliersSnapshot = await suppliersQuery.get();

        if (suppliersSnapshot.empty) {
            console.warn(`Firestore: updateSupplierName - No supplier found with name "${currentName}".`);
            // If you want this to be a "soft" failure, return true. If it's a hard failure, return false.
            return true; 
        }
        
        suppliersSnapshot.forEach(doc => {
            batch.update(doc.ref, { name: newName });
        });

        // 2. Find and update all products referencing this supplier
        const productsQuery = db.collection(PRODUCTS_COLLECTION).where('supplierName', '==', currentName);
        const productsSnapshot = await productsQuery.get();
        productsSnapshot.forEach(doc => {
            batch.update(doc.ref, { supplierName: newName });
        });

        // 3. Find and update all inventory items referencing this supplier
        const inventoryQuery = db.collection(INVENTORY_COLLECTION).where('supplierName', '==', currentName);
        const inventorySnapshot = await inventoryQuery.get();
        inventorySnapshot.forEach(doc => {
            batch.update(doc.ref, { supplierName: newName });
        });

        // 4. Find and update all return log entries referencing this supplier
        const returnsQuery = db.collection(RETURNS_LOG_COLLECTION).where('supplierName', '==', currentName);
        const returnsSnapshot = await returnsQuery.get();
        returnsSnapshot.forEach(doc => {
            batch.update(doc.ref, { supplierName: newName });
        });

        await batch.commit();
        console.log(`Firestore: Successfully updated supplier name from "${currentName}" to "${newName}" across all collections.`);
        return true;
    } catch (error) {
        console.error("Firestore: Critical error in updateSupplierNameAndReferences:", error);
        return false;
    }
}

export async function updateInventoryItemDetails(
  itemId: string,
  updates: { location?: string; expiryDate?: Date | null; itemType?: 'Expiry' | 'Damage', quantity?: number }
): Promise<boolean> {
    const itemRef = db.collection(INVENTORY_COLLECTION).doc(itemId);
    
    // Create a plain object for the update, filtering out any undefined values
    const updateData: {[key: string]: any} = {};
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.itemType !== undefined) updateData.itemType = updates.itemType;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;

    // Handle date conversion to Firestore Timestamp or null
    if (updates.expiryDate !== undefined) {
        updateData.expiryDate = updates.expiryDate ? Timestamp.fromDate(updates.expiryDate) : null;
    }

    if (Object.keys(updateData).length === 0) {
        console.log(`Firestore: updateInventoryItemDetails - No changes to update for item ${itemId}.`);
        return true;
    }

    try {
        await itemRef.update(updateData);
        console.log(`Firestore: Successfully updated details for item ${itemId}.`);
        return true;
    } catch (error) {
        console.error(`Firestore: Critical error in updateInventoryItemDetails for ${itemId}:`, error);
        return false;
    }
}


export async function updateProductAndSupplierLinks(barcode: string, newProductName: string, newSupplierName: string): Promise<boolean> {
    const batch = db.batch();
    try {
        const productRef = db.collection(PRODUCTS_COLLECTION).doc(barcode);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            console.error(`Firestore: updateProductAndSupplierLinks - Product with barcode ${barcode} not found.`);
            return false;
        }

        const oldProductName = productDoc.data()!.productName;
        const productNameChanged = oldProductName !== newProductName;

        // 1. Update the product document itself
        batch.update(productRef, {
            productName: newProductName,
            supplierName: newSupplierName
        });

        // 2. If product name changed, cascade update to other collections
        if (productNameChanged) {
            // Update inventory
            const inventoryQuery = db.collection(INVENTORY_COLLECTION).where('barcode', '==', barcode);
            const inventorySnapshot = await inventoryQuery.get();
            inventorySnapshot.forEach(doc => {
                batch.update(doc.ref, { productName: newProductName, supplierName: newSupplierName });
            });

            // Update returns log
            const returnsQuery = db.collection(RETURNS_LOG_COLLECTION).where('barcode', '==', barcode);
            const returnsSnapshot = await returnsQuery.get();
            returnsSnapshot.forEach(doc => {
                batch.update(doc.ref, { productName: newProductName, supplierName: newSupplierName });
            });
        }
        
        await batch.commit();
        console.log(`Firestore: Successfully updated product and links for barcode ${barcode}.`);
        return true;
    } catch (error) {
        console.error(`Firestore: Critical error in updateProductAndSupplierLinks for barcode ${barcode}:`, error);
        return false;
    }
}


export async function getInventoryLogEntriesByBarcode(barcode: string): Promise<InventoryItem[]> {
    const inventoryRef = db.collection(INVENTORY_COLLECTION);
    const q = inventoryRef.where('barcode', '==', barcode).orderBy('timestamp', 'desc');
    
    const snapshot = await q.get();
    const items = snapshot.docs.map(docToInventoryItem);
    console.log(`Firestore: getInventoryLogEntriesByBarcode - Found ${items.length} log entries for barcode ${barcode}.`);
    return items;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
        const [products, currentInventoryItems, suppliersList] = await Promise.all([
            db.collection(PRODUCTS_COLLECTION).get(),
            db.collection(INVENTORY_COLLECTION).where('quantity', '>', 0).get(),
            db.collection(SUPPLIERS_COLLECTION).get(),
        ]);
        
        const inventoryItems = currentInventoryItems.docs.map(docToInventoryItem);

        const totalProducts = products.size;
        const totalStockQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalSuppliers = suppliersList.size;
        
        let itemsExpiringSoon = 0;
        const today = startOfDay(new Date());
        const sevenDaysFromNow = addDays(today, 7);
        inventoryItems.forEach(item => {
            if (item.itemType === 'Expiry' && item.expiryDate) {
                try {
                    const expiry = startOfDay(parseISO(item.expiryDate));
                    if (isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, today)) {
                        itemsExpiringSoon++;
                    }
                } catch (e) {
                    console.warn(`Firestore: getDashboardMetrics - Could not parse expiry date '${item.expiryDate}' for item ID ${item.id}`);
                }
            }
        });
        
        const damagedItemsCount = inventoryItems.filter(item => item.itemType === 'Damage').length;
        
        const stockBySupplierMap = new Map<string, number>();
        inventoryItems.forEach(item => {
            const supplier = item.supplierName || "Unknown Supplier";
            stockBySupplierMap.set(supplier, (stockBySupplierMap.get(supplier) || 0) + item.quantity);
        });

        const stockBySupplier: StockBySupplier[] = Array.from(stockBySupplierMap.entries())
          .map(([name, totalStock]) => ({ name, totalStock }))
          .sort((a, b) => b.totalStock - a.totalStock);

        // Calculate daily changes
        const startOfToday = Timestamp.fromDate(startOfDay(new Date()));

        const addedTodayQuery = db.collection(INVENTORY_COLLECTION).where('timestamp', '>=', startOfToday);
        const returnedTodayQuery = db.collection(RETURNS_LOG_COLLECTION).where('returnTimestamp', '>=', startOfToday);

        const [addedSnapshot, returnedSnapshot] = await Promise.all([addedTodayQuery.get(), returnedTodayQuery.get()]);

        const quantityAddedToday = addedSnapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 0), 0);
        const quantityReturnedToday = returnedSnapshot.docs.reduce((sum, doc) => sum + (doc.data().returnedQuantity || 0), 0);

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

        return {
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
    } catch (error) {
        console.error("Firestore: Critical error in getDashboardMetrics:", error);
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
    }
}

export async function deleteInventoryItemById(itemId: string): Promise<boolean> {
    const itemRef = db.collection(INVENTORY_COLLECTION).doc(itemId);
    try {
        await itemRef.delete();
        console.log(`Firestore: Successfully deleted inventory item ${itemId}.`);
        return true;
    } catch (error) {
        console.error(`Firestore: Critical error deleting inventory item ${itemId}:`, error);
        return false;
    }
}


const PERMISSIONS_DOC_ID = 'accessControl';

export async function loadPermissions(): Promise<Permissions | null> {
    const permissionsRef = db.collection(SETTINGS_COLLECTION).doc(PERMISSIONS_DOC_ID);
    try {
        const docSnap = await permissionsRef.get();
        if (docSnap.exists) {
            console.log("Firestore: Successfully loaded permissions.");
            return docSnap.data()! as Permissions;
        }
        console.log("Firestore: Permissions document does not exist, will use defaults.");
        return null;
    } catch (error) {
        console.error("Firestore: Error loading permissions:", error);
        return null;
    }
}

export async function savePermissions(permissions: Permissions): Promise<boolean> {
    const permissionsRef = db.collection(SETTINGS_COLLECTION).doc(PERMISSIONS_DOC_ID);
    try {
        await db.runTransaction(async (transaction) => {
            transaction.set(permissionsRef, permissions);
        });
        console.log("Firestore: Successfully saved permissions.");
        return true;
    } catch (error) {
        console.error("Firestore: Error saving permissions:", error);
        return false;
    }
}
