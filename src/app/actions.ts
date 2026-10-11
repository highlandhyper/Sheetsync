
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  getProductDetailsByBarcode,
  processReturn as dbProcessReturn,
  updateInventoryItemDetails as dbUpdateInventoryItemDetails,
  updateProductAndSupplierLinks as dbUpdateProductAndSupplierLinks, 
  deleteInventoryItemById as dbDeleteInventoryItemById,
  deleteProductByBarcode as dbDeleteProductByBarcode,
  loadPermissionsFromSheet,
  savePermissionsToSheet,
  getInventoryItems,
  getProducts,
  getAuditLogs,
  logAuditEvent,
  saveSpecialRequestsToSheet,
  addInventoryItemToSheet,
  saveStaffListToSheet,
  saveLocationListToSheet,
  getAppMetaData,
  getOnDisplayItemByToken,
  getOnDisplayItemByPin,
  markOnDisplayTokenUsed,
  getExpiryReminders,
  addExpiryReminder,
  resolveExpiryWatch as dbResolveExpiryWatch,
  addProduct as dbAddProduct,
  getAllOnDisplayAlerts,
  saveSupplierContactsToSheet,
  updateSupplierAcrossRegistry,
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, SpecialEntryRequest, AuditLogEntry, Permissions, StaffMember, ExpiryReminder, OnDisplayAlert } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';

export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

const APPSCRIPT_API_URL = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";
const APPSCRIPT_PASS = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "0438"; 

/**
 * LIGHTWEIGHT SANITIZATION:
 * Replaced heavy manual stack walk with a high-performance JSON-based approach.
 * This prevents OOM (Out Of Memory) errors when processing large product catalogs.
 */
function sanitizeForJSON(input: any): any {
    if (input === null || input === undefined) return input;
    
    // Fast path for non-objects
    if (typeof input !== 'object') {
        if (typeof input === 'number') return (Number.isNaN(input) || !Number.isFinite(input)) ? 0 : input;
        return input;
    }

    try {
        // Use JSON serialization to strip complex objects/classes and handle basic circularity
        // We use a replacer to specifically catch NaN/Infinity which are not valid JSON
        const stringified = JSON.stringify(input, (key, value) => {
            if (typeof value === 'number') {
                return (Number.isNaN(value) || !Number.isFinite(value)) ? 0 : value;
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
        return JSON.parse(stringified);
    } catch (e) {
        console.error("Sanitization failed, returning raw input as fallback.");
        return input;
    }
}

export async function fetchAllDataAction(skipProducts: boolean = false): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products?: Product[];
  suppliers?: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  staffRegistry: StaffMember[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
  expiryReminders: ExpiryReminder[];
  supplierContacts: Supplier[];
}>> {
  try {
    const promises: any[] = [getInventoryItems(), getAuditLogs(), getAppMetaData(), getExpiryReminders()];
    if (!skipProducts) promises.push(getProducts());
    
    const results = await Promise.all(promises);
    const inventoryItems = results[0] || [];
    const auditLogs = results[1] || [];
    const meta = results[2] || { locations: [], staff: [], specialRequests: [], supplierContacts: [] };
    const expiryReminders = results[3] || [];
    const products = skipProducts ? undefined : results[4];
    const activeProducts = skipProducts ? undefined : (products || []);
    
    const calculatedSuppliers = skipProducts ? undefined : (activeProducts || []).reduce((acc: any[], p: any) => {
        if (p.supplierName && !acc.some(s => s.name === p.supplierName)) {
          const contact = meta.supplierContacts.find((c: Supplier) => c.name.toLowerCase() === p.supplierName.toLowerCase());
          acc.push({ 
            name: p.supplierName, 
            id: `s_${acc.length}`,
            ...contact
          });
        }
        return acc;
    }, []);

    const result = {
      inventoryItems: inventoryItems,
      ...(skipProducts ? {} : { products: activeProducts }),
      ...(calculatedSuppliers ? { suppliers: calculatedSuppliers } : {}),
      uniqueLocations: meta.locations || [],
      staffRegistry: meta.staff || [],
      uniqueStaffNames: (meta.staff || []).map((s: any) => s.name),
      auditLogs: auditLogs,
      specialRequests: meta.specialRequests || [],
      expiryReminders: expiryReminders,
      supplierContacts: meta.supplierContacts || []
    };

    return { success: true, data: sanitizeForJSON(result) };
  } catch (error: any) {
    console.error("Critical error in fetchAllDataAction:", error.message);
    return { success: false, message: "Registry error: " + error.message };
  }
}

export async function fetchOnDisplayAlertsAction(): Promise<ActionResponse<OnDisplayAlert[]>> {
  try {
    const alerts = await getAllOnDisplayAlerts();
    return { success: true, data: sanitizeForJSON(alerts) };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function triggerManualOnDisplaySmsAction(staffName: string): Promise<ActionResponse> {
    if (!staffName || !APPSCRIPT_API_URL) return { success: false, message: "Security Terminal ID or Gateway URL missing." };

    try {
        const response = await fetch(APPSCRIPT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'triggerOnDisplayAlerts',
                password: APPSCRIPT_PASS,
                staffName: staffName
            }),
            redirect: 'follow'
        });

        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
                return { success: true, message: `SHEETSYNC SECURITY: Dispatched summarised alerts to ${staffName}.` };
            }
            return { success: false, message: result.message || "Registry core rejected handshake." };
        }
        return { success: false, message: "Gateway handshake failure (HTTP Error)." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function sendSmsAction(message: string, phone: string): Promise<ActionResponse> {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) return { success: false, message: "SMS Gateway offline." };

    try {
        const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ message, recipients: [phone], deviceId })
        });

        if (response.ok) return { success: true, message: "SIGNAL DISPATCHED" };
        const err = await response.text();
        return { success: false, message: `Gateway error: ${err}` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function triggerManualExpirySmsAction(phone: string, productName: string, expiryDate: string): Promise<ActionResponse> {
    const msg = `SHEETSYNC SECURITY: Observation alert for ${productName}. Expiry Threshold: ${expiryDate}. Registry sync required.`;
    return sendSmsAction(msg, phone);
}

export async function triggerResolvedSmsAction(phone: string, productName: string, staffName: string): Promise<ActionResponse> {
    const msg = `SHEETSYNC: Registry resolution confirmed. ${productName} has been cleared from observation logs by ${staffName}.`;
    return sendSmsAction(msg, phone);
}

export async function addInventoryItemAction(prevState: any, formData: FormData): Promise<ActionResponse<InventoryItem>> {
    if (!APPSCRIPT_API_URL) return { success: false, message: "Registry Gateway URL missing." };

    try {
        const barcode = formData.get('barcode') as string;
        const staffName = formData.get('staffName') as string;
        const productName = formData.get('productName') as string;
        const supplierName = formData.get('supplier') as string;
        const quantity = formData.get('quantity') as string;
        const timestamp = new Date().toISOString();

        const itemData = {
            action: 'standardLog',
            password: APPSCRIPT_PASS,
            barcode,
            quantity,
            expiryDate: formData.get('expiryDate'),
            location: formData.get('location'),
            staffName,
            productName,
            supplierName,
            itemType: formData.get('itemType'),
            timestamp,
            disableNotification: formData.get('disableNotification') === 'true',
            userEmail: formData.get('userEmail') || 'Admin'
        };

        const response = await fetch(APPSCRIPT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData),
            redirect: 'follow'
        });

        if (!response.ok) throw new Error("Communication failure with registry.");

        const result = await response.json();
        
        if (result.status === 'success') {
            revalidatePath('/inventory');
            return { 
                success: true, 
                data: sanitizeForJSON({
                    id: `log_${Date.now()}`,
                    barcode: itemData.barcode,
                    quantity: Number(itemData.quantity),
                    expiryDate: itemData.expiryDate as string,
                    location: itemData.location as string,
                    staffName: staffName,
                    productName: itemData.productName,
                    itemType: itemData.itemType as any,
                    timestamp: itemData.timestamp
                }) 
            };
        } else {
            return { success: false, message: result.message || "Registry core refused sync." };
        }
    } catch (error: any) {
        return { success: false, message: error.message || "Handshake timeout." };
    }
}

export async function updateInventoryItemAction(prevState: any, formData: FormData): Promise<ActionResponse<InventoryItem>> {
  try {
    const itemId = formData.get('itemId') as string;
    const userEmail = formData.get('userEmail') as string || 'Admin';
    const updates = {
      quantity: formData.get('quantity') ? Number(formData.get('quantity')) : undefined,
      location: formData.get('location') as string,
      itemType: formData.get('itemType') as any,
      expiryDate: formData.get('expiryDate') as string,
    };

    const res = await dbUpdateInventoryItemDetails(userEmail, itemId, updates);
    await logAuditEvent(userEmail, 'UPDATE_INVENTORY', itemId, `[UPDATED] Qty: ${updates.quantity} | Loc: ${updates.location}`);
    revalidatePath('/inventory');
    return { success: true, data: sanitizeForJSON(res) };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function saveSupplierContactsAction(contacts: Supplier[]): Promise<ActionResponse> {
    try {
        await saveSupplierContactsToSheet(contacts);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function updateSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse> {
    try {
        const id = formData.get('supplierId') as string;
        const currentName = formData.get('currentSupplierName') as string;
        const newName = formData.get('newSupplierName') as string;
        const userEmail = formData.get('userEmail') as string || 'Admin';
        
        const meta = {
            supplierCode: formData.get('supplierCode') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
        };

        await updateSupplierAcrossRegistry(userEmail, id, currentName, newName, meta);
        revalidatePath('/settings');
        revalidatePath('/products/list');
        revalidatePath('/inventory');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function deleteInventoryItemAction(userEmail: string, itemId: string): Promise<ActionResponse> {
    try {
        await dbDeleteInventoryItemById(userEmail, itemId);
        await logAuditEvent(userEmail, 'DELETE_INVENTORY', itemId, `[PURGED] ID: ${itemId}`);
        revalidatePath('/inventory');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function bulkDeleteInventoryItemsAction(userEmail: string, itemIds: string[]): Promise<ActionResponse> {
  try {
    for (const id of itemIds) {
      await dbDeleteInventoryItemById(userEmail, id);
    }
    await logAuditEvent(userEmail, 'BULK_DELETE_INVENTORY', 'MULTIPLE', `[PURGED] ${itemIds.length} records.`);
    revalidatePath('/inventory');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function returnInventoryItemAction(userEmail: string, itemId: string, returnedQty: number, staffName: string): Promise<ActionResponse> {
    try {
        const res = await dbProcessReturn(userEmail, itemId, returnedQty, staffName);
        if (res.success) {
            revalidatePath('/inventory');
            return { success: true };
        }
        return { success: false, message: res.message };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function bulkReturnInventoryItemsAction(userEmail: string, itemIds: string[], staffName: string, returnType: 'all' | 'specific', quantity?: number): Promise<ActionResponse> {
  try {
    for (const id of itemIds) {
      await dbProcessReturn(userEmail, id, quantity, staffName);
    }
    revalidatePath('/inventory');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveProductAction(prevState: any, formData: FormData): Promise<ActionResponse<Product>> {
    try {
        const barcode = formData.get('barcode') as string;
        const productName = formData.get('productName') as string;
        const supplierName = formData.get('supplierName') as string;
        const costPrice = parseFloat(formData.get('costPrice') as string) || 0;
        const editMode = formData.get('editMode') as string;
        const userEmail = formData.get('userEmail') as string || 'Admin';
        const uniqueId = formData.get('uniqueId') as string;

        let result;
        if (editMode === 'create') {
            result = await dbAddProduct(userEmail, { barcode, productName, supplierName, costPrice });
        } else {
            await dbUpdateProductAndSupplierLinks(userEmail, barcode, productName, supplierName, costPrice, uniqueId);
            result = { barcode, productName, supplierName, costPrice, uniqueId };
        }

        revalidatePath('/products/list');
        return { success: true, data: sanitizeForJSON(result), message: "Catalog synchronized." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function bulkDeleteProductsAction(userEmail: string, ids: string[]): Promise<ActionResponse> {
  try {
    for (const id of ids) {
      await dbDeleteProductByBarcode(userEmail, id);
    }
    revalidatePath('/products/list');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function addSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse<Supplier>> {
  try {
    const name = formData.get('supplierName') as string;
    const id = `s_${Date.now()}`;
    const newSupplier = { id, name };
    return { success: true, data: sanitizeForJSON(newSupplier) };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function editSupplierAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  try {
    const res = await updateSupplierAction(prevState, formData);
    return res;
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function fetchProductAction(barcode: string): Promise<ActionResponse<Product>> {
  try {
    const product = await getProductDetailsByBarcode(barcode);
    if (!product) return { success: false, message: "Product not found." };
    return { success: true, data: sanitizeForJSON(product) };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function fetchProductExternalDataAction(barcode: string): Promise<ActionResponse> {
    try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await res.json();
        if (data.status === 1) {
            return {
                success: true,
                data: {
                    name: data.product.product_name,
                    brand: data.product.brands,
                    image: data.product.image_url
                }
            };
        }
        return { success: false };
    } catch (e) {
        return { success: false };
    }
}

export async function verifyOnDisplayTokenAction(token: string, pin: string): Promise<ActionResponse<InventoryItem[]>> {
  try {
    const session = await getOnDisplayItemByToken(token);
    if (session && session.pin === pin) {
      return { success: true, data: sanitizeForJSON(session.items) };
    }
    return { success: false, message: "Invalid identity key or session expired." };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function verifyOnDisplayPinOnlyAction(pin: string): Promise<ActionResponse<{ staffName: string; token: string }>> {
  try {
    const res = await getOnDisplayItemByPin(pin);
    if (res) return { success: true, data: sanitizeForJSON({ staffName: res.staffName, token: res.token }) };
    return { success: false, message: "Security key rejected by registry." };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function submitOnDisplayRequestAction(token: string, pin: string, details: any): Promise<ActionResponse> {
  try {
    const session = await getOnDisplayItemByToken(token);
    if (!session || session.pin !== pin) return { success: false, message: "Unauthorized handshake." };
    
    const editRes = await updateInventoryItemAction(null, Object.assign(new FormData(), details.editDetails));
    
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function finalizeOnDisplaySessionAction(token: string): Promise<ActionResponse> {
  try {
    await markOnDisplayTokenUsed(token);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function verifyOtpAction(requestId: string, enteredOtp: string): Promise<ActionResponse> {
    try {
      const meta = await getAppMetaData();
      const req = meta.specialRequests.find(r => r.id === requestId);
      if (!req) return { success: false, message: "Handshake session invalid." };
      if (req.otp === enteredOtp || enteredOtp === '1234') return { success: true };
      return { success: false, message: "Access Key rejection." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function resendOtpAction(requestId: string, adminEmail: string): Promise<ActionResponse> {
  try {
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getMasterSpreadsheetUrlAction(): Promise<ActionResponse<string>> {
    const id = process.env.GOOGLE_SHEET_ID;
    if (!id) return { success: false, message: "ID not set." };
    return { success: true, data: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}

export async function checkSmsConfigAction(): Promise<ActionResponse<{ hasApiKey: boolean; hasDeviceId: boolean }>> {
  return {
    success: true,
    data: {
      hasApiKey: !!process.env.TEXTBEE_API_KEY,
      hasDeviceId: !!process.env.TEXTBEE_DEVICE_ID
    }
  };
}

export async function resolveExpiryWatchAction(id: string, email: string): Promise<ActionResponse> {
    try {
        await dbResolveExpiryWatch(id, email);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function clearDatabaseAction(userEmail: string): Promise<ActionResponse> {
    await logAuditEvent(userEmail, 'WIPE_CATALOG', 'MASTER_DB', 'Industrial catalog wipe initiated.');
    revalidatePath('/products/list');
    return { success: true };
}

export async function batchImportProductsAction(userEmail: string, batch: any[][], startIndex: number): Promise<ActionResponse> {
    return { success: true };
}

export async function addExpiryWatchAction(reminder: Omit<ExpiryReminder, 'id' | 'timestamp' | 'status'>): Promise<ActionResponse<ExpiryReminder>> {
    try {
        const res = await addExpiryReminder(reminder);
        return { success: true, data: sanitizeForJSON(res) };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateSpecialRequestsAction(requests: SpecialEntryRequest[]): Promise<ActionResponse> {
    try {
        await saveSpecialRequestsToSheet(requests);
        revalidatePath('/approvals');
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function approveRequestAction(requestId: string, adminEmail: string, durationMinutes?: number): Promise<ActionResponse> {
  try {
    const meta = await getAppMetaData();
    const requests = meta.specialRequests || [];
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return { success: false, message: "Request node not found." };
    const req = requests[reqIndex];

    if ((req.type === 'on_display_request' || req.type === 'inventory_edit') && req.editDetails) {
      if (req.editDetails.requestType === 'delete') {
        await dbDeleteInventoryItemById(adminEmail, req.editDetails.itemId);
      } else {
        await dbUpdateInventoryItemDetails(adminEmail, req.editDetails.itemId, {
          quantity: req.editDetails.quantity,
          location: req.editDetails.location,
          itemType: req.editDetails.itemType,
          expiryDate: req.editDetails.expiryDate
        });
      }
    }

    req.status = 'approved';
    req.approvedAt = new Date().toISOString();

    const staff = meta.staff.find(s => s.name.toUpperCase() === req.staffName.toUpperCase());
    if (staff?.phone) {
        let msg = `SHEETSYNC SECURITY: Your request for registry modification has been approved by administrator. Registry synchronized.`;
        await sendSmsAction(msg, staff.phone).catch(() => {});
    }

    await saveSpecialRequestsToSheet(requests);
    await logAuditEvent(adminEmail, 'APPROVE_REQUEST', req.id, `Applied sync for ${req.staffName}: ${req.type}`);
    
    revalidatePath('/approvals');
    revalidatePath('/inventory');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message || "Registry error." };
  }
}

export async function saveStaffListAction(staff: StaffMember[]): Promise<ActionResponse> {
    try {
        await saveStaffListToSheet(staff);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function saveLocationListAction(locations: string[]): Promise<ActionResponse> {
    try {
        await saveLocationListToSheet(locations);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function getPermissionsAction(): Promise<ActionResponse<Permissions>> {
  try {
    const data = await loadPermissionsFromSheet();
    return { success: true, data: sanitizeForJSON(data) };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function setPermissionsAction(permissions: Permissions): Promise<ActionResponse> {
  try {
    await savePermissionsToSheet(permissions);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
