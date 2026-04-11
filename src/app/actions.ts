'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addInventoryItemSchema,
} from '@/lib/schemas';
import {
  addProduct as dbAddProduct,
  getProductDetailsByBarcode,
  processReturn as dbProcessReturn,
  updateSupplierNameAndReferences as dbUpdateSupplierName,
  updateInventoryItemDetails as dbUpdateInventoryItemDetails,
  updateProductAndSupplierLinks as dbUpdateProductAndSupplierLinks, 
  getDashboardMetrics,
  deleteInventoryItemById as dbDeleteInventoryItemById,
  deleteProductByBarcode as dbDeleteProductByBarcode,
  deleteProductsByBarcodes as dbDeleteProductsByBarcodes,
  loadPermissionsFromSheet,
  savePermissionsToSheet,
  getInventoryItems,
  getProducts,
  getSuppliers,
  getAuditLogs,
  logAuditEvent,
  saveSpecialRequestsToSheet,
  addInventoryItemToSheet,
  saveStaffListToSheet,
  saveLocationListToSheet,
  getAppMetaData,
  getInventoryLogEntriesByBarcode
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, DashboardMetrics, SpecialEntryRequest, AuditLogEntry } from '@/lib/types';
import { format } from 'date-fns';

export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

/**
 * CRITICAL: Ensures numeric values are valid for JSON serialization.
 * Next.js Server Actions crash if NaN is returned.
 */
function sanitizeForJSON(val: any) {
    if (typeof val === 'number') {
        return isNaN(val) ? undefined : val;
    }
    if (Array.isArray(val)) {
        return val.map(sanitizeForJSON);
    }
    if (val !== null && typeof val === 'object') {
        const sanitized: any = {};
        for (const key in val) {
            sanitized[key] = sanitizeForJSON(val[key]);
        }
        return sanitized;
    }
    return val;
}

export async function fetchAllDataAction(): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
}>> {
  try {
    const [
      inventoryItems,
      products,
      auditLogs,
      meta
    ] = await Promise.all([
      getInventoryItems(),
      getProducts(),
      getAuditLogs(), 
      getAppMetaData()
    ]);

    const suppliers = await getSuppliers(products);

    const result = {
      inventoryItems: inventoryItems || [],
      products: products || [],
      suppliers: suppliers || [],
      uniqueLocations: meta.locations || [],
      uniqueStaffNames: meta.staff || [],
      auditLogs: auditLogs || [],
      specialRequests: meta.specialRequests || [],
    };

    return {
      success: true,
      data: sanitizeForJSON(result)
    };
  } catch (error) {
    console.error("Error in fetchAllDataAction:", error);
    return { success: false, message: "Failed to fetch application data." };
  }
}

export async function fetchProductExternalDataAction(barcode: string): Promise<ActionResponse<{ image?: string; brand?: string; name?: string }>> {
    if (!barcode) return { success: false, message: "Barcode required." };
    
    try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`, { 
            next: { revalidate: 3600 },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'SheetSync - Inventory Management'
            }
        });
        
        if (!res.ok) {
            return { success: false, message: `Lookup failed with status ${res.status}` };
        }

        const data = await res.json();
        
        if (data.status === 1 && data.product) {
            return {
                success: true,
                data: sanitizeForJSON({
                    image: data.product.image_url || data.product.image_front_url || data.product.image_small_url,
                    brand: data.product.brands,
                    name: data.product.product_name
                })
            };
        }
        
        return { success: false, message: "Product visual data not found." };
    } catch (e) {
        console.error("External lookup error:", e);
        return { success: false, message: "Lookup service unavailable." };
    }
}

export async function addInventoryItemAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<InventoryItem>> {
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const userEmail = formData.get('userEmail') as string || 'Unknown User';
    const disableNotification = formData.get('disableNotification') === 'true';

    const rawQty = rawFormData.quantity ? Number(rawFormData.quantity) : undefined;
    const qty = (rawQty !== undefined && !isNaN(rawQty)) ? rawQty : 0;

    const parsedData = {
      ...rawFormData,
      quantity: qty,
      expiryDate: rawFormData.expiryDate ? new Date((rawFormData.expiryDate as string) + 'T12:00:00') : undefined,
    };

    const validationResult = addInventoryItemSchema.safeParse(parsedData);
    if (!validationResult.success) return { success: false, message: "Validation failed.", errors: validationResult.error.issues };
    
    const validatedItemData = validationResult.data;
    const productDetails = await getProductDetailsByBarcode(validatedItemData.barcode);
    if (!productDetails) return { success: false, message: "Product not found." };

    const now = new Date();
    const tempId = `log_${now.getTime()}`;

    const itemData: InventoryItem = {
        id: tempId,
        barcode: validatedItemData.barcode,
        quantity: validatedItemData.quantity,
        expiryDate: validatedItemData.expiryDate ? format(validatedItemData.expiryDate, 'yyyy-MM-dd') : undefined,
        location: validatedItemData.location,
        staffName: validatedItemData.staffName,
        productName: productDetails.productName,
        supplierName: productDetails.supplierName,
        itemType: validatedItemData.itemType,
        timestamp: now.toISOString()
    };

    const sheetWriteSuccess = await addInventoryItemToSheet(itemData);
    if (!sheetWriteSuccess) return { success: false, message: "Write failed." };

    await logAuditEvent(userEmail, 'LOG_INVENTORY', tempId, `Product: ${productDetails.productName}${disableNotification ? ' (Silent)' : ''}`);
    revalidatePath('/inventory');
    revalidatePath('/dashboard');

    return { success: true, message: 'Logged successfully!', data: sanitizeForJSON(itemData) };
  } catch (error) {
    return { success: false, message: "Log failed." };
  }
}

export async function fetchProductAction(barcode: string): Promise<ActionResponse<Product>> {
    try {
        const product = await getProductDetailsByBarcode(barcode);
        if (product) {
            return { 
                success: true, 
                data: sanitizeForJSON(product)
            };
        }
        return { success: false, message: "Not found." };
    } catch (e) {
        return { success: false, message: "Fetch failed." };
    }
}

export async function saveProductAction(prevState: any, formData: FormData): Promise<ActionResponse<Product>> {
    try {
        const data = Object.fromEntries(formData.entries());
        const editMode = data.editMode as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        const barcode = data.barcode as string;
        const productName = data.productName as string;
        const supplierName = data.supplierName as string;
        const uniqueId = data.uniqueId as string;
        
        const rawCost = data.costPrice as string;
        let costPrice: number | undefined = undefined;
        
        if (rawCost !== undefined && rawCost !== '' && rawCost !== 'undefined') {
            const parsed = parseFloat(rawCost);
            if (!isNaN(parsed)) {
                costPrice = parsed;
            }
        }
        
        if (editMode === 'create') {
            const product = await dbAddProduct(userEmail, { barcode, productName, supplierName, costPrice });
            revalidatePath('/products/list');
            return { 
                success: true, 
                message: "Created successfully.", 
                data: sanitizeForJSON(product)
            };
        } else {
            const success = await dbUpdateProductAndSupplierLinks(userEmail, barcode, productName, supplierName, costPrice, uniqueId);
            if (!success) return { success: false, message: "Product not found in registry." };
            
            revalidatePath('/products/list');
            revalidatePath('/inventory');
            
            return { 
                success: true, 
                message: "Catalog updated successfully.", 
                data: sanitizeForJSON({
                    id: uniqueId || barcode,
                    barcode,
                    productName,
                    supplierName,
                    costPrice,
                    uniqueId
                })
            };
        }
    } catch (e) {
        console.error("saveProductAction error:", e);
        return { success: false, message: "Registry sync failed." };
    }
}

export async function deleteProductAction(email: string, identifier: string) {
    try {
        const success = await dbDeleteProductByBarcode(email, identifier);
        revalidatePath('/products/list');
        return { success };
    } catch (e) {
        return { success: false };
    }
}

export async function bulkDeleteProductsAction(email: string, identifiers: string[]) {
    try {
        const success = await dbDeleteProductsByBarcodes(email, identifiers);
        revalidatePath('/products/list');
        return { success };
    } catch (e) {
        console.error("Bulk delete action error:", e);
        return { success: false };
    }
}

export async function updateInventoryItemAction(prevState: any, formData: FormData): Promise<ActionResponse<InventoryItem>> {
    try {
        const userEmail = formData.get('userEmail') as string || 'Admin';
        const itemId = formData.get('itemId') as string;
        const rawData = Object.fromEntries(formData.entries());
        
        if (rawData.quantity) {
            const q = Number(rawData.quantity);
            rawData.quantity = isNaN(q) ? '0' : String(q);
        }

        const result = await dbUpdateInventoryItemDetails(userEmail, itemId, rawData);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true, message: "Updated.", data: sanitizeForJSON(result) };
    } catch (e) {
        return { success: false, message: "Update failed." };
    }
}

export async function updateSpecialRequestsAction(requests: SpecialEntryRequest[]): Promise<ActionResponse> {
    try {
        const success = await saveSpecialRequestsToSheet(requests);
        if (success) {
            revalidatePath('/dashboard');
            revalidatePath('/approvals');
            return { success: true };
        }
        return { success: false };
    } catch (e) {
        return { success: false };
    }
}

export async function saveStaffListAction(staff: string[]) {
    try {
        await saveStaffListToSheet(staff);
        revalidatePath('/settings');
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

export async function saveLocationListAction(locations: string[]) {
    try {
        await saveLocationListToSheet(locations);
        revalidatePath('/settings');
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

export async function fetchDashboardMetricsAction() { 
    try {
        const data = await getDashboardMetrics();
        return { success: true, data: sanitizeForJSON(data) }; 
    } catch (e) {
        return { success: false };
    }
}

export async function getPermissionsAction() { 
    try {
        const data = await loadPermissionsFromSheet();
        return { success: true, data: sanitizeForJSON(data) };
    } catch (e) {
        return { success: false };
    }
}

export async function setPermissionsAction(p: any) { 
    try {
        await savePermissionsToSheet(p); 
        return { success: true }; 
    } catch (e) {
        return { success: false };
    }
}

export async function fetchAuditLogsAction() { 
    try {
        const data = await getAuditLogs();
        return { success: true, data: sanitizeForJSON(data) }; 
    } catch (e) {
        return { success: false };
    }
}

export async function fetchInventoryLogEntriesByBarcodeAction(b: string) { 
    try {
        const data = await getInventoryLogEntriesByBarcode(b);
        return { success: true, data: sanitizeForJSON(data) }; 
    } catch (e) {
        return { success: false };
    }
}

export async function addSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse<Supplier>> {
    try {
        const data = Object.fromEntries(formData.entries());
        const name = data.supplierName as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        if (!name) return { success: false, message: "Name required." };
        await logAuditEvent(userEmail, 'REGISTER_SUPPLIER', name, `Registered.`);
        const supplier = { id: `s_${Date.now()}`, name, createdAt: new Date().toISOString() };
        return { success: true, data: sanitizeForJSON(supplier) };
    } catch (e) {
        return { success: false };
    }
}

export async function editSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse> {
    try {
        const data = Object.fromEntries(formData.entries());
        const oldName = data.currentSupplierName as string;
        const newName = data.newSupplierName as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        await dbUpdateSupplierName(userEmail, oldName, newName);
        revalidatePath('/suppliers');
        revalidatePath('/products/list');
        revalidatePath('/inventory');
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

export async function returnInventoryItemAction(e: string, i: string, q: number, s: string) { 
    try {
        await dbProcessReturn(e, i, q, s);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}

export async function deleteInventoryItemAction(e: string, i: string) { 
    try {
        await dbDeleteInventoryItemById(e, i);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}

export async function bulkDeleteInventoryItemsAction(e: string, ids: string[]) { 
    try {
        for (const id of ids) await dbDeleteInventoryItemById(e, id);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}

export async function bulkReturnInventoryItemsAction(e: string, ids: string[], s: string, t: string, q?: number) { 
    try {
        for (const id of ids) {
            const qty = t === 'all' ? undefined : q;
            await dbProcessReturn(e, id, qty, s);
        }
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}