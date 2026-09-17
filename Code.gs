
// ============================================================
// SheetSync Core Industrial Registry Protocol
// Version: 5.1.0 (On-Display Expiry Enabled)
// ============================================================

const DB_SHEET_NAME = "DB";
const LOG_SHEET_NAME = "Form responses 2";
const STAFF_SHEET_NAME = "Staff";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";
const STAFF_LIST_KEY = "staffList";

// APP CONFIGURATION
const ADMIN_PASSWORD = "0438";
const APP_URL = "https://sheet-sync-next.vercel.app"; // UPDATE WITH YOUR URL

// Expiry Watch column indices
const WATCH_COL_ID = 1;
const WATCH_COL_BARCODE = 2;
const WATCH_COL_PRODUCT = 3;
const WATCH_COL_EXPIRY = 4;
const WATCH_COL_SUPPLIER = 5;
const WATCH_COL_STATUS = 6;
const WATCH_COL_TIMESTAMP = 7;
const WATCH_COL_STAFF = 8;
const WATCH_COL_SMS_STATUS = 9;
const WATCH_COL_SMS_SENT_AT = 10;
const WATCH_COL_SMS_COUNT = 11;
const WATCH_COL_RESOLUTION_SMS_STATUS = 12;
const WATCH_COL_RESOLUTION_SMS_SENT_AT = 13;

// On-Display Alerts column indices
const ODA_COL_ID = 0;
const ODA_COL_BARCODE = 1;
const ODA_COL_PRODUCT = 2;
const ODA_COL_EXPIRY = 3;
const ODA_COL_STAFF = 4;
const ODA_COL_TOKEN = 5;
const ODA_COL_PIN = 6;
const ODA_COL_EXPIRES = 7;
const ODA_COL_USED = 8;
const ODA_COL_SENT_AT = 9;

// ============================================================
// CORE ROUTING
// ============================================================

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "getProducts") {
      return getProductJSON();
    }
    return ContentService.createTextOutput("SheetSync Industrial Node Active.");
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("No payload.");
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    // Security Handshake
    if (["addProduct", "addStaff", "forensicWipe", "triggerWatchSmsOnly", "triggerWatchResolvedSms", "triggerOnDisplayAlerts"].includes(action)) {
      if (data.password !== ADMIN_PASSWORD) throw new Error("Unauthorized Access Key");
    }

    if (action === "addProduct") return manageProduct(data);
    if (action === "addStaff") return addNewStaff(data);
    if (action === "triggerOnDisplayAlerts") return jsonResponse(processOnDisplayAlerts_(data.staffName));
    
    if (action === "triggerWatchSmsOnly") {
      ensureExpiryWatchSmsColumns_();
      let smsResult = { status: "scheduled", message: "Diary entry saved." };
      if (data.reminderId) smsResult = processExpiryWatchReminderById_(data.reminderId);
      return jsonResponse({ status: "success", type: "expiryWatch", sms: smsResult });
    }

    if (action === "triggerWatchResolvedSms") {
      ensureExpiryWatchSmsColumns_();
      const smsResult = data.reminderId ? processExpiryWatchResolvedSmsById_(data.reminderId) : { status: "error", message: "ID missing" };
      return jsonResponse({ status: "success", type: "expiryWatchResolved", sms: smsResult });
    }

    if (action === "standardLog") {
      submitData(data);
      return jsonResponse({ status: "success", type: "standardLog" });
    }

    return jsonResponse({ status: "error", message: "Unknown Protocol: " + action });
  } catch (error) {
    console.error("doPost Error:", error);
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// ON-DISPLAY EXPIRY PROTOCOL
// ============================================================

function processOnDisplayAlerts_(specificStaffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  let alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME);
  
  if (!alertSheet) {
    alertSheet = ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);
    alertSheet.appendRow(["ID", "Barcode", "Product", "Expiry", "Staff", "Token", "PIN", "Expires At", "Used", "Sent At"]);
  }

  const invData = invSheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0,0,0,0);
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + 7);

  const results = [];
  
  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    const location = String(row[4] || "");
    const qty = parseFloat(row[2] || 0);
    const expiry = parseExpiryWatchDate_(row[3]);
    const staffName = String(row[5] || "").trim().toUpperCase();
    
    if (location === "On Display" && qty > 0 && expiry) {
      if (specificStaffName && staffName !== specificStaffName.toUpperCase()) continue;

      const expiryDay = startOfDay_(expiry);
      if (isSameDay_(expiryDay, targetDate)) {
        const barcode = String(row[1]);
        
        if (!hasSentOnDisplayAlert_(alertSheet, barcode, expiryDay, staffName)) {
          const token = generateSecureToken_();
          const pin = generatePin_();
          const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); 
          const alertId = "oda_" + Date.now() + "_" + i;
          const productName = String(row[6]);

          const smsResult = sendOnDisplaySms_(staffName, productName, barcode, qty, expiryDay, token, pin);
          
          if (smsResult.success) {
            alertSheet.appendRow([alertId, barcode, productName, expiryDay, staffName, token, pin, expiresAt, "No", new Date()]);
            results.push({ barcode, status: "sent" });
          }
        }
      }
    }
  }
  return { status: "success", processed: results.length };
}

function hasSentOnDisplayAlert_(sheet, barcode, expiry, staff) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == barcode && isSameDay_(new Date(data[i][3]), expiry) && String(data[i][4]).toUpperCase() == staff.toUpperCase()) {
      return true;
    }
  }
  return false;
}

function generateSecureToken_() { return Utilities.getUuid().replace(/-/g, '').substring(0, 16); }
function generatePin_() { return Math.floor(1000 + Math.random() * 9000).toString(); }

function isSameDay_(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function sendOnDisplaySms_(staffName, product, barcode, qty, expiry, token, pin) {
  const staffContact = getStaffContactByName_(staffName);
  if (!staffContact || !staffContact.phone) return { success: false };
  
  const recipient = normalizeStaffPhone_(staffContact.phone);
  const link = APP_URL + "/on-display/" + token;
  
  const message = [
    "HIGHLAND HYPERMARKET",
    "ON DISPLAY EXPIRY ALERT",
    "",
    "Personnel: " + staffName,
    "Access Key: " + pin,
    "",
    "Product: " + product,
    "Barcode: " + barcode,
    "Quantity: " + qty,
    "Location: On Display",
    "Expiry: " + formatSmsDate_(expiry),
    "",
    "Check item & submit request:",
    link
  ].join("\n");

  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty("TEXTBEE_API_KEY");
  const deviceId = properties.getProperty("TEXTBEE_DEVICE_ID");

  try {
    const response = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": apiKey },
      payload: JSON.stringify({ message, recipients: [recipient], deviceId }),
      muteHttpExceptions: true
    });
    return { success: response.getResponseCode() === 200 };
  } catch (e) {
    return { success: false };
  }
}

function installOnDisplayDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "processOnDisplayAlertsAutomated") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("processOnDisplayAlertsAutomated").timeBased().everyDays(1).atHour(9).create();
}

function processOnDisplayAlertsAutomated() { processOnDisplayAlerts_(null); }

// ============================================================
// SYSTEM HELPERS
// ============================================================

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function startOfDay_(date) {
  const res = new Date(date.getTime());
  res.setHours(0,0,0,0);
  return res;
}

function formatSmsDate_(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return Utilities.formatDate(date, ss.getSpreadsheetTimeZone(), "dd MMM yyyy");
}

function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setFormResponseSupplierFormula_(sheet, rowNumber) {
  const formula = '=IF(B' + rowNumber + '=\"\",\"\",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&\"\")=TRIM(B' + rowNumber + '&\"\"))+(TRIM(DB!$B$2:$B$100000&\"\")=TRIM(B' + rowNumber + '&\"\")))>0),1),\"Not Found\"))';
  sheet.getRange(rowNumber, 8).setFormula(formula);
}

// REST OF DIARY Reminders / Product management functions remain exactly the same...
// (Assuming standard Diary functions processExpiryWatchReminderById_ etc are below)
