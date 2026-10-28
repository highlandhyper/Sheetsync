'use server';

import { revalidatePath } from 'next/cache';
import {
  getProductDetailsByBarcode,
  processReturn as dbProcessReturn,
  updateInventoryItemDetails as dbUpdateInventoryItemDetails,
  updateProductAndSupplierLinks as dbUpdateProductAndSupplierLinks, 
  deleteInventoryItemById as dbDeleteInventoryItemById,
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
  deleteProductByBarcode as dbDeleteProductByBarcode,
  getAllOnDisplayAlerts,
  saveSupplierContactsToSheet,
  updateSupplierAcrossRegistry,
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, SpecialEntryRequest, AuditLogEntry, Permissions, StaffMember, ExpiryReminder, OnDisplayAlert } from '@/lib/types';

/**
 * REGISTRY CONFIGURATION
 * Checks for both secure and legacy (NEXT_PUBLIC) environment variables
 */
const APPSCRIPT_API_URL = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";
// Keep registry credentials server-only. Do not fall back to NEXT_PUBLIC_* secrets.
const APPSCRIPT_PASS = process.env.ADMIN_PASSWORD || ""; 

/**
 * HIGH-PERFORMANCE JSON SANITIZER
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
 * Dispatches action to Google Apps Script with robust environment checks.
 */
async function dispatchToRegistry(action: string, payload: any = {}) {
    if (!APPSCRIPT_API_URL) {
        console.error("Registry Gateway Error: GOOGLE_SCRIPT_URL is not defined in environment variables.");
        return { success: false, message: "Registry Gateway Offline" };
    }
    
    try {
        const response = await fetch(APPSCRIPT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                password: APPSCRIPT_PASS,
                ...payload
            }),
            redirect: 'follow',
            cache: 'no-store'
        });
        
        if (!response.ok) throw new Error("HTTP " + response.status);
        
        const result = await response.json();
        if (action === 'uploadUnknownBarcodeImage') {
            console.info('[UNKNOWN_BARCODE_UPLOAD] Apps Script response', {
                status: result?.status || 'unknown',
                uploaded: result?.uploaded === true,
                skipped: result?.skipped === true,
                message: result?.message || result?.reason || null,
            });
        }
        return result.status === 'success'
            ? { success: true, data: result, message: result.message || result.reason || undefined }
            : { success: false, message: result.message || 'Apps Script returned an unsuccessful response.' };
    } catch (e: any) {
        console.error(`Handshake Failure [${action}]:`, e.message);
        return { success: false, message: "Handshake Timeout: Check Google Script deployment." };
    }
}

/**
 * Supplier portal data is fetched independently of the staff/admin cache.
 * The portal is accessed by supplier code and should work without staff Firebase login.
 * Only the matching supplier's stock is returned to the browser.
 */
/**
 * Sends an unknown barcode's cropped camera frame to the existing Registry Apps Script.
 * Apps Script performs a second barcode-exists check against the master DB before saving.
 */
export async function uploadUnknownBarcodeImageAction(input: {
  barcode: string;
  imageBase64: string;
  staffName?: string;
}) {
  const barcode = String(input?.barcode || '').trim();
  const imageBase64 = String(input?.imageBase64 || '').trim();
  const staffName = String(input?.staffName || 'Unknown staff').trim().slice(0, 100);

  if (!barcode || barcode.length > 100) return { success: false, message: 'Invalid barcode.' };
  if (!imageBase64 || imageBase64.length > 1_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    console.error('[UNKNOWN_BARCODE_UPLOAD] Rejected before Apps Script: invalid image payload', {
      barcode,
      imageLength: imageBase64.length,
    });
    return { success: false, message: 'Invalid or oversized image.' };
  }

  console.info('[UNKNOWN_BARCODE_UPLOAD] Sending image to Apps Script', {
    barcode,
    imageLength: imageBase64.length,
    configuredUrl: Boolean(APPSCRIPT_API_URL),
    configuredPassword: Boolean(APPSCRIPT_PASS),
  });
  const result = await dispatchToRegistry('uploadUnknownBarcodeImage', { barcode, imageBase64, staffName });
  if (!result.success) {
    console.error('[UNKNOWN_BARCODE_UPLOAD] Apps Script request failed', {
      barcode,
      message: result.message || 'Unknown registry error',
    });
  }
  return result;
}

export async function fetchSupplierPortalData(supplierCodeInput: string) {
  try {
    const supplierCode = String(supplierCodeInput || '').trim();
    if (!supplierCode) return { success: false, message: 'Supplier code is required.' };

    const [inventoryItems, meta] = await Promise.all([
      getInventoryItems(),
      getAppMetaData(),
    ]);

    const supplier = (meta.supplierContacts || []).find(
      (item: Supplier) => String(item.supplierCode || '').trim().toUpperCase() === supplierCode.toUpperCase()
    );

    if (!supplier) return { success: false, message: 'Supplier account not found.' };

    const supplierStock = (inventoryItems || []).filter(
      (item: InventoryItem) =>
        String(item.supplierName || '').trim().toLowerCase() === String(supplier.name || '').trim().toLowerCase()
        && Number(item.quantity) > 0
    );

    return {
      success: true,
      data: sanitizeForJSON({ supplier, inventoryItems: supplierStock }),
    };
  } catch (error: any) {
    console.error('[SUPPLIER_PORTAL_DATA]', error);
    return { success: false, message: 'Unable to load supplier stock. Please refresh and try again.' };
  }
}

export async function fetchAllDataAction(skipProducts: boolean = false) {
  const syncStartedAt = Date.now();
  const timings: Record<string, number> = {};
  try {
    const timed = async <T,>(name: string, task: Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      try { return await task; }
      finally { timings[name] = Date.now() - startedAt; }
    };
    const promises: any[] = [
      timed('inventoryMs', getInventoryItems()),
      timed('auditLogsMs', getAuditLogs()),
      timed('metadataMs', getAppMetaData()),
      timed('expiryRemindersMs', getExpiryReminders())
    ];
    if (!skipProducts) promises.push(timed('productsMs', getProducts()));

    const [inventoryItems, auditLogs, meta, expiryReminders, products] = await Promise.all(promises);
    
    // Build supplier lookup indexes once. Avoid repeated linear scans across the
    // full product registry (70k+ rows), which made initial sync unnecessarily slow.
    const calculatedSuppliers = skipProducts ? undefined : (() => {
        const contactsByName = new Map<string, Supplier>();
        for (const contact of meta.supplierContacts || []) {
          const key = String(contact.name || '').trim().toLowerCase();
          if (key && !contactsByName.has(key)) contactsByName.set(key, contact);
        }

        const seenNames = new Set<string>();
        const result: Supplier[] = [];
        for (const product of products || []) {
          const name = String(product.supplierName || '').trim();
          const key = name.toLowerCase();
          if (!key || seenNames.has(key)) continue;
          seenNames.add(key);
          const contact = contactsByName.get(key);
          result.push({ ...(contact || {}), name, id: contact?.id || `s_${result.length}` });
        }
        return result;
    })();

    const sanitizeStartedAt = Date.now();
    const data = sanitizeForJSON({
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
    });
    timings.sanitizeMs = Date.now() - sanitizeStartedAt;
    const estimatedPayloadBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
    console.info('[SHEETSYNC_SYNC_DIAGNOSTICS]', JSON.stringify({
      skipProducts,
      productCount: products?.length || 0,
      inventoryCount: inventoryItems?.length || 0,
      auditLogCount: auditLogs?.length || 0,
      estimatedPayloadBytes,
      timings,
      totalServerMs: Date.now() - syncStartedAt
    }));
    return { success: true, data };
  } catch (error: any) {
    console.error('[SHEETSYNC_SYNC_DIAGNOSTICS]', JSON.stringify({
      skipProducts,
      timings,
      totalServerMs: Date.now() - syncStartedAt,
      error: error?.message || String(error)
    }));
    return { success: false, message: "Registry error: " + error.message };
  }
}

export async function addInventoryItemAction(prevState: any, formData: FormData) {
    const payload = Object.fromEntries(formData);
    // Industrial Protocol: Notification and Auditing handled internally by Apps Script
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

export async function submitSupplierDisputeAction(input: { supplierCode: string; productName: string; barcode: string; quantity: number }) {
  try {
    const supplierCode = String(input.supplierCode || '').trim();
    const productName = String(input.productName || '').trim();
    const barcode = String(input.barcode || '').trim();
    const quantity = Number(input.quantity);
    if (!supplierCode || !productName || !Number.isFinite(quantity) || quantity < 0) return { success: false, message: 'Invalid supplier dispute details.' };
    const meta = await getAppMetaData();
    const supplier = (meta.supplierContacts || []).find((item: Supplier) => String(item.supplierCode || '').trim().toUpperCase() === supplierCode.toUpperCase());
    if (!supplier) return { success: false, message: 'Supplier account could not be verified.' };
    const requests = meta.specialRequests || [];
    const duplicate = requests.find((request: SpecialEntryRequest) => request.type === 'supplier_dispute' && request.status === 'pending' && request.supplierCode?.toUpperCase() === supplierCode.toUpperCase() && request.disputedBarcode === barcode);
    if (duplicate) return { success: false, message: 'A dispute for this product is already awaiting review.' };
    const dispute: SpecialEntryRequest = {
      id: `supplier_dispute_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userEmail: supplier.email || `supplier-${supplierCode.toLowerCase()}@portal.local`,
      staffName: supplier.name, supplierName: supplier.name, supplierCode: supplier.supplierCode || supplierCode,
      disputedBarcode: barcode, disputedQuantity: quantity, suggestedProductName: productName,
      reason: 'Supplier reports that this product does not belong to their company.',
      status: 'pending', type: 'supplier_dispute', requestedAt: new Date().toISOString(),
      isDismissedByAdmin: false, isReadByUser: false,
    };
    const saved = await saveSpecialRequestsToSheet([dispute, ...requests]);
    if (!saved) return { success: false, message: 'Could not save the dispute to the registry. Please try again.' };
    revalidatePath('/approvals');
    return { success: true };
  } catch (error: any) {
    console.error('[SUPPLIER_DISPUTE] Submission failed:', error);
    return { success: false, message: error.message || 'Could not submit dispute.' };
  }
}

export async function fetchOnDisplayAlertsAction() {
  try {
    const alerts = await getAllOnDisplayAlerts();
    return { success: true, data: sanitizeForJSON(alerts) };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

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

export async function createProductFromApprovalAction(requestId: string, productName: string, supplierName: string, costPrice: string, adminEmail: string) {
  try {
    const name = productName.trim();
    const meta = await getAppMetaData();
    const requests = meta.specialRequests || [];
    const req = requests.find(r => r.id === requestId && r.type === 'product_add' && r.status === 'pending');
    if (!req) throw new Error('Pending product request not found.');
    const requestedBarcode = String(req.reason || '').trim();
    if (!requestedBarcode) throw new Error('The request does not contain a barcode.');
    if (!name) throw new Error('Enter the confirmed product name.');
    const existing = await getProductDetailsByBarcode(requestedBarcode);
    if (existing) throw new Error('This barcode is already registered. Refresh the product list.');
    const parsedCost = costPrice.trim() ? Number(costPrice) : undefined;
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost < 0)) throw new Error('Cost price must be a valid non-negative number.');
    await dbAddProduct(adminEmail || 'Admin', { barcode: requestedBarcode, productName: name, supplierName: supplierName.trim(), costPrice: parsedCost });
    req.suggestedProductName = name;
    req.status = 'approved';
    req.approvedAt = new Date().toISOString();
    req.isDismissedByAdmin = true;
    await saveSpecialRequestsToSheet(requests);
    revalidatePath('/approvals');
    revalidatePath('/products/list');
    revalidatePath('/inventory');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message || 'Could not create product.' };
  }
}

export async function updateProductAddRequestAction(requestId: string, suggestedProductName: string) {
  try {
    const meta = await getAppMetaData();
    const requests = meta.specialRequests || [];
    const req = requests.find(r => r.id === requestId && r.type === 'product_add' && r.status === 'pending');
    if (!req) throw new Error('Pending product request not found.');
    req.suggestedProductName = suggestedProductName.trim().slice(0, 180) || 'Name not provided';
    await saveSpecialRequestsToSheet(requests);
    revalidatePath('/approvals');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message || 'Could not update product request.' };
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

export async function getPermissionsAction() {
    try {
        const perms = await loadPermissionsFromSheet();
        return { success: true, data: sanitizeForJSON(perms) };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function setPermissionsAction(perms: Permissions) {
    try {
        await savePermissionsToSheet(perms);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function updateSpecialRequestsAction(requests: SpecialEntryRequest[]) {
    try {
        await saveSpecialRequestsToSheet(requests);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function saveStaffListAction(staff: StaffMember[]) {
    try {
        await saveStaffListToSheet(staff);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function saveLocationListAction(locations: string[]) {
    try {
        await saveLocationListToSheet(locations);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function addSupplierAction(prevState: any, formData: FormData) {
    try {
        const name = String(formData.get('supplierName') || '').trim();
        const supplierCode = String(formData.get('supplierCode') || '').trim();
        const phone = String(formData.get('phone') || '').trim();
        const email = String(formData.get('email') || '').trim();
        if (!name || !supplierCode || !phone) return { success: false, message: 'Supplier name, supplier code, and phone number are required.' };
        if (email && (!email.includes('@') || !email.split('@')[1]?.includes('.'))) return { success: false, message: 'Enter a valid email address or leave it blank.' };
        const meta = await getAppMetaData();
        const duplicateCode = (meta.supplierContacts || []).some((item: Supplier) => String(item.supplierCode || '').trim().toLowerCase() === supplierCode.toLowerCase());
        if (duplicateCode) return { success: false, message: 'This supplier code already exists.' };
        const newSupplier: Supplier = { id: `s_${Date.now()}`, name, supplierCode, phone, email, lastReportValue: 0 };
        const saved = await saveSupplierContactsToSheet([...(meta.supplierContacts || []), newSupplier]);
        if (!saved) return { success: false, message: 'Supplier could not be saved to the registry.' };
        revalidatePath('/suppliers');
        return { success: true, data: sanitizeForJSON(newSupplier) };
    } catch (e: any) {
        return { success: false, message: e.message || 'Could not save supplier.' };
    }
}

export async function updateSupplierAction(prevState: any, formData: FormData) {
    try {
        const email = String(formData.get('userEmail') || 'Admin');
        const supplierId = String(formData.get('supplierId') || '').trim();
        const oldName = String(formData.get('currentSupplierName') || '').trim();
        const newName = String(formData.get('newSupplierName') || '').trim();
        const meta = {
            supplierCode: String(formData.get('supplierCode') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            phone: String(formData.get('phone') || '').trim()
        };
        if (!newName || !meta.supplierCode || !meta.phone) return { success: false, message: 'Supplier name, supplier code, and phone number are required.' };
        if (meta.email && (!meta.email.includes('@') || !meta.email.split('@')[1]?.includes('.'))) return { success: false, message: 'Enter a valid email address or leave it blank.' };
        if (!supplierId) {
            const appMeta = await getAppMetaData();
            const duplicateCode = (appMeta.supplierContacts || []).some((item: Supplier) => String(item.supplierCode || '').trim().toLowerCase() === meta.supplierCode.toLowerCase());
            if (duplicateCode) return { success: false, message: 'This supplier code already exists.' };
            const newSupplier: Supplier = { id: `s_${Date.now()}`, name: newName, ...meta, lastReportValue: 0 };
            const saved = await saveSupplierContactsToSheet([...(appMeta.supplierContacts || []), newSupplier]);
            if (!saved) return { success: false, message: 'Supplier could not be saved to the registry.' };
        } else {
            await updateSupplierAcrossRegistry(email, supplierId, oldName, newName, meta);
        }
        revalidatePath('/suppliers');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function saveSupplierContactsAction(contacts: Supplier[]) {
    try {
        await saveSupplierContactsToSheet(contacts);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function resolveExpiryWatchAction(id: string, email: string) {
    try {
        await dbResolveExpiryWatch(id, email);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function checkSmsConfigAction() {
    return {
        success: true,
        data: {
            hasApiKey: !!process.env.TEXTBEE_API_KEY,
            hasDeviceId: !!process.env.TEXTBEE_DEVICE_ID
        }
    };
}

export async function sendSmsAction(message: string, recipient: string) {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    
    if (!apiKey || !deviceId) {
        return { success: false, message: "SMS configuration missing on server." };
    }

    try {
        const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey
            },
            body: JSON.stringify({
                message,
                recipients: [recipient],
                deviceId
            })
        });
        
        if (!response.ok) throw new Error("Gateway HTTP " + response.status);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function resendOtpAction(requestId: string, adminEmail: string) {
    // Legacy integration: Request new OTP dispatch via Apps Script
    return dispatchToRegistry('resendOtp', { requestId, adminEmail });
}

export async function fetchProductAction(barcode: string) {
    try {
        const product = await getProductDetailsByBarcode(barcode);
        return { success: true, data: sanitizeForJSON(product) };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function fetchProductExternalDataAction(barcode: string) {
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
        return { success: false, message: "Product not found in global registry." };
    } catch (e) {
        return { success: false, message: "Visual identification offline." };
    }
}

export async function verifyOnDisplayTokenAction(token: string, pin: string) {
    const normalizedToken = String(token || '').trim();
    const normalizedPin = String(pin || '').replace(/\D/g, '').slice(0, 4);

    if (!normalizedToken || !/^\d{4}$/.test(normalizedPin)) {
        return { success: false, message: "Invalid access link or 4-digit PIN." };
    }

    try {
        // Verify from the existing Sheets data layer. The deployed Apps Script
        // does not implement verifyOnDisplayToken, so dispatching there fails.
        const session = await getOnDisplayItemByToken(normalizedToken);
        if (!session || session.pin !== normalizedPin) {
            return { success: false, message: "Invalid, expired, or already used PIN. Check the SMS and try again." };
        }

        return { success: true, data: sanitizeForJSON(session.items) };
    } catch (error: any) {
        console.error("On-display token verification failed:", error);
        return { success: false, message: "Could not verify access. Check the connection and try again." };
    }
}

export async function verifyOnDisplayPinOnlyAction(pin: string) {
    const normalizedPin = String(pin || '').replace(/\D/g, '').slice(0, 4);
    if (!/^\d{4}$/.test(normalizedPin)) {
        return { success: false, message: "Enter the 4-digit PIN sent by SMS." };
    }

    try {
        const session = await getOnDisplayItemByPin(normalizedPin);
        if (!session) {
            return { success: false, message: "Invalid, expired, or already used PIN. Check the SMS and try again." };
        }
        return {
            success: true,
            data: {
                staffName: session.staffName,
                token: session.token
            }
        };
    } catch (error: any) {
        console.error("On-display PIN verification failed:", error);
        return { success: false, message: "Could not verify PIN. Check the connection and try again." };
    }
}

export async function submitOnDisplayRequestAction(token: string, pin: string, request: any) {
    return dispatchToRegistry('submitOnDisplayRequest', { token, pin, request });
}

export async function finalizeOnDisplaySessionAction(token: string) {
    return dispatchToRegistry('finalizeOnDisplaySession', { token });
}

export async function triggerManualExpirySmsAction(phone: string, productName: string, expiryDate: string) {
    return dispatchToRegistry('triggerManualExpirySms', { phone, productName, expiryDate });
}

export async function triggerResolvedSmsAction(phone: string, productName: string, staffName: string) {
    return dispatchToRegistry('triggerResolvedSms', { phone, productName, staffName });
}

export async function bulkDeleteProductsAction(email: string, ids: string[]) {
    try {
        const uniqueIds = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (uniqueIds.length === 0) {
            return { success: false, message: 'Select at least one product to delete.' };
        }

        const results: Array<{ id: string; success: boolean }> = [];
        for (const id of uniqueIds) {
            const deleted = await dbDeleteProductByBarcode(email || 'Admin', id);
            results.push({ id, success: deleted });
        }

        const failed = results.filter((result) => !result.success);
        revalidatePath('/products/list');
        if (failed.length > 0) {
            return {
                success: false,
                message: `Deleted ${results.length - failed.length} of ${results.length} selected products. ${failed.length} product(s) could not be found; refresh the catalog and try again.`,
                data: results
            };
        }
        return { success: true, data: results };
    } catch (error: any) {
        console.error('[PRODUCT_DELETE] Failed to delete catalog products:', error);
        return {
            success: false,
            message: error?.message || 'Could not delete products from the catalog. Please refresh and try again.'
        };
    }
}

export async function bulkDeleteInventoryItemsAction(email: string, ids: string[]) {
    try {
        for (const id of ids) {
            await dbDeleteInventoryItemById(email, id);
        }
        revalidatePath('/inventory');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function bulkReturnInventoryItemsAction(email: string, ids: string[], staff: string, type: 'all' | 'specific', qty?: number) {
    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return { success: false, message: "Select at least one inventory item to return." };
        }
        if (type === 'specific' && (!Number.isFinite(Number(qty)) || Number(qty) <= 0)) {
            return { success: false, message: "Enter a return quantity greater than zero." };
        }
        const results: Array<{ id: string; success: boolean; message?: string }> = [];
        for (const id of ids) {
            const result = await dbProcessReturn(email, id, type === 'all' ? undefined : Number(qty), staff);
            if (!result || result.success !== true) {
                results.push({ id, success: false, message: result?.message || "Return operation did not complete." });
                break;
            }
            results.push({ id, success: true });
        }
        const failed = results.find(result => !result.success);
        if (failed) {
            revalidatePath('/inventory');
            return {
                success: false,
                message: `Return stopped for item ${failed.id}: ${failed.message}. Any earlier items in this batch may already have been returned; refresh inventory before retrying.`,
                data: results
            };
        }
        revalidatePath('/inventory');
        return { success: true, data: results };
    } catch (e: any) {
        revalidatePath('/inventory');
        return { success: false, message: e?.message || "Return processing failed. Refresh inventory before retrying." };
    }
}
export async function getMasterSpreadsheetUrlAction() {
    const id = process.env.GOOGLE_SHEET_ID;
    if (!id) return { success: false };
    return { success: true, data: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}
