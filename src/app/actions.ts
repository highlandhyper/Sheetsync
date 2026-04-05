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
  getAuditLogs,
  logAuditEvent,
  saveSpecialRequestsToSheet,
  addInventoryItemToSheet,
  saveStaffListToSheet,
  saveLocationListToSheet,
  getAppMetaData,
  getInventoryLogEntriesByBarcode,
  saveUserRegistryToSheet
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, DashboardMetrics, SpecialEntryRequest, AuditLogEntry, ReturnedItem, AppUser } from '@/lib/types';
import { format, startOfDay } from 'date-fns';

const EXTERNAL_LOGGER_API = "https://script.google.com/macros/s/AKfycby__866_Y_0XFiaPPCUaX6U1oZK329Ek6SRg9iU4u-aq5ARhxmkTmIHq6gvTpxXMf-8Lw/exec";

export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

export async function fetchUserRegistryAction(): Promise<ActionResponse<AppUser[]>> {
  try {
    const meta = await getAppMetaData();
    return { success: true, data: meta.users || [] };
  } catch (error) {
    return { success: false, message: "Registry fetch failed." };
  }
}

export async function fetchAllDataAction(): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
  users: AppUser[];
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

    return {
      success: true,
      data: {
        inventoryItems: inventoryItems || [],
        products: products || [],
        suppliers: suppliers || [],
        uniqueLocations: meta.locations || [],
        uniqueStaffNames: meta.staff || [],
        auditLogs: auditLogs || [],
        specialRequests: meta.specialRequests || [],
        users: meta.users || [],
      }
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
                'User-Agent': 'SheetSync - Inventory Management - Educational Prototype'
            }
        });
        
        if (!res.ok) {
            return { success: false, message: `Lookup failed with status ${res.status}` };
        }

        const data = await res.json();
        
        if (data.status === 1 && data.product) {
            return {
                success: true,
                data: {
                    image: data.product.image_url || data.product.image_front_url || data.product.image_small_url,
                    brand: data.product.brands,
                    name: data.product.product_name
                }
            };
        }
        
        return { success: false, message: "Product visual data not found in global registry." };
    } catch (e) {
        console.error("External lookup error:", e);
        return { success: false, message: "External lookup service unavailable." };
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
    revalidatePath('/dashboard');

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
        const barcode = data.barcode as string;
        const productName = data.productName as string;
        const supplierName = data.supplierName as string;
        const costPriceRaw = data.costPrice as string;
        const costPrice = costPriceRaw !== "" ? parseFloat(costPriceRaw) : undefined;
        
        if (editMode === 'create') {
            const product = await dbAddProduct(userEmail, { barcode, productName, supplierName, costPrice });
            revalidatePath('/products/list');
            return { success: true, message: "Product created successfully.", data: product as Product };
        } else {
            const success = await dbUpdateProductAndSupplierLinks(userEmail, barcode, productName, supplierName, costPrice);
            if (!success) return { success: false, message: "Product not found in sheet." };
            
            revalidatePath('/products/list');
            revalidatePath('/inventory');
            
            const updatedProduct = await getProductDetailsByBarcode(barcode);
            return { success: true, message: "Product updated successfully.", data: updatedProduct as Product };
        }
    } catch (e) {
        console.error("saveProductAction error:", e);
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
        revalidatePath('/dashboard');
        return { success: true, message: "Item updated successfully.", data: result as InventoryItem };
    } catch (e) {
        console.error("updateInventoryItemAction error:", e);
        return { success: false, message: "Failed to update item." };
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
        return { success: false, message: "Failed to save requests to sheet." };
    } catch (e) {
        console.error("updateSpecialRequestsAction error:", e);
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

export async function fetchDashboardMetricsAction() { 
    try {
        const data = await getDashboardMetrics();
        return { success: true, data }; 
    } catch (e) {
        console.error("fetchDashboardMetricsAction error:", e);
        return { success: false, message: "Metrics calculation failed." };
    }
}

export async function getPermissionsAction() { 
    try {
        const data = await loadPermissionsFromSheet();
        return { success: true, data };
    } catch (e) {
        return { success: false, message: "Permissions load failed." };
    }
}

export async function setPermissionsAction(p: any) { 
    try {
        await savePermissionsToSheet(p); 
        return { success: true }; 
    } catch (e) {
        return { success: false, message: "Permissions save failed." };
    }
}

export async function saveUserRegistryAction(users: AppUser[]) {
    try {
        await saveUserRegistryToSheet(users);
        return { success: true };
    } catch (e) {
        return { success: false, message: "Registry save failed." };
    }
}

export async function fetchAuditLogsAction() { 
    try {
        const data = await getAuditLogs();
        return { success: true, data }; 
    } catch (e) {
        return { success: false, message: "Logs fetch failed." };
    }
}

export async function fetchInventoryLogEntriesByBarcodeAction(b: string) { 
    try {
        const data = await getInventoryLogEntriesByBarcode(b);
        return { success: true, data }; 
    } catch (e) {
        return { success: false, message: "Barcode lookup failed." };
    }
}

export async function addSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse<Supplier>> {
    try {
        const data = Object.fromEntries(formData.entries());
        const name = data.supplierName as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        
        if (!name) return { success: false, message: "Name required." };
        
        await logAuditEvent(userEmail, 'REGISTER_SUPPLIER', name, `Supplier registered in system catalog.`);
        
        return { 
            success: true, 
            message: "Supplier registered. You can now assign products to this vendor.", 
            data: { id: `s_${Date.now()}`, name, createdAt: new Date().toISOString() } 
        };
    } catch (e) {
        return { success: false, message: "Failed to register supplier." };
    }
}

export async function editSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse> {
    try {
        const data = Object.fromEntries(formData.entries());
        const oldName = data.currentSupplierName as string;
        const newName = data.newSupplierName as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        
        if (!oldName || !newName) return { success: false, message: "Names required." };
        
        await dbUpdateSupplierName(userEmail, oldName, newName);
        revalidatePath('/suppliers');
        revalidatePath('/products/list');
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        
        return { success: true, message: "Supplier renamed successfully across all catalog products and inventory logs." };
    } catch (e) {
        console.error("editSupplierAction error:", e);
        return { success: false, message: "Failed to update supplier records." };
    }
}

export async function returnInventoryItemAction(e: string, i: string, q: number, s: string) { 
    try {
        await dbProcessReturn(e, i, q, s);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true, message: "Return processed." }; 
    } catch (err) {
        return { success: false, message: "Return failed." };
    }
}

export async function deleteInventoryItemAction(e: string, i: string) { 
    try {
        await dbDeleteInventoryItemById(e, i);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true, message: "Item deleted." }; 
    } catch (err) {
        return { success: false, message: "Delete failed." };
    }
}

export async function bulkDeleteInventoryItemsAction(e: string, ids: string[]) { 
    try {
        for (const id of ids) {
            await dbDeleteInventoryItemById(e, id);
        }
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true, message: `${ids.length} items deleted.` }; 
    } catch (err) {
        return { success: false, message: "Bulk delete failed." };
    }
}

export async function bulkReturnInventoryItemsAction(e: string, ids: string[], s: string, t: string, q?: number) { 
    try {
        for (const id of ids) {
            const quantityToReturn = t === 'all' ? undefined : q;
            await dbProcessReturn(e, id, quantityToReturn, s);
        }
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true, message: `${ids.length} returns processed.` }; 
    } catch (err) {
        return { success: false, message: "Bulk return failed." };
    }
}
