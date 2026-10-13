
/**
 * ============================================================
 * HIGHLAND HYPERMARKET - SHEETSYNC REGISTRY CORE v6.0
 * ============================================================
 * 
 * SECURITY NOTICE:
 * This script uses ScriptProperties for secrets. Ensure the 
 * following properties are set in Project Settings:
 * 1. ADMIN_PASSWORD
 * 2. TEXTBEE_API_KEY
 * 3. TEXTBEE_DEVICE_ID
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
// COLUMN MAPPINGS (Index 0 based for arrays, 1 based for ranges)
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
const INV_COL_REPORTED_AT = 10; // Col K
const INV_COL_DAILY_SMS_AT = 11; // Col L

const WATCH_COL_ID = 1;
const WATCH_COL_BARCODE = 2;
const WATCH_COL_PRODUCT = 3;
const WATCH_COL_EXPIRY = 4;
const WATCH_COL_SUPPLIER = 5;
const WATCH_COL_STATUS = 6;
const WATCH_COL_TIMESTAMP = 7;
const WATCH_COL_STAFF = 8;
const WATCH_COL_RESOLUTION_SMS_STATUS = 12; // Col L
const WATCH_COL_RESOLUTION_SMS_SENT_AT = 13; // Col M

const ODA_COL_ID = 1;
const ODA_COL_TOKEN = 6;
const ODA_COL_PIN = 7;
const ODA_COL_USED = 9;
const ODA_COL_LOG_ROW = 11;
const ODA_COL_LOG_ID = 12;

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
// CORE LOGIC: INVENTORY
// ============================================================

function submitData(item) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Registry Busy. Try again.");
  
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
      "", // Supplier auto-lookup formula
      item.itemType || "Expiry",
      uniqueId
    ];

    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    setSupplierFormula_(sheet, nextRow);
    
    logAuditEvent_(item.userEmail || "Terminal", "LOG_INVENTORY", item.barcode || "N/A", `[LOGGED] Qty: ${item.quantity} | Loc: ${item.location}`);

    // Post-sync hooks
    if (item.disableNotification !== true) {
      sendSevenDayExpiryStaffSmsIfDue_(item, entryDate);
    }

    return { status: "success", type: "standardLog", id: uniqueId };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// CORE LOGIC: SUPPLIER REPORTING
// ============================================================

function generateDailySupplierSmsReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const contacts = meta.supplierContacts || [];
  
  if (logSheet.getLastRow() < 2) return { status: "success", message: "Empty" };
  
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 12).getValues();
  const unreported = data.map((r, i) => ({ row: r, idx: i + 2 }))
                        .filter(x => x.row[7] && !x.row[11]);
  
  if (unreported.length === 0) return { status: "success", message: "Up-to-date" };
  
  const grouped = {};
  unreported.forEach(x => {
    const n = x.row[7];
    if (!grouped[n]) grouped[n] = { items: [], rows: [] };
    grouped[n].items.push(x.row);
    grouped[n].rows.push(x.idx);
  });
  
  const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  let sent = 0;

  Object.keys(grouped).forEach(name => {
    const contact = contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (contact?.phone) {
      const units = grouped[name].items.reduce((s, r) => s + parseFloat(String(r[2] || 0)), 0);
      const msg = `SHEETSYNC: Daily Summary. ${grouped[name].items.length} new items logged. Total Units: ${units}. Portal: ${APP_URL}/supplier-portal/${contact.supplierCode}`;
      if (sendTextbeeSms_(contact.phone, msg)) {
        sent++;
        grouped[name].rows.forEach(rIdx => logSheet.getRange(rIdx, 12).setValue(ts));
      }
    }
  });

  return { status: "success", smsSent: sent };
}

function generateWeeklySupplierReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const contacts = meta.supplierContacts || [];
  
  if (logSheet.getLastRow() < 2) return { status: "success", message: "Empty" };
  
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).getValues();
  const unreported = data.map((r, i) => ({ row: r, idx: i + 2 }))
                        .filter(x => !x.row[10]);
  
  if (unreported.length === 0) return { status: "success", message: "No new logs" };
  
  const grouped = {};
  unreported.forEach(x => {
    const n = x.row[7];
    if (!grouped[n]) grouped[n] = { items: [], rows: [] };
    grouped[n].items.push(x.row);
    grouped[n].rows.push(x.idx);
  });
  
  let sent = 0;
  const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

  Object.keys(grouped).forEach(name => {
    const contact = contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (contact?.email) {
      sendWeeklyEmail_(contact, grouped[name].items);
      sent++;
      grouped[name].rows.forEach(rIdx => logSheet.getRange(rIdx, 11).setValue(ts));
    }
  });
  
  return { status: "success", reportsSent: sent };
}

// ============================================================
// HELPERS: INFRASTRUCTURE
// ============================================================

function getAppMetaData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const findJson = (key) => {
    const row = data.find(r => r[0] === key);
    try { return row ? JSON.parse(row[1]) : null; } catch(e) { return null; }
  };
  return {
    supplierContacts: findJson(SUPPLIER_CONTACTS_KEY) || [],
    staff: findJson(STAFF_LIST_KEY) || []
  };
}

function logAuditEvent_(user, action, target, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);
  if (!sheet) return;
  const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([ts, user, action, target, details]);
}

function sendTextbeeSms_(phone, message) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("TEXTBEE_API_KEY");
  const devId = props.getProperty("TEXTBEE_DEVICE_ID");
  if (!key || !devId || !phone) return false;
  try {
    const res = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": key },
      payload: JSON.stringify({ message, recipients: [normalizePhone_(phone)], deviceId: devId }),
      muteHttpExceptions: true
    });
    return res.getResponseCode() === 200;
  } catch (e) { return false; }
}

function normalizePhone_(v) {
  let p = String(v || "").replace(/\D/g, "");
  if (p.length === 8) p = "974" + p;
  return "+" + p;
}

function setSupplierFormula_(sheet, row) {
  const f = '=IF(B' + row + '="","",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&"")=TRIM(B' + row + '&""))+(TRIM(DB!$B$2:$B$100000&"")=TRIM(B' + row + '&"")))>0),1),"Not Found"))';
  sheet.getRange(row, 8).setFormula(f);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// AUTOMATION INSTALLER
// ------------------------------------------------------------
function installSupplierAutomationTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (["generateDailySupplierSmsReports", "generateWeeklySupplierReports", "automaticOnDisplayDailyCheck"].includes(fn)) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("generateDailySupplierSmsReports").timeBased().everyDays(1).atHour(21).create();
  ScriptApp.newTrigger("generateWeeklySupplierReports").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();
  ScriptApp.newTrigger("automaticOnDisplayDailyCheck").timeBased().everyDays(1).atHour(5).create();
}
