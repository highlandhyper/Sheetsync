/**
 * ============================================================
 * HIGHLAND HYPERMARKET - SHEETSYNC REGISTRY CORE v10.4
 * ============================================================
 * 
 * INDUSTRIAL NOTIFICATION & AUDIT ENGINE
 * 
 * SECURITY:
 * Ensure ScriptProperties are set:
 * 1. ADMIN_PASSWORD
 * 2. TEXTBEE_API_KEY
 * 3. TEXTBEE_DEVICE_ID
 * 4. RECIPIENT_EMAIL
 */

const DB_SHEET_NAME = "DB";
const LOG_SHEET_NAME = "Form responses 2";
const STAFF_SHEET_NAME = "Staff";
const AUDIT_LOG_SHEET_NAME = "Audit Log";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";

const STAFF_LIST_KEY = "staffList";
const SUPPLIER_CONTACTS_KEY = "supplierContacts";

// ------------------------------------------------------------
// COLUMN MAPPINGS
// ------------------------------------------------------------
const INV_COL_TIMESTAMP = 0;
const INV_COL_BARCODE = 1;
const INV_COL_QTY = 2;
const INV_COL_EXPIRY = 3;
const INV_COL_LOCATION = 4;
const INV_COL_STAFF = 5;
const INV_COL_PRODUCT_NAME = 6;
const INV_COL_SUPPLIER_NAME = 7;
const INV_COL_TYPE = 8;
const INV_COL_UNIQUE_ID = 9;
const INV_COL_REPORTED_AT = 10;

const ODA_COL_PIN = 7;
const ODA_COL_USED = 9;

// ============================================================
// ENTRY POINTS
// ============================================================

function doGet(e) {
  return ContentService.createTextOutput("SheetSync Registry Core v10.4 Active.");
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) throw new Error("No data received.");
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";
    Logger.log("[REGISTRY_REQUEST] action=" + action);

    // Staff PIN verification is the only public action and must validate
    // the link token as well as the PIN. All administrative actions require ADMIN_PASSWORD.
    if (action === "verifyOnDisplayPinOnly") {
      return jsonResponse(verifyOnDisplayPinOnly_(data.token, data.pin));
    }

    const props = PropertiesService.getScriptProperties();
    const systemPass = props.getProperty("ADMIN_PASSWORD");
    if (!systemPass || data.password !== systemPass) throw new Error("Unauthorized Identity");

    switch(action) {
      case "standardLog": return jsonResponse(submitData(data));
      case "triggerOnDisplayAlerts": return jsonResponse(processOnDisplayAlerts_(data.staffName, true));
      case "triggerWeeklyReports": return jsonResponse(generateWeeklySupplierReports());
      case "triggerDailySmsSummary": return jsonResponse(generateDailySupplierSmsReports());
      case "sendManualSupplierReport": return jsonResponse(sendSingleSupplierReport_(data.supplierName));
      case "sendAdminExpiryAlert": return jsonResponse(handleAdminExpiryAlert_(data));
      case "uploadUnknownBarcodeImage": return jsonResponse(uploadUnknownBarcodeImage_(data));
      default: throw new Error("Protocol Unknown: " + action);
    }
  } catch (error) {
    Logger.log("[REGISTRY_ERROR] " + (error && error.stack ? error.stack : String(error)));
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// UNKNOWN BARCODE PHOTO CAPTURE
// Requires Script Property UNKNOWN_BARCODE_DRIVE_FOLDER_ID.
// Files remain private and inherit the target Drive folder's permissions.
// ============================================================

function normalizeCapturedBarcode_(value) {
  return String(value || "").trim().replace(/^0+/, "");
}

function uploadUnknownBarcodeImage_(data) {
  const barcode = String(data.barcode || "").trim();
  Logger.log("[UNKNOWN_BARCODE_UPLOAD] started barcode=" + barcode);
  const imageBase64 = String(data.imageBase64 || "").trim();
  const staffName = String(data.staffName || "Unknown staff").slice(0, 100);

  if (!barcode || barcode.length > 100) throw new Error("Invalid barcode.");
  if (!imageBase64 || imageBase64.length > 1000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new Error("Invalid or oversized image.");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Registry busy. Try again.");

  try {
    // Server-side master DB check prevents uploads even if the browser cache is stale.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const db = ss.getSheetByName(DB_SHEET_NAME);
    if (!db) throw new Error("Master product database sheet not found.");

    const normalized = normalizeCapturedBarcode_(barcode);
    const lastRow = db.getLastRow();
    if (lastRow > 1) {
      const storedBarcodes = db.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      const exists = storedBarcodes.some(row => {
        const stored = String(row[0] || "").trim();
        return stored === barcode || normalizeCapturedBarcode_(stored) === normalized;
      });
      if (exists) return { status: "success", skipped: true, reason: "Product already exists." };
    }

    const folderId = PropertiesService.getScriptProperties().getProperty("UNKNOWN_BARCODE_DRIVE_FOLDER_ID");
    if (!folderId) throw new Error("UNKNOWN_BARCODE_DRIVE_FOLDER_ID script property is not configured.");

    const bytes = Utilities.base64Decode(imageBase64);
    const timestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyyMMdd_HHmmss");
    const safeBarcode = barcode.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const filename = "unknown_barcode_" + safeBarcode + "_" + timestamp + ".jpg";
    const blob = Utilities.newBlob(bytes, "image/jpeg", filename);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    Logger.log("[UNKNOWN_BARCODE_UPLOAD] Drive file created id=" + file.getId() + " name=" + filename);
    file.setDescription(
      "Unknown product barcode: " + barcode +
      "\nCaptured at: " + new Date().toISOString() +
      "\nStaff: " + staffName +
      "\nSource: SheetSync HTML5 barcode scanner"
    );

    Logger.log("[UNKNOWN_BARCODE_UPLOAD] success barcode=" + barcode + " file=" + filename);
    return { status: "success", uploaded: true, fileName: filename };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// CORE LOGIC: INVENTORY HANDSHAKE
// ============================================================

function submitData(item) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("Registry Busy. Try again.");
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LOG_SHEET_NAME);
    const tz = ss.getSpreadsheetTimeZone();
    const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
    const nextRow = sheet.getLastRow() + 1;
    const uniqueId = item.id || `${nextRow}-${Utilities.formatDate(entryDate, tz, "yyyyMMddHHmmss")}`;

    const rowData = [
      Utilities.formatDate(entryDate, tz, "d/M/yyyy HH:mm:ss"),
      item.barcode || "",
      item.quantity || "",
      item.expiryDate || "",
      item.location || "",
      item.staffName || item.staff || "",
      item.productName || "",
      item.supplier || "", 
      item.itemType || "Expiry",
      uniqueId
    ];

    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    setSupplierFormula_(sheet, nextRow);
    
    // Industrial Auditing
    logAuditEvent_(item.userEmail || "Terminal", "LOG_INVENTORY", item.barcode || "N/A", `[LOGGED] Qty: ${item.quantity} | Loc: ${item.location}`);

    // FORENSIC EXPIRED ITEM CHECK
    if (item.expiryDate) {
      const expiryDate = parseRegistryDate_(item.expiryDate, tz);
      const today = new Date();
      today.setHours(0,0,0,0);

      // Email Dispatch Protocol (Always active for expired identification)
      if (expiryDate && expiryDate <= today) {
        try { sendExpiryAlertEmail(item, entryDate); } catch (e) { console.warn("Forensic Email Failed"); }
      }
    }

    // 7-DAY STAFF ALERT (SMS) - Skip if silent entry
    if (item.disableNotification !== true && item.expiryDate) {
        const expiryDate = parseRegistryDate_(item.expiryDate, tz);
        const threshold = new Date();
        threshold.setHours(0,0,0,0);
        threshold.setDate(threshold.getDate() + 7);
        
        if (expiryDate && expiryDate.getTime() === threshold.getTime()) {
            sendSevenDayExpiryStaffSms_(item, entryDate);
        }
    }

    return { status: "success", type: "standardLog", id: uniqueId };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// EMAIL TEMPLATES: INDUSTRIAL RED
// ============================================================

function sendExpiryAlertEmail(item, logDate) {
  const props = PropertiesService.getScriptProperties();
  const recipient = props.getProperty("RECIPIENT_EMAIL") || "ashiqmathath@gmail.com";
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const dateStr = Utilities.formatDate(logDate, tz, "EEE, MMM d, yyyy HH:mm");

  const productName = escapeHtml(item.productName || "Unknown Product");
  const barcode = escapeHtml(item.barcode || "-");
  const quantity = escapeHtml(item.quantity || "-");
  const expiryDate = escapeHtml(item.expiryDate || "-");
  const staff = escapeHtml(item.staffName || item.staff || "Unknown");

  const htmlBody = `
    <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="background-color:#dc2626; padding:24px; color:#ffffff;">
        <h2 style="margin:0; font-size:24px;">⚠️ Expired Item Logged</h2>
        <p style="margin:4px 0 0 0; opacity:0.8;">Industrial Registry Alert</p>
      </div>
      <div style="padding:24px; background-color:#fef2f2;">
        <table style="width:100%; border-collapse:collapse;">
          <tr style="border-bottom:1px solid #fecaca;"><td style="padding:10px 0; font-weight:bold; color:#991b1b;">Product</td><td style="text-align:right; font-weight:bold;">${productName}</td></tr>
          <tr style="border-bottom:1px solid #fecaca;"><td style="padding:10px 0; color:#4b5563;">Barcode</td><td style="text-align:right; font-mono;">${barcode}</td></tr>
          <tr style="border-bottom:1px solid #fecaca;"><td style="padding:10px 0; color:#4b5563;">Quantity</td><td style="text-align:right;">${quantity} Units</td></tr>
          <tr style="border-bottom:1px solid #fecaca;"><td style="padding:10px 0; font-weight:bold; color:#dc2626;">Expiry Date</td><td style="text-align:right; font-weight:bold; color:#dc2626;">${expiryDate}</td></tr>
          <tr style="border-bottom:1px solid #fecaca;"><td style="padding:10px 0; color:#4b5563;">Logged By</td><td style="text-align:right;">${staff}</td></tr>
          <tr><td style="padding:10px 0; color:#4b5563;">Log Time</td><td style="text-align:right;">${dateStr}</td></tr>
        </table>
        <div style="margin-top:24px; padding:16px; background:#ffffff; border-left:4px solid #dc2626; border-radius:4px;">
          <p style="margin:0; font-size:13px; color:#1f2937; font-weight:bold;">ACTION REQUIRED</p>
          <p style="margin:4px 0 0 0; font-size:13px; color:#4b5563;">Please isolate this stock immediately from the sales floor.</p>
        </div>
      </div>
      <div style="background:#111827; padding:12px; text-align:center; color:#9ca3af; font-size:11px;">
        SheetSync Automated Forensic Trace • Highland Hypermarket
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: `⚠️ EXPIRED ITEM: ${productName}`,
    htmlBody: htmlBody
  });
}

// ============================================================
// HELPERS
// ============================================================

function parseRegistryDate_(value, tz) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value || "").trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function escapeHtml(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function logAuditEvent_(user, action, target, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);
  if (!sheet) return;
  const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([ts, user, action, target, details]);
}

function setSupplierFormula_(sheet, row) {
  const f = '=IF(B' + row + '="","",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&"")=TRIM(B' + row + '&""))+(TRIM(DB!$B$2:$B$100000&"")=TRIM(B' + row + '&"")))>0),1),"Not Found"))';
  sheet.getRange(row, 8).setFormula(f);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// v10.4: MANUAL HISTORICAL SUPPLIER REPORT
// Manual sends never modify Column K (automatic report tracking).
// APP_SETTINGS!B contains JSON under the supplierContacts key.
// ============================================================

function getSupplierContactByName_(name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_SETTINGS_SHEET_NAME);
  if (!sheet) throw new Error("APP_SETTINGS sheet not found.");
  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() !== SUPPLIER_CONTACTS_KEY) continue;
    let contacts;
    try { contacts = JSON.parse(rows[i][1] || "[]"); }
    catch (e) { throw new Error("Supplier contacts JSON is invalid in APP_SETTINGS."); }
    if (!Array.isArray(contacts)) throw new Error("Supplier contacts must be a JSON array.");
    return contacts.find(s => String(s && s.name || "").trim().toLowerCase() === wanted) || null;
  }
  throw new Error("Supplier contacts setting was not found in APP_SETTINGS.");
}

function sendSingleSupplierReport_(name) {
  const supplierName = String(name || "").trim();
  if (!supplierName) throw new Error("Supplier name is required.");
  const contact = getSupplierContactByName_(supplierName);
  if (!contact || !String(contact.email || "").trim()) throw new Error("No dispatch email configured for " + supplierName + ".");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME);
  if (!sheet) throw new Error("Inventory log sheet not found: " + LOG_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[INV_COL_SUPPLIER_NAME] || "").trim().toLowerCase() !== supplierName.toLowerCase()) continue;
    items.push({
      timestamp: row[INV_COL_TIMESTAMP],
      barcode: row[INV_COL_BARCODE],
      product: row[INV_COL_PRODUCT_NAME],
      quantity: row[INV_COL_QTY],
      expiry: row[INV_COL_EXPIRY],
      location: row[INV_COL_LOCATION],
      staff: row[INV_COL_STAFF],
      type: row[INV_COL_TYPE]
    });
  }
  if (!items.length) return { status: "no_data", message: "No historical logs found for this supplier." };
  const esc = v => escapeHtml(v == null || v === "" ? "—" : String(v));
  const rowsHtml = items.map(item => '<tr>' +
    '<td style="padding:10px;border-bottom:1px solid #e5e7eb;">' + esc(item.product) + '</td>' +
    '<td style="padding:10px;border-bottom:1px solid #e5e7eb;font-family:monospace;">' + esc(item.barcode) + '</td>' +
    '<td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">' + esc(item.quantity) + '</td>' +
    '<td style="padding:10px;border-bottom:1px solid #e5e7eb;">' + esc(item.expiry) + '</td>' +
    '<td style="padding:10px;border-bottom:1px solid #e5e7eb;">' + esc(item.location) + '</td></tr>').join("");
  const html = '<div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;color:#1f2937;">' +
    '<div style="background:#111827;color:#fff;padding:24px;border-radius:12px 12px 0 0;">' +
    '<div style="font-size:11px;letter-spacing:2px;color:#cbd5e1;font-weight:bold;">HIGHLAND HYPERMARKET</div>' +
    '<h1 style="margin:10px 0 4px;font-size:22px;">Supplier Inventory Report</h1>' +
    '<div style="color:#cbd5e1;font-size:13px;">Historical registry records for ' + esc(supplierName) + '</div></div>' +
    '<div style="padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">' +
    '<p style="font-size:13px;line-height:1.6;">This manual report includes all recorded inventory entries for the selected supplier. It does not change automatic-report tracking.</p>' +
    '<p style="font-size:13px;"><b>Total records:</b> ' + items.length + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f3f4f6;text-align:left;">' +
    '<th style="padding:10px;">Product</th><th style="padding:10px;">Barcode</th><th style="padding:10px;text-align:right;">Qty</th><th style="padding:10px;">Expiry</th><th style="padding:10px;">Location</th>' +
    '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
    '<p style="font-size:11px;color:#6b7280;margin-top:20px;">SHEETSYNC REGISTRY · Automated inventory reporting</p></div></div>';
  const textBody = "HIGHLAND HYPERMARKET - SUPPLIER INVENTORY REPORT\nSupplier: " + supplierName +
    "\nTotal records: " + items.length + "\n\n" + items.map(i => [i.product, i.barcode, i.quantity, i.expiry, i.location].join(" | ")).join("\n");
  MailApp.sendEmail({
    to: String(contact.email).trim(),
    subject: "Supplier Inventory Report — " + supplierName.replace(/[\\r\\n]/g, " "),
    body: textBody,
    htmlBody: html,
    name: "Highland Hypermarket | SheetSync Registry"
  });
  return { status: "success", message: "Manual historical report sent to " + contact.email, items: items.length };
}

// ============================================================
// v10.4: ADMIN EXPIRY EMAIL HANDLER + PROFESSIONAL TEMPLATE
// ============================================================

function handleAdminExpiryAlert_(data) {
  const item = data && typeof data === "object" ? data : {};
  const productName = String(item.productName || item.product || "").trim();
  const barcode = String(item.barcode || "").trim();
  if (!productName && !barcode) throw new Error("Product name or barcode is required.");
  sendExpiryAlertEmail({
    productName: productName || "Unknown product",
    barcode: barcode || "—",
    quantity: item.quantity != null ? item.quantity : (item.qty != null ? item.qty : "—"),
    expiryDate: item.expiryDate || item.expiry || "",
    staffName: item.staffName || item.staff || "Unknown",
    location: item.location || "Not specified",
    supplier: item.supplier || "Not specified"
  }, new Date());
  return { status: "success", message: "Admin expiry alert email sent." };
}

