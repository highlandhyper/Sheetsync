'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addProductSchema,
  addInventoryItemSchema,
  addSupplierSchema,
  editInventoryItemSchema,
  editSupplierSchema
} from '@/lib/schemas';
import {
  addProduct as dbAddProduct,
  getProductDetailsByBarcode,
  processReturn as dbProcessReturn,
  addSupplier as dbAddSupplier,
  updateSupplierNameAndReferences as dbUpdateSupplierName,
  updateInventoryItemDetails as dbUpdateInventoryItemDetails,
  updateProductAndSupplierLinks as dbUpdateProductAndSupplierLinks, 
  getDashboardMetrics,
  deleteInventoryItemById as dbDeleteInventoryItemById,
  loadPermissionsFromSheet,
  savePermissionsToSheet,
  getInventoryItems,
  getProducts,
  getSuppliers,
  getReturnedItems,
  getUniqueLocations,
  getUniqueStaffNames,
  getAuditLogs,
  logAuditEvent,
  loadSpecialRequestsFromSheet,
  saveSpecialRequestsToSheet,
  getInventoryLogEntriesByBarcode,
  addInventoryItemToSheet,
  saveStaffListToSheet,
  loadStaffListFromSheet,
  saveLocationListToSheet,
  getAppMetaData
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, ItemType, DashboardMetrics, Permissions, ReturnedItem, AuditLogEntry, SpecialEntryRequest } from '@/lib/types';
import { format, startOfDay } from 'date-fns';

const EXTERNAL_LOGGER_API = "https://script.google.com/macros/s/AKfycby__866_Y_0XFiaPPCUaX6U1oZK329Ek6SRg9iU4u-aq5ARhxmkTmIHq6gvTpxXMf-8Lw/exec";

export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

export async function fetchAllDataAction(): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
}>> {
  try {
    const [
      inventoryItems,
      products,
      returnedItems,
      auditLogs,
      meta
    ] = await Promise.all([
      getInventoryItems(),
      getProducts(),
      getReturnedItems(),
      getAuditLogs(),
      getAppMetaData()
    ]);

    const suppliers = await getSuppliers(products);

    return {
      success: true,
      data: {
        inventoryItems: inventoryItems || [],
        products: products || [],
        suppliers: suppliers || [],
        returnedItems: returnedItems || [],
        uniqueLocations: meta.locations || [],
        uniqueStaffNames: meta.staff || [],
        auditLogs: auditLogs || [],
        specialRequests: meta.specialRequests || [],
      }
    };
  } catch (error) {
    console.error("Error in fetchAllDataAction:", error);
    return { success: false, message: "Failed to fetch application data." };
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

    const parsedData = {
      ...rawFormData,
      quantity: rawFormData.quantity ? Number(rawFormData.quantity) : undefined,
      expiryDate: rawFormData.expiryDate ? new Date((rawFormData.expiryDate as string) + 'T12:00:00') : undefined,
    };

    const validationResult = addInventoryItemSchema.safeParse(parsedData);
    if (!validationResult.success) return { success: false, message: "Validation failed.", errors: validationResult.error.issues };
    
    const validatedItemData = validationResult.data;
    const productDetails = await getProductDetailsByBarcode(validatedItemData.barcode);
    if (!productDetails) return { success: false, message: "Product details not found in system." };

    let isSpecialEntry = false;
    if (validatedItemData.expiryDate) {
        const expiry = startOfDay(new Date(validatedItemData.expiryDate));
        const today = startOfDay(new Date());
        if (expiry <= today) isSpecialEntry = true;
    }
    
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
    if (!sheetWriteSuccess) {
        return { success: false, message: "Failed to write data to Google Sheet." };
    }

    fetch(EXTERNAL_LOGGER_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            isSpecial: isSpecialEntry,
            disableNotification: disableNotification,
            barcode: validatedItemData.barcode,
            identity: validatedItemData.staffName,
            type: validatedItemData.itemType,
            quantity: validatedItemData.quantity,
            expiryDate: rawFormData.expiryDate,
            location: validatedItemData.location,
            productName: productDetails.productName,
            timestamp: now.toISOString()
        })
    }).catch(err => console.warn("External logger failed:", err));

    await logAuditEvent(userEmail, 'LOG_INVENTORY', tempId, `Details: [Product: ${productDetails.productName}], [Qty: ${validatedItemData.quantity}], [Loc: ${validatedItemData.location}]${disableNotification ? ' (Silent Entry)' : ''}`);
    revalidatePath('/inventory');

    return {
      success: true,
      message: 'Inventory item logged successfully!',
      data: itemData,
    };
  } catch (error) {
    console.error("Action error:", error);
    return { success: false, message: "Failed to log item." };
  }
}

export async function fetchProductAction(barcode: string): Promise<ActionResponse<Product>> {
    try {
        const product = await getProductDetailsByBarcode(barcode);
        if (product) {
            return { success: true, data: product };
        }
        return { success: false, message: "Product not found in system." };
    } catch (e) {
        return { success: false, message: "Failed to fetch product." };
    }
}

export async function saveProductAction(prevState: any, formData: FormData): Promise<ActionResponse<Product>> {
    try {
        const data = Object.fromEntries(formData.entries());
        const editMode = data.editMode as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        
        if (editMode === 'create') {
            const product = await dbAddProduct(userEmail, data);
            revalidatePath('/products/list');
            return { success: true, message: "Product created successfully.", data: product as Product };
        } else {
            const oldProduct = await getProductDetailsByBarcode(data.barcode as string);
            const diffs: string[] = [];
            if (oldProduct) {
                if (data.productName !== oldProduct.productName) diffs.push(`Name: ${oldProduct.productName} -> ${data.productName}`);
                if (data.supplierName !== oldProduct.supplierName) diffs.push(`Supplier: ${oldProduct.supplierName} -> ${data.supplierName}`);
                if (data.costPrice && Number(data.costPrice) !== oldProduct.costPrice) diffs.push(`Cost: ${oldProduct.costPrice} -> ${data.costPrice}`);
            }
            await dbUpdateProductAndSupplierLinks(userEmail, data.barcode as string, data.productName as string, data.supplierName as string, data.costPrice ? parseFloat(data.costPrice as string) : undefined);
            await logAuditEvent(userEmail, 'UPDATE_PRODUCT', data.barcode as string, `Changes: ${diffs.join(', ')}`);
            revalidatePath('/products/list');
            const product = await getProductDetailsByBarcode(data.barcode as string);
            return { success: true, message: "Product updated successfully.", data: product as Product };
        }
    } catch (e) {
        return { success: false, message: "Failed to save product." };
    }
}

export async function updateInventoryItemAction(prevState: any, formData: FormData): Promise<ActionResponse<InventoryItem>> {
    try {
        const userEmail = formData.get('userEmail') as string || 'Admin';
        const itemId = formData.get('itemId') as string;
        const rawData = Object.fromEntries(formData.entries());
        const result = await dbUpdateInventoryItemDetails(userEmail, itemId, rawData);
        revalidatePath('/inventory');
        return { success: true, message: "Item updated successfully.", data: result as InventoryItem };
    } catch (e) {
        return { success: false, message: "Failed to update item." };
    }
}

export async function updateSpecialRequestsAction(requests: SpecialEntryRequest[]): Promise<ActionResponse> {
    try {
        const success = await saveSpecialRequestsToSheet(requests);
        if (success) {
            revalidatePath('/dashboard');
            return { success: true };
        }
        return { success: false, message: "Failed to save requests to sheet." };
    } catch (e) {
        return { success: false, message: "Error updating requests." };
    }
}

export async function saveStaffListAction(staff: string[]) {
    try {
        await saveStaffListToSheet(staff);
        revalidatePath('/settings');
        return { success: true };
    } catch (e) {
        return { success: false, message: "Failed to save staff list." };
    }
}

export async function saveLocationListAction(locations: string[]) {
    try {
        await saveLocationListToSheet(locations);
        revalidatePath('/settings');
        return { success: true };
    } catch (e) {
        return { success: false, message: "Failed to save location list." };
    }
}

export async function fetchDashboardMetricsAction() { return { success: true, data: await getDashboardMetrics() }; }
export async function getPermissionsAction() { return { success: true, data: await loadPermissionsFromSheet() }; }
export async function setPermissionsAction(p: any) { await savePermissionsToSheet(p); return { success: true }; }
export async function fetchAuditLogsAction() { return { success: true, data: await getAuditLogs() }; }
export async function fetchInventoryLogEntriesByBarcodeAction(b: string) { 
    return { success: true, data: await getInventoryLogEntriesByBarcode(b) }; 
}

export async function addProductAction(p: any, f: FormData) { return saveProductAction(p, f); }
export async function addSupplierAction(p: any, f: FormData) { return { success: true }; }
export async function editSupplierAction(p: any, f: FormData) { return { success: true }; }
export async function returnInventoryItemAction(e: string, i: string, q: number, s: string) { 
    await dbProcessReturn(e, i, q, s);
    revalidatePath('/inventory');
    return { success: true, message: "Return processed." }; 
}
export async function editInventoryItemAction(p: any, f: FormData) { return updateInventoryItemAction(p, f); }
export async function deleteInventoryItemAction(e: string, i: string) { 
    await dbDeleteInventoryItemById(e, i);
    revalidatePath('/inventory');
    return { success: true, message: "Item deleted." }; 
}
export async function bulkDeleteInventoryItemsAction(e: string, ids: string[]) { 
    for (const id of ids) await dbDeleteInventoryItemById(e, id);
    revalidatePath('/inventory');
    return { success: true, message: `${ids.length} items deleted.` }; 
}
export async function bulkReturnInventoryItemsAction(e: string, ids: string[], s: string, t: string, q?: number) { 
    for (const id of ids) await dbProcessReturn(e, id, q || 1, s);
    revalidatePath('/inventory');
    return { success: true, message: `${ids.length} returns processed.` }; 
}