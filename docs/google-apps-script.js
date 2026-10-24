
/**
 * ============================================================
 * HIGHLAND HYPERMARKET - SHEETSYNC REGISTRY CORE v7.0
 * ============================================================
 * 
 * SECURITY NOTICE:
 * This script uses ScriptProperties for secrets. Ensure the 
 * following properties are set in Project Settings:
 * 1. ADMIN_PASSWORD
 * 2. TEXTBEE_API_KEY
 * 3. TEXTBEE_DEVICE_ID
 * 4. RECIPIENT_EMAIL (Default: ashiqmathath@gmail.com)
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
const SPECIAL_REQUESTS_KEY = "specialRequests";

const APP_URL = "https://sheetsync-five.vercel.app";

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
const INV_COL_DAILY_SMS_AT = 11;

const WATCH_COL_ID = 1;
const WATCH_COL_STATUS = 6;

const ODA_COL_ID = 1;
const ODA_COL_TOKEN = 6;
const ODA_COL_PIN = 7;
const ODA_COL_USED = 9;

// ============================================================
// ENTRY POINTS
// ============================================================

function doGet(e) {
  try {
    if (e?.parameter?.action === "getProducts") return getProductJSON();
    return ContentService.createTextOutput("SheetSync Registry Core Active.");
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) throw new Error("No data received.");
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    // Security Handshake
    const props = PropertiesService.getScriptProperties();
    const systemPass = props.getProperty("ADMIN_PASSWORD");
    if (data.password !== systemPass) throw new Error("Unauthorized Identity");

    switch(action) {
      case "standardLog": return jsonResponse(submitData(data));
      case "addProduct": return jsonResponse(manageProduct(data));
      case "addStaff": return jsonResponse(addNewStaff(data));
      case "triggerOnDisplayAlerts": return jsonResponse(processOnDisplayAlerts_(data.staffName));
      case "triggerWatchSmsOnly": return jsonResponse(processExpiryWatchReminderById_(data.reminderId));
      case "triggerWatchResolvedSms": return jsonResponse(processExpiryWatchResolvedSmsById_(data.reminderId));
      case "triggerWeeklyReports": return jsonResponse(generateWeeklySupplierReports());
      case "triggerDailySmsSummary": return jsonResponse(generateDailySupplierSmsReports());
      case "sendManualSupplierReport": return jsonResponse(sendSingleSupplierReport_(data.supplierName));
      case "sendAdminExpiryAlert": return jsonResponse(handleAdminExpiryAlert_(data));
      case "forensicWipe": return jsonResponse(handleForensicWipe_(data));
      default: throw new Error("Protocol Unknown: " + action);
    }
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
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
    
    logAuditEvent_(item.userEmail || "Terminal", "LOG_INVENTORY", item.barcode || "N/A", `[LOGGED] Qty: ${item.quantity} | Loc: ${item.location}`);

    // FORENSIC EXPIRED ITEM CHECK
    if (item.expiryDate) {
      const expiryDate = parseRegistryDate_(item.expiryDate, tz);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (expiryDate && expiryDate <= today) {
        sendExpiryAlertEmail(item, entryDate);
      }
    }

    // 7-DAY STAFF ALERT (SMS)
    if (item.disableNotification !== true) {
      sendSevenDayExpiryStaffSmsIfDue_(item, entryDate);
    }

    return { status: "success", type: "standardLog", id: uniqueId };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminExpiryAlert_(data) {
  if (!data.item) throw new Error("Item data missing");
  sendExpiryAlertEmail(data.item, new Date());
  return { status: "success", message: "Forensic alert dispatched" };
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
// HELPERS: INFRASTRUCTURE
// ============================================================

function parseRegistryDate_(value, tz) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value || "").trim();
  if (!text) return null;

  // Handles yyyy-MM-dd
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  // Handles dd/MM/yyyy
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

// OMITTED: Additional standard functions (manageProduct, addNewStaff, etc. are preserved as in previous audit)
