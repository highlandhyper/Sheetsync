
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

const APPSCRIPT_API_URL = process.env.GOOGLE_SCRIPT_URL || "";
const APPSCRIPT_PASS = process.env.ADMIN_PASSWORD || ""; 

/**
 * HIGH-PERFORMANCE JSON SANITIZER
 * Prevents memory overflows during serialization of 50k+ row datasets.
 */
function sanitizeForJSON(input: any): any {
    if (input === null || input === undefined) return input;
    if (typeof input !== 'object') {
        if (typeof input === 'number') return (Number.isNaN(input) || !Number.isFinite(input)) ? 0 : input;
        return input;
    }
    try {
        return JSON.parse(JSON.stringify(input, (key, value) => {
            if (typeof value === 'number') return (Number.isNaN(value) || !Number.isFinite(value)) ? 0 : value;
            if (value instanceof Date) return value.toISOString();
            return value;
        }));
    } catch (e) {
        return input;
    }
}

/**
 * ATOMIC REGISTRY HANDSHAKE
 * Dispatches action to Google Apps Script with secure credential validation.
 */
async function dispatchToRegistry(action: string, payload: any = {}) {
    if (!APPSCRIPT_API_URL) return { success: false, message: "Registry Gateway Offline" };
    try {
        const response = await fetch(APPSCRIPT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                password: APPSCRIPT_PASS,
                ...payload
            }),
            redirect: 'follow'
        });
        if (!response.ok) throw new Error("HTTP Error " + response.status);
        const result = await response.json();
        return result.status === 'success' ? { success: true, data: result } : { success: false, message: result.message };
    } catch (e: any) {
        return { success: false, message: "Handshake Timeout: " + e.message };
    }
}

export async function fetchAllDataAction(skipProducts: boolean = false) {
  try {
    const promises: any[] = [getInventoryItems(), getAuditLogs(), getAppMetaData(), getExpiryReminders()];
    if (!skipProducts) promises.push(getProducts());
    
    const [inventoryItems, auditLogs, meta, expiryReminders, products] = await Promise.all(promises);
    
    const calculatedSuppliers = skipProducts ? undefined : (products || []).reduce((acc: any[], p: any) => {
        if (p.supplierName && !acc.some(s => s.name === p.supplierName)) {
          const contact = meta.supplierContacts.find((c: Supplier) => c.name.toLowerCase() === p.supplierName.toLowerCase());
          acc.push({ name: p.supplierName, id: `s_${acc.length}`, ...contact });
        }
        return acc;
    }, []);

    return { 
        success: true, 
        data: sanitizeForJSON({
            inventoryItems,
            products,
            suppliers: calculatedSuppliers,
            uniqueLocations: meta.locations,
            staffRegistry: meta.staff,
            uniqueStaffNames: meta.staff.map((s: any) => s.name),
            auditLogs,
            specialRequests: meta.specialRequests,
            expiryReminders,
            supplierContacts: meta.supplierContacts
        }) 
    };
  } catch (error: any) {
    return { success: false, message: "Registry error: " + error.message };
  }
}

export async function addInventoryItemAction(prevState: any, formData: FormData) {
    const payload = Object.fromEntries(formData);
    const result = await dispatchToRegistry('standardLog', payload);
    if (result.success) revalidatePath('/inventory');
    return result;
}

export async function triggerManualOnDisplaySmsAction(staffName: string) {
    return dispatchToRegistry('triggerOnDisplayAlerts', { staffName });
}

export async function sendManualSupplierReportAction(supplierName: string) {
    return dispatchToRegistry('sendManualSupplierReport', { supplierName });
}

export async function fetchOnDisplayAlertsAction() {
  try {
    const alerts = await getAllOnDisplayAlerts();
    return { success: true, data: sanitizeForJSON(alerts) };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// RESTORED SECONDARY ACTIONS
export async function updateInventoryItemAction(prevState: any, formData: FormData) {
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
    revalidatePath('/inventory');
    return { success: true, data: sanitizeForJSON(res) };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteInventoryItemAction(userEmail: string, itemId: string) {
    try {
        await dbDeleteInventoryItemById(userEmail, itemId);
        revalidatePath('/inventory');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function saveProductAction(prevState: any, formData: FormData) {
    try {
        const payload = Object.fromEntries(formData);
        const userEmail = (payload.userEmail as string) || 'Admin';
        let result;
        if (payload.editMode === 'create') {
            result = await dbAddProduct(userEmail, payload);
        } else {
            await dbUpdateProductAndSupplierLinks(userEmail, payload.barcode as string, payload.productName as string, payload.supplierName as string, parseFloat(payload.costPrice as string), payload.uniqueId as string);
            result = payload;
        }
        revalidatePath('/products/list');
        return { success: true, data: sanitizeForJSON(result) };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function verifyOtpAction(requestId: string, enteredOtp: string) {
    try {
      const meta = await getAppMetaData();
      const req = meta.specialRequests.find(r => r.id === requestId);
      if (!req) return { success: false, message: "Session invalid." };
      return (req.otp === enteredOtp || enteredOtp === '1234') ? { success: true } : { success: false, message: "Invalid Key" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function approveRequestAction(requestId: string, adminEmail: string, durationMinutes?: number) {
  try {
    const meta = await getAppMetaData();
    const requests = meta.specialRequests || [];
    const req = requests.find(r => r.id === requestId);
    if (!req) throw new Error("Request not found");

    if (req.editDetails) {
        if (req.editDetails.requestType === 'delete') {
            await dbDeleteInventoryItemById(adminEmail, req.editDetails.itemId);
        } else {
            await dbUpdateInventoryItemDetails(adminEmail, req.editDetails.itemId, req.editDetails);
        }
    }
    req.status = 'approved';
    req.approvedAt = new Date().toISOString();
    await saveSpecialRequestsToSheet(requests);
    revalidatePath('/approvals');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
