
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createHash } from 'node:crypto';
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
  getInventoryLogEntriesByBarcode,
  clearProductDatabase,
  appendProductBatch,
  updateProductBatch,
  deleteAuditLogsByBarcode as dbDeleteAuditLogsByBarcode,
  getExpiryReminders,
  addExpiryReminder,
  resolveExpiryReminder
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, DashboardMetrics, SpecialEntryRequest, AuditLogEntry, Role, ExpiryReminder } from '@/lib/types';
import { format, parseISO, isValid, isBefore, startOfDay, isSameDay } from 'date-fns';

export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

/**
 * SECURITY: Internal role resolver for server-side enforcement
 */
function getRoleByEmail(email: string | null): Role {
    if (!email) return 'viewer';
    return email.toLowerCase().trim() === 'viewer@example.com' ? 'viewer' : 'admin';
}

/**
 * SECURITY: Helper to get human-readable purpose for SMS context
 */
function getRequestPurpose(req: SpecialEntryRequest): string {
    switch (req.type) {
        case 'product_add': return 'Register SKU';
        case 'inventory_edit': return `Edit ${req.editDetails?.productName || 'Stock'}`;
        case 'timed': return 'Timed Access';
        case 'single': return 'Silent Entry';
        default: return 'Identity Check';
    }
}

/**
 * SECURITY: Cryptographic hashing for OTP storage
 */
function hashOtp(otp: string): string {
    return createHash('sha256')
        .update(otp + (process.env.OTP_SALT || 'industrial-registry-v5'))
        .digest('hex');
}

/**
 * HIGH-PERFORMANCE ITERATIVE SANITIZER
 * Ensures all data nodes are safe for JSON transmission.
 */
function sanitizeForJSON(input: any): any {
    if (input === null || input === undefined) return input;
    
    if (typeof input !== 'object') {
        if (typeof input === 'number') {
            return (Number.isNaN(input) || !Number.isFinite(input)) ? 0 : input;
        }
        return input;
    }

    const stack: { source: any, target: any }[] = [{ 
        source: input, 
        target: Array.isArray(input) ? [] : {} 
    }];
    const rootTarget = stack[0].target;

    while (stack.length > 0) {
        const { source, target } = stack.pop()!;

        for (const key in source) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
            
            const value = source[key];
            
            if (value === null || value === undefined) {
                target[key] = value;
            } else if (value instanceof Date) {
                target[key] = value.toISOString();
            } else if (typeof value === 'number') {
                target[key] = (Number.isNaN(value) || !Number.isFinite(value)) ? 0 : value;
            } else if (typeof value === 'object') {
                const newTarget = Array.isArray(value) ? [] : {};
                target[key] = newTarget;
                stack.push({ source: value, target: newTarget });
            } else {
                target[key] = value;
            }
        }
    }

    return rootTarget;
}

export async function fetchAllDataAction(skipProducts: boolean = false): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products?: Product[];
  suppliers?: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
  expiryReminders: ExpiryReminder[];
}>> {
  try {
    const promises: any[] = [
      getInventoryItems(),
      getAuditLogs(), 
      getAppMetaData(),
      getExpiryReminders()
    ];

    if (!skipProducts) {
        promises.push(getProducts());
    }

    const results = await Promise.all(promises);
    const inventoryItems = results[0];
    const auditLogs = results[1];
    const meta = results[2];
    const expiryReminders = results[3];
    const products = skipProducts ? undefined : results[4];

    const activeProducts = skipProducts ? undefined : (products || []);
    const calculatedSuppliers = skipProducts ? undefined : await getSuppliers(activeProducts);

    const sortedRequests = (meta.specialRequests || []).sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );

    const result = {
      inventoryItems: inventoryItems || [],
      ...(skipProducts ? {} : { products: activeProducts }),
      ...(calculatedSuppliers ? { suppliers: calculatedSuppliers } : {}),
      uniqueLocations: meta.locations || [],
      uniqueStaffNames: meta.staff || [],
      auditLogs: auditLogs || [],
      specialRequests: sortedRequests,
      expiryReminders: expiryReminders || []
    };

    return {
      success: true,
      data: sanitizeForJSON(result)
    };
  } catch (error: any) {
    console.error("Registry Sync Failure:", error);
    return { success: false, message: error.message || "Registry link timeout. Retrying..." };
  }
}

/**
 * SECURITY: Securely dispatches OTPs via Textbee REST API.
 */
export async function sendSmsAction(message: string, recipientNumber: string, customDeviceId?: string) {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID || customDeviceId || '6a957332f3dc6f0f7b4d9aa3';

    if (!apiKey || apiKey.trim() === '') {
        console.error("SMS Gateway Error: TEXTBEE_API_KEY is missing from environment variables.");
        return { success: false, message: "Gateway API Key not configured in .env.local." };
    }

    if (!recipientNumber || recipientNumber.trim() === '') {
        return { success: false, message: "Recipient phone number not provided." };
    }

    let formattedPhone = recipientNumber.trim().replace(/\s/g, '');
    if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    try {
        const maskedDeviceId = deviceId.substring(0, 4) + '...' + deviceId.substring(deviceId.length - 4);
        console.log(`SMS Dispatch: Sending to ${formattedPhone} via hardware node ${maskedDeviceId}...`);
        
        const res = await fetch(
            'https://api.textbee.dev/api/v1/gateway/send-sms',
            {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceId: deviceId,
                    recipients: [formattedPhone],
                    message: message,
                }),
                signal: AbortSignal.timeout(15000)
            }
        );
        
        const data = await res.json();
        
        if (!res.ok) {
            console.error("Textbee API Error Response:", JSON.stringify(data));
            return { success: false, message: data.message || `Gateway Error ${res.status}` };
        }
        
        console.log("SMS Dispatch Success:", JSON.stringify(data));
        return { success: true, data };
    } catch (e: any) {
        console.error("SMS Gateway Exception:", e.message);
        return { success: false, message: `Gateway Timeout or Connection Error: ${e.message}` };
    }
}

/**
 * SECURITY: Checks if the server environment has the required SMS keys.
 */
export async function checkSmsConfigAction(): Promise<ActionResponse<{ hasApiKey: boolean, hasDeviceId: boolean }>> {
    return {
        success: true,
        data: {
            hasApiKey: !!process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_API_KEY.trim() !== '',
            hasDeviceId: !!process.env.TEXTBEE_DEVICE_ID && process.env.TEXTBEE_DEVICE_ID.trim() !== ''
        }
    };
}

/**
 * SECURITY: Securely verifies hashed OTP and handles expiry/attempts.
 */
export async function verifyOtpAction(requestId: string, enteredOtp: string): Promise<ActionResponse<boolean>> {
    try {
        const meta = await getAppMetaData();
        const requests = meta.specialRequests || [];
        const requestIndex = requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) return { success: false, message: "Identity node not found." };
        
        const req = requests[requestIndex];
        
        if (req.isBlocked) return { success: false, message: "Security block active. Multiple failed attempts." };
        
        const now = new Date();
        if (req.otpExpiresAt && new Date(req.otpExpiresAt) < now) {
            req.status = 'expired';
            await saveSpecialRequestsToSheet(requests);
            return { success: false, message: "Security key has expired (5-minute limit)." };
        }
        
        const hashedEntered = hashOtp(enteredOtp);
        if (req.otpHash === hashedEntered) {
            req.verificationAttempts = 0;
            await saveSpecialRequestsToSheet(requests);
            return { success: true, data: true };
        } else {
            req.verificationAttempts = (req.verificationAttempts || 0) + 1;
            if (req.verificationAttempts >= 3) {
                req.isBlocked = true;
                req.status = 'blocked';
                await logAuditEvent('SECURITY', 'BRUTE_FORCE_BLOCK', req.staffName, `Blocked after 3 failed OTP attempts.`);
            }
            await saveSpecialRequestsToSheet(requests);
            return { success: false, message: `Invalid key. Attempt ${req.verificationAttempts}/3.` };
        }
    } catch (e) {
        return { success: false, message: "Verification engine error." };
    }
}

/**
 * SECURITY: Generates, hashes, and dispatches OTP.
 */
export async function approveRequestAction(requestId: string, adminEmail: string, durationMinutes?: number): Promise<ActionResponse> {
    try {
        if (getRoleByEmail(adminEmail) !== 'admin') return { success: false, message: "Unauthorized." };
        
        const meta = await getAppMetaData();
        const requests = meta.specialRequests || [];
        const requestIndex = requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) return { success: false, message: "Request not found." };
        
        const req = requests[requestIndex];
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hash = hashOtp(otp);
        
        const now = new Date();
        const otpExpiry = new Date(now.getTime() + 5 * 60000).toISOString(); 
        const isTimed = typeof durationMinutes === 'number' && durationMinutes > 0;
        const sessionExpiry = isTimed ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : undefined;
        
        const phone = meta.permissions?.smsRecipientNumber;
        const deviceId = meta.permissions?.smsDeviceId;
        
        let smsSent = false;
        let errorMessage = "";

        if (phone && phone.trim() !== '') {
            const purpose = getRequestPurpose(req);
            const msg = `SheetSync: OTP for ${purpose} (${req.staffName}) is ${otp}. Valid 5 mins.`;
            const smsRes = await sendSmsAction(msg, phone, deviceId);
            smsSent = smsRes.success;
            errorMessage = smsRes.message || "";
            
            if (!smsSent) {
                console.error(`OTP dispatch failed for ${req.staffName}: ${errorMessage}`);
            }
        } else {
            console.warn(`OTP dispatch skipped for ${req.staffName}: No recipient phone configured.`);
            smsSent = true; 
        }

        if (smsSent) {
            req.status = 'approved';
            req.approvedAt = now.toISOString();
            req.otpHash = hash;
            req.otpExpiresAt = otpExpiry;
            req.expiresAt = sessionExpiry;
            req.verificationAttempts = 0;
            req.type = isTimed ? 'timed' : 'single';
            
            await saveSpecialRequestsToSheet(requests);
            await logAuditEvent(adminEmail, 'APPROVE_SPECIAL_ENTRY', req.id, `Authorized ${req.staffName}. OTP generated and hashed.`);
            
            return { success: true };
        } else {
            return { success: false, message: `SMS Dispatch Failure: ${errorMessage}` };
        }
    } catch (e) {
        return { success: false, message: "Registry update failed." };
    }
}

/**
 * SECURITY: Securely regenerates and redispatches an OTP.
 */
export async function resendOtpAction(requestId: string, userEmail: string): Promise<ActionResponse> {
    try {
        const meta = await getAppMetaData();
        const requests = meta.specialRequests || [];
        const req = requests.find(r => r.id === requestId);
        
        if (!req) return { success: false, message: "Request node not found." };
        
        // Validation: Must be requester, global, or admin
        const isOwner = req.userEmail.toLowerCase() === userEmail.toLowerCase().trim();
        const isAdmin = getRoleByEmail(userEmail) === 'admin';
        const isGlobal = req.staffName === "ALL PERSONNEL (GLOBAL)";

        if (!isOwner && !isAdmin && !isGlobal) {
            return { success: false, message: "Unauthorized registry access." };
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hash = hashOtp(otp);
        const now = new Date();
        const otpExpiry = new Date(now.getTime() + 5 * 60000).toISOString();

        const phone = meta.permissions?.smsRecipientNumber;
        const deviceId = meta.permissions?.smsDeviceId;

        if (phone && phone.trim() !== '') {
            const purpose = getRequestPurpose(req);
            const msg = `SheetSync: New OTP for ${purpose} (${req.staffName}) is ${otp}. Valid 5 mins.`;
            const smsRes = await sendSmsAction(msg, phone, deviceId);
            if (!smsRes.success) return { success: false, message: `Gateway Error: ${smsRes.message}` };
        }

        req.otpHash = hash;
        req.otpExpiresAt = otpExpiry;
        req.status = 'approved'; 
        req.verificationAttempts = 0; // Reset attempts for new key
        req.isBlocked = false;

        await saveSpecialRequestsToSheet(requests);
        await logAuditEvent(userEmail, 'RESEND_OTP', req.id, `Regenerated secure key for ${req.staffName}.`);
        
        return { success: true };
    } catch (e) {
        return { success: false, message: "Resend protocol failed." };
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

    let expiryDate: Date | undefined;
    if (rawFormData.expiryDate && typeof rawFormData.expiryDate === 'string') {
        const d = new Date(rawFormData.expiryDate + 'T12:00:00');
        if (isValid(d)) expiryDate = d;
    }

    const parsedData = {
      ...rawFormData,
      quantity: qty,
      expiryDate,
    };

    const validationResult = addInventoryItemSchema.safeParse(parsedData);
    if (!validationResult.success) {
        return { success: false, message: "Input validation failed.", errors: validationResult.error.issues };
    }
    
    const validatedItemData = validationResult.data;
    const productDetails = await getProductDetailsByBarcode(validatedItemData.barcode);
    if (!productDetails) {
        return { success: false, message: `Barcode ${validatedItemData.barcode} is not in the product registry.` };
    }

    const now = new Date();
    const tempId = `log_${now.getTime()}`;
    // TURBO EXPIRE: Include today's date in expired classification to trigger automated mail protocol
    const isExpired = validatedItemData.itemType === 'Expiry' && 
                     (isBefore(validatedItemData.expiryDate, startOfDay(now)) || isSameDay(validatedItemData.expiryDate, now));
    
    const sheetTriggerType = isExpired ? 'EXPIRED' : (validatedItemData.itemType === 'Damage' ? 'DAMAGE' : validatedItemData.itemType);

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

    const sheetItemData = {
        ...itemData,
        itemType: sheetTriggerType,
        disableNotification: disableNotification
    };

    const sheetWriteSuccess = await addInventoryItemToSheet(sheetItemData as any);
    if (!sheetWriteSuccess) {
        return { success: false, message: "Sheet write failure. Logging engine offline." };
    }

    const alertTag = isExpired ? 'EXPIRED' : (validatedItemData.itemType === 'Damage' ? 'DAMAGE' : 'LOG');
    const silentFlag = disableNotification ? ' [SILENT ENTRY]' : '';
    const auditDetails = `[${alertTag}]${silentFlag} Product: ${productDetails.productName} | Barcode: ${validatedItemData.barcode} | Qty: ${validatedItemData.quantity} | Location: ${validatedItemData.location} | Staff: ${validatedItemData.staffName}`;

    await logAuditEvent(userEmail, 'LOG_INVENTORY', tempId, auditDetails);
    
    return { success: true, message: 'Logged successfully!', data: itemData };
  } catch (error: any) {
    console.error("addInventoryItemAction Critical Error:", error);
    return { success: false, message: error.message || "An internal error occurred during logging." };
  }
}

export async function addExpiryWatchAction(data: Omit<ExpiryReminder, 'id' | 'timestamp' | 'status'>): Promise<ActionResponse<ExpiryReminder>> {
    try {
        const result = await addExpiryReminder(data);
        await logAuditEvent(data.staffName, 'CREATE_WATCH', data.barcode, `Added ${data.productName} to Expiry Watch (Systematic Tracking).`);
        return { success: true, data: sanitizeForJSON(result) };
    } catch (e) {
        return { success: false, message: "Registry link failed." };
    }
}

export async function resolveExpiryWatchAction(id: string, email: string): Promise<ActionResponse> {
    try {
        const success = await resolveExpiryReminder(id, email);
        return { success };
    } catch (e) {
        return { success: false };
    }
}

export async function saveProductAction(prevState: any, formData: FormData): Promise<ActionResponse<Product>> {
    try {
        const data = Object.fromEntries(formData.entries());
        const userEmail = (data.userEmail as string) || 'Admin';
        
        if (getRoleByEmail(userEmail) !== 'admin') {
            return { success: false, message: "Unauthorized: Administrator permissions required." };
        }

        const editMode = data.editMode as string;
        const barcode = data.barcode as string;
        const productName = data.productName as string;
        const supplierName = data.supplierName as string;
        const uniqueId = data.uniqueId as string;
        const rawCost = data.costPrice as string;
        
        let costPrice: number | undefined = undefined;
        if (rawCost !== undefined && rawCost !== '' && rawCost !== 'undefined') {
            const parsed = parseFloat(rawCost);
            if (!isNaN(parsed)) costPrice = parsed;
        }
        
        if (editMode === 'create') {
            const product = await dbAddProduct(userEmail, { barcode, productName, supplierName, costPrice });
            revalidatePath('/products/list');
            return { success: true, message: "Created successfully.", data: sanitizeForJSON(product) };
        } else {
            const success = await dbUpdateProductAndSupplierLinks(userEmail, barcode, productName, supplierName, costPrice, uniqueId);
            if (!success) return { success: false, message: "Product not found." };
            
            revalidatePath('/products/list');
            revalidatePath('/inventory');
            
            return { 
                success: true, 
                message: "Catalog updated.", 
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
        if (getRoleByEmail(email) !== 'admin') return { success: false };
        const success = await dbDeleteProductByBarcode(email, identifier);
        revalidatePath('/products/list');
        return { success };
    } catch (e) {
        return { success: false };
    }
}

export async function bulkDeleteProductsAction(email: string, identifiers: string[]) {
    try {
        if (getRoleByEmail(email) !== 'admin') return { success: false };
        const success = await dbDeleteProductsByBarcodes(email, identifiers);
        revalidatePath('/products/list');
        return { success };
    } catch (e) {
        console.error("Bulk delete action error:", e);
        return { success: false };
    }
}

export async function clearDatabaseAction(email: string) {
    try {
        if (getRoleByEmail(email) !== 'admin') return { success: false, message: "Unauthorized." };
        const success = await clearProductDatabase(email);
        return { success };
    } catch (e) {
        return { success: false };
    }
}

export async function batchImportProductsAction(email: string, products: any[][], startRow: number = 2) {
    try {
        if (getRoleByEmail(email) !== 'admin') return { success: false, message: "Unauthorized." };
        const success = await updateProductBatch(products, startRow);
        return { success };
    } catch (e) {
        console.error("Batch import action error:", e);
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

export async function deleteAuditLogsByBarcodeAction(email: string, barcode: string) {
    try {
        if (getRoleByEmail(email) !== 'admin') return { success: false, message: "Unauthorized." };
        const success = await dbDeleteAuditLogsByBarcode(email, barcode);
        revalidatePath('/audit-log');
        return { success };
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
        const name = data.newSupplierName as string;
        const userEmail = (data.userEmail as string) || 'Admin';
        
        if (getRoleByEmail(userEmail) !== 'admin') {
            return { success: false, message: "Unauthorized." };
        }

        await dbUpdateSupplierName(userEmail, oldName, name);
        revalidatePath('/suppliers');
        revalidatePath('/products/list');
        revalidatePath('/inventory');
        return { 
          success: true, 
          message: `Success: Supplier renamed to "${name}". All associated records updated.` 
        };
    } catch (e) {
        return { success: false, message: "Rename operation failed on Google Sheets." };
    }
}

export async function returnInventoryItemAction(e: string, id: string, q: number | undefined, staff: string) { 
    try {
        await dbProcessReturn(e, id, q, staff);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}

export async function deleteInventoryItemAction(e: string, i: string) { 
    try {
        if (getRoleByEmail(e) !== 'admin') return { success: false };
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
        if (getRoleByEmail(e) !== 'admin') return { success: false };
        for (const id of ids) await dbDeleteInventoryItemById(e, id);
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
    }
}

export async function bulkReturnInventoryItemsAction(e: string, ids: string[], staffName: string, t: string, q?: number) { 
    try {
        for (const id of ids) {
            const qty = t === 'all' ? undefined : q;
            await dbProcessReturn(e, id, qty, staffName);
        }
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        return { success: true }; 
    } catch (err) {
        return { success: false };
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

export async function getMasterSpreadsheetUrlAction(): Promise<ActionResponse<string>> {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return { success: false, message: "Spreadsheet identifier not configured." };
        return { success: true, data: `https://docs.google.com/spreadsheets/d/${sheetId}/edit` };
    } catch (e) {
        return { success: false, message: "Failed to retrieve database path." };
    }
}
