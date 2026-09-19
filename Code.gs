// ============================================================
// CONFIGURATION
// ============================================================

const DB_SHEET_NAME = "DB";
const LOG_SHEET_NAME = "Form responses 2";
const STAFF_SHEET_NAME = "Staff";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";
const STAFF_LIST_KEY = "staffList";

// UPDATE THIS TO YOUR ACTUAL VERCEL URL
const APP_URL = "https://your-sheetsync-url.vercel.app";

// Expiry Watch sheet columns:
// A ID | B Barcode | C Product | D Expiry | E Supplier
// F Status | G Timestamp | H Staff
// I SMS Status | J Last SMS Sent At | K SMS Count
// L Resolution SMS Status | M Resolution SMS Sent At
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

// On Display Alert sheet columns:
// A ID | B Barcode | C Product | D Expiry | E Staff | F Token | G PIN | H Expires At | I Used | J Sent At
const ODA_COL_TOKEN = 5; // Column F
const ODA_COL_PIN = 6;   // Column G
const ODA_COL_USED = 8;  // Column I

const ADMIN_PASSWORD = "0438";
const RECIPIENT_EMAIL = "ashiqmathath@gmail.com";


// ============================================================
// GET REQUEST
// ============================================================

function doGet(e) {
  try {
    if (
      e &&
      e.parameter &&
      e.parameter.action === "getProducts"
    ) {
      return getProductJSON();
    }

    return ContentService
      .createTextOutput("System Active.");

  } catch (error) {
    return jsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}


// ============================================================
// POST REQUEST
// ============================================================

function doPost(e) {
  try {
    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      throw new Error("No POST data received.");
    }

    const data = JSON.parse(
      e.postData.contents
    );

    const action =
      data.action || "";

    // --------------------------------------------------------
    // Restricted actions validation
    // --------------------------------------------------------
    const restrictedActions = [
      "addProduct", 
      "addStaff", 
      "forensicWipe", 
      "triggerWatchSmsOnly", 
      "triggerWatchResolvedSms",
      "triggerOnDisplayAlerts"
    ];

    if (restrictedActions.includes(action)) {
      if (data.password !== ADMIN_PASSWORD) {
        throw new Error("Unauthorized");
      }
    }

    // --------------------------------------------------------
    // Action Dispatcher
    // --------------------------------------------------------

    if (action === "addProduct") {
      return manageProduct(data);
    }

    if (action === "addStaff") {
      return addNewStaff(data);
    }

    if (action === "forensicWipe") {
      sendWipeAlertEmail(data);
      return jsonResponse({
        status: "success",
        message: "Forensic wipe alert processed"
      });
    }

    if (action === "triggerWatchSmsOnly") {
      ensureExpiryWatchSmsColumns_();
      let smsResult = {
        status: "scheduled",
        message: "Reminder saved. SMS will be sent one calendar month before expiry."
      };
      if (data.reminderId) {
        smsResult = processExpiryWatchReminderById_(data.reminderId);
      }
      return jsonResponse({
        status: "success",
        type: "expiryWatch",
        sms: smsResult
      });
    }

    if (action === "triggerWatchResolvedSms") {
      ensureExpiryWatchSmsColumns_();
      const smsResult = data.reminderId
        ? processExpiryWatchResolvedSmsById_(data.reminderId)
        : { status: "error", message: "No reminder ID was supplied." };
      return jsonResponse({
        status: "success",
        type: "expiryWatchResolved",
        sms: smsResult
      });
    }

    // ON DISPLAY TRIGGER (Automated or Manual)
    if (action === "triggerOnDisplayAlerts") {
      return jsonResponse(processOnDisplayAlerts_(data.staffName));
    }

    if (action === "standardLog") {
      submitData(data);
      return jsonResponse({
        status: "success",
        type: "standardLog"
      });
    }

    return jsonResponse({
      status: "error",
      message: "Unknown action: " + action
    });

  } catch (error) {
    console.error("doPost Error:", error);
    return jsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

// ============================================================
// ON-DISPLAY 7-DAY PROTOCOL
// ============================================================

function installOnDisplayDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "processOnDisplayAlerts_") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processOnDisplayAlerts_").timeBased().everyDays(1).atHour(9).create();
}

function processOnDisplayAlerts_(targetStaffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME) || ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);

  if (alertSheet.getLastRow() === 0) {
    alertSheet.appendRow(["ID", "Barcode", "Product", "Expiry", "Staff", "Token", "PIN", "Expires At", "Used", "Sent At"]);
  }

  const invData = invSheet.getDataRange().getValues();
  const today = startOfDay_(new Date());
  const targetDate = addCalendarDays_(today, 7);
  const isManualDispatch = Boolean(targetStaffName && String(targetStaffName).trim());
  const pendingAlerts = [];

  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    const barcode = String(row[1] || "").trim();
    const qty = parseFloat(String(row[2] || "0").replace(/[^0-9.-]+/g, ""));
    const expiry = parseExpiryWatchDate_(row[3]);
    const location = String(row[4] || "").trim();
    const staffName = String(row[5] || "").trim();
    const productName = String(row[6] || "Unregistered Product").trim();

    if (!barcode || isNaN(qty) || qty <= 0 || location !== "On Display" || !expiry) continue;
    if (isManualDispatch && staffName.toUpperCase() !== String(targetStaffName).trim().toUpperCase()) continue;

    const expiryDay = startOfDay_(expiry);
    // A manual trigger is an explicit staff inventory summary: include every
    // on-display log for that staff, not only products at the 7-day threshold.
    // Scheduled runs retain the 7-day rule and duplicate-alert protection.
    const shouldSend = isManualDispatch || (
      isSameDay_(expiryDay, targetDate) &&
      !hasSentOnDisplayAlert_(alertSheet, barcode, expiryDay, staffName)
    );
    if (shouldSend) pendingAlerts.push({ barcode, expiryDay, staffName, productName, qty, rowIndex: i });
  }

  if (pendingAlerts.length === 0) return { status: "success", processed: 0 };

  // Send one staff-level SMS containing every pending product log for that staff.
  // This also keeps automatic runs isolated when more than one staff member has alerts.
  const alertsByStaff = {};
  pendingAlerts.forEach(item => {
    const staffKey = item.staffName.toUpperCase();
    if (!alertsByStaff[staffKey]) alertsByStaff[staffKey] = { staffName: item.staffName, items: [] };
    alertsByStaff[staffKey].items.push(item);
  });

  let processed = 0;
  Object.keys(alertsByStaff).forEach(staffKey => {
    const staffAlerts = alertsByStaff[staffKey];
    const token = generateSecureToken_();
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const smsResult = sendOnDisplaySms_(staffAlerts.staffName, staffAlerts.items, token, pin);

    if (!smsResult.success) return;

    staffAlerts.items.forEach((item, index) => {
      const alertId = "oda_" + Date.now() + "_" + item.rowIndex + "_" + index;
      alertSheet.appendRow([alertId, item.barcode, item.productName, item.expiryDay, item.staffName, token, pin, expiresAt, "No", new Date()]);
      processed++;
    });
  });

  return { status: "success", processed: processed };
}

function hasSentOnDisplayAlert_(sheet, barcode, expiry, staff) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(barcode).trim() &&
        isSameDay_(new Date(data[i][3]), expiry) &&
        String(data[i][4]).trim().toUpperCase() === String(staff).trim().toUpperCase()) return true;
  }
  return false;
}

function generateSecureToken_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function isSameDay_(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function sendOnDisplaySms_(staffName, items, token, pin) {
  const staffContact = getStaffContactByName_(staffName);
  if (!staffContact || !staffContact.phone) return { success: false };

  const recipient = normalizeStaffPhone_(staffContact.phone);
  const link = APP_URL + "/on-display/" + token;
  const productLines = items.map((item, index) => [
    (index + 1) + ". " + item.productName,
    "   Barcode: " + item.barcode + " | Qty: " + item.qty + " | Exp: " + formatSmsDate_(item.expiryDay)
  ].join("\n"));

  const message = [
    "HIGHLAND HYPERMARKET",
    "ON DISPLAY EXPIRY ALERT",
    "",
    "Staff: " + staffName,
    "Access Key: " + pin,
    "",
    "Products requiring attention:",
    productLines.join("\n"),
    "",
    "Please check these products in SheetSync.",
    "",
    "Open:",
    link
  ].join("\n");

  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty("TEXTBEE_API_KEY");
  const deviceId = properties.getProperty("TEXTBEE_DEVICE_ID");

  const response = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [recipient], deviceId }),
    muteHttpExceptions: true
  });

  return { success: response.getResponseCode() === 200 };
}


// ============================================================
// ORIGINAL CORE FUNCTIONS (RETAINED)
// ============================================================

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getProductJSON() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + DB_SHEET_NAME + '" not found.');
  const scriptProperties = PropertiesService.getScriptProperties();
  const dbVersion = scriptProperties.getProperty("DB_VERSION") || "1";
  const productMap = {};
  const supplierSet = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    const data = sheet.getRange(1, 1, lastRow, 5).getValues();
    data.forEach(function (row) {
      const barcode = row[0] ? row[0].toString().trim() : "";
      const name = row[2] ? row[2].toString().trim() : "";
      const supplier = row[3] ? row[3].toString().trim() : "";
      const cost = row[4] || "";
      if (barcode && name) {
        productMap[barcode] = { name: name, supplier: supplier, cost: cost };
      }
      if (supplier && supplier !== "Supplier") supplierSet.add(supplier);
    });
  }
  const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
  let staffList = [];
  if (staffSheet && staffSheet.getLastRow() > 0) {
    staffList = staffSheet.getDataRange().getValues().flat().filter(String);
  }
  return jsonResponse({
    version: dbVersion,
    products: productMap,
    suppliers: Array.from(supplierSet).sort(),
    staff: staffList.sort()
  });
}

function manageProduct(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!dbSheet) throw new Error('Sheet "' + DB_SHEET_NAME + '" not found.');
  if (!item.barcode) throw new Error("Barcode is required.");
  const barcode = item.barcode.toString().trim();
  const data = dbSheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 0; i < data.length; i++) {
    const existingBarcode = data[i][0] ? data[i][0].toString().trim() : "";
    if (existingBarcode === barcode) { foundRow = i + 1; break; }
  }
  const rowData = [barcode, "", item.name || "", item.supplier || "", item.cost || ""];
  if (foundRow !== -1) dbSheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
  else dbSheet.appendRow(rowData);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}

function addNewStaff(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!staffSheet) throw new Error('Sheet "' + STAFF_SHEET_NAME + '" not found.');
  if (!item.staffName || !item.staffName.toString().trim()) throw new Error("Staff name is required.");
  staffSheet.appendRow([item.staffName.toString().trim()]);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}

function updateDbVersion() {
  PropertiesService.getScriptProperties().setProperty("DB_VERSION", Date.now().toString());
}

function ensureExpiryWatchSmsColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EXPIRY_WATCH_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + EXPIRY_WATCH_SHEET_NAME + '" not found.');
  if (sheet.getMaxColumns() < WATCH_COL_SMS_COUNT) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), WATCH_COL_SMS_COUNT - sheet.getMaxColumns());
  }
  sheet.getRange(1, WATCH_COL_SMS_STATUS, 1, 5).setValues([[
    "SMS Status", "Last SMS Sent At", "SMS Count", "Resolution SMS Status", "Resolution SMS Sent At"
  ]]);
  const trackingRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, WATCH_COL_SMS_SENT_AT, trackingRows, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange(2, WATCH_COL_SMS_COUNT, trackingRows, 1).setNumberFormat("0");
  sheet.getRange(2, WATCH_COL_RESOLUTION_SMS_SENT_AT, trackingRows, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  return sheet;
}

function fixExpiryWatchSmsColumnFormats() {
  const sheet = ensureExpiryWatchSmsColumns_();
  const lastRow = Math.max(sheet.getLastRow(), 2);
  sheet.getRange(2, WATCH_COL_SMS_SENT_AT, lastRow - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange(2, WATCH_COL_SMS_COUNT, lastRow - 1, 1).setNumberFormat("0");
  SpreadsheetApp.flush();
  return { status: "success", message: "Expiry Watch SMS formats repaired." };
}

function installExpiryWatchDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "processExpiryWatchSmsReminders") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("processExpiryWatchSmsReminders").timeBased().everyDays(1).atHour(9).create();
  ensureExpiryWatchSmsColumns_();
}

function authorizeExpiryWatchSms() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.send_mail"
  ]);
}

function processExpiryWatchSmsReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const sheet = ensureExpiryWatchSmsColumns_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const rows = sheet.getRange(2, 1, lastRow - 1, WATCH_COL_SMS_COUNT).getValues();
    for (let i = 0; i < rows.length; i++) {
      processExpiryWatchRow_(sheet, i + 2, rows[i]);
    }
  } finally { lock.releaseLock(); }
}

function processExpiryWatchReminderById_(reminderId) {
  const id = String(reminderId || "").trim();
  if (!id) return { status: "scheduled", message: "No ID supplied." };
  const sheet = ensureExpiryWatchSmsColumns_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: "scheduled" };
  const ids = sheet.getRange(2, WATCH_COL_ID, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === id) {
      const row = sheet.getRange(i + 2, 1, 1, WATCH_COL_SMS_COUNT).getValues()[0];
      return processExpiryWatchRow_(sheet, i + 2, row);
    }
  }
  return { status: "scheduled" };
}

function processExpiryWatchRow_(sheet, rowNumber, row) {
  const reminderId = String(row[WATCH_COL_ID - 1] || "").trim();
  const status = String(row[WATCH_COL_STATUS - 1] || "pending").trim().toLowerCase();
  const smsStatus = String(row[WATCH_COL_SMS_STATUS - 1] || "").trim().toUpperCase();
  if (!reminderId || status !== "pending") return { status: "ignored" };
  const expiryDate = parseExpiryWatchDate_(row[WATCH_COL_EXPIRY - 1]);
  if (!expiryDate) {
    sheet.getRange(rowNumber, WATCH_COL_SMS_STATUS).setValue("INVALID DATE");
    return { status: "error" };
  }
  const today = startOfDay_(new Date());
  const expiryDay = startOfDay_(expiryDate);
  const firstReminderDay = subtractCalendarMonths_(expiryDay, 1);
  if (today.getTime() < firstReminderDay.getTime()) return { status: "scheduled" };
  const lastSentAt = parseExpiryWatchDate_(row[WATCH_COL_SMS_SENT_AT - 1]);
  let smsCount = Number(row[WATCH_COL_SMS_COUNT - 1] || 0);
  if (!Number.isFinite(smsCount) || smsCount < 0) smsCount = 0;
  if (lastSentAt && smsCount < 1) smsCount = 1;
  const isFollowUp = !!lastSentAt;
  if (lastSentAt) {
    const nextReminderDay = addCalendarDays_(startOfDay_(lastSentAt), 7);
    if (today.getTime() < nextReminderDay.getTime()) return { status: "waiting" };
  }
  if (smsStatus === "SENT" && !lastSentAt) return { status: "error" };
  try {
    const item = {
      reminderId: reminderId,
      barcode: String(row[WATCH_COL_BARCODE - 1] || "").trim(),
      productName: String(row[WATCH_COL_PRODUCT - 1] || "").trim(),
      expiryDate: formatSheetDate_(expiryDay),
      supplierName: String(row[WATCH_COL_SUPPLIER - 1] || "").trim(),
      staffName: String(row[WATCH_COL_STAFF - 1] || "").trim()
    };
    sendExpiryWatchSms_(item, firstReminderDay, expiryDay, isFollowUp);
    const sentAt = new Date();
    const newSmsCount = smsCount + 1;
    sheet.getRange(rowNumber, WATCH_COL_SMS_STATUS, 1, 3).setValues([["SENT", sentAt, newSmsCount]]);
    sheet.getRange(rowNumber, WATCH_COL_SMS_SENT_AT).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    sheet.getRange(rowNumber, WATCH_COL_SMS_COUNT).setNumberFormat("0");
    return { status: "sent", type: isFollowUp ? "weekly-follow-up" : "first-reminder" };
  } catch (error) {
    sheet.getRange(rowNumber, WATCH_COL_SMS_STATUS).setValue("ERROR");
    return { status: "error", message: error.toString() };
  }
}

function processExpiryWatchResolvedSmsById_(reminderId) {
  const id = String(reminderId || "").trim();
  if (!id) return { status: "error" };
  const sheet = ensureExpiryWatchSmsColumns_();
  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2, 1, lastRow - 1, WATCH_COL_RESOLUTION_SMS_SENT_AT).getValues();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[WATCH_COL_ID - 1] || "").trim() !== id) continue;
    const status = String(row[WATCH_COL_STATUS - 1] || "").trim().toLowerCase();
    const resolutionSmsStatus = String(row[WATCH_COL_RESOLUTION_SMS_STATUS - 1] || "").trim().toUpperCase();
    if (status !== "resolved") return { status: "ignored" };
    if (resolutionSmsStatus === "SENT") return { status: "already-sent" };
    try {
      const properties = PropertiesService.getScriptProperties();
      const apiKey = String(properties.getProperty("TEXTBEE_API_KEY") || "").trim();
      const deviceId = String(properties.getProperty("TEXTBEE_DEVICE_ID") || "").trim();
      const staffName = String(row[WATCH_COL_STAFF - 1] || "").trim();
      const staffContact = getStaffContactByName_(staffName);
      if (!staffContact?.phone) throw new Error("No phone registered.");
      const recipient = normalizeStaffPhone_(staffContact.phone);
      const message = ["HIGHLAND EXPIRY RESOLVED", "Hi " + staffName + ",", String(row[WATCH_COL_PRODUCT - 1]), "Item resolved successfully.", "Thank you."].join("\n");
      UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
        method: "post", contentType: "application/json", headers: { "x-api-key": apiKey },
        payload: JSON.stringify({ message, recipients: [recipient], deviceId }),
        muteHttpExceptions: true
      });
      const sentAt = new Date();
      sheet.getRange(i + 2, WATCH_COL_RESOLUTION_SMS_STATUS).setValue("SENT");
      sheet.getRange(i + 2, WATCH_COL_RESOLUTION_SMS_SENT_AT).setValue(sentAt).setNumberFormat("dd/MM/yyyy HH:mm:ss");
      return { status: "sent", sentAt: sentAt.toISOString() };
    } catch (e) {
      sheet.getRange(i + 2, WATCH_COL_RESOLUTION_SMS_STATUS).setValue("ERROR");
      return { status: "error" };
    }
  }
  return { status: "error" };
}

function sendExpiryWatchSms_(item, reminderDay, expiryDay, isFollowUp) {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = String(properties.getProperty("TEXTBEE_API_KEY") || "").trim();
  const deviceId = String(properties.getProperty("TEXTBEE_DEVICE_ID") || "").trim();
  const staffContact = getStaffContactByName_(item.staffName);
  if (!staffContact?.phone) throw new Error("Staff phone missing.");
  const recipient = normalizeStaffPhone_(staffContact.phone);
  const message = isFollowUp ? 
    ["HIGHLAND EXPIRY FOLLOW-UP", "Hi " + item.staffName + ",", item.productName, "Still pending after 7 days.", "Exp: " + formatSmsDate_(expiryDay)].join("\n") :
    ["HIGHLAND EXPIRY ALERT", "Hi " + item.staffName + ",", item.productName, "Exp: " + formatSmsDate_(expiryDay), "BC: " + item.barcode].join("\n");
  UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post", contentType: "application/json", headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [recipient], deviceId }),
    muteHttpExceptions: true
  });
}

function getStaffContactByName_(staffName) {
  const wantedName = normalizeStaffName_(staffName);
  if (!wantedName) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = settingsSheet?.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
  let staffJson = null;
  data?.forEach(r => { if (String(r[0]).trim() === STAFF_LIST_KEY) staffJson = r[1]; });
  if (!staffJson) return null;
  const staffList = typeof staffJson === "string" ? JSON.parse(staffJson) : staffJson;
  for (let s of staffList) {
    const sName = typeof s === "string" ? s : (s.name || s.staffName || "");
    if (normalizeStaffName_(sName) === wantedName) {
      return typeof s === "string" ? { name: s, phone: "" } : { name: sName, phone: String(s.phone || s.phoneNumber || s.mobile || "") };
    }
  }
  return null;
}

function normalizeStaffName_(v) { return String(v || "").trim().replace(/\s+/g, " ").toUpperCase(); }
function normalizeStaffPhone_(v) {
  let p = String(v || "").trim().replace(/[\s\-\(\)]/g, "");
  if (!p) return "";
  if (p.indexOf("00") === 0) p = "+" + p.substring(2);
  if (/^\d{8}$/.test(p)) p = "+974" + p;
  if (/^974\d{8}$/.test(p)) p = "+" + p;
  return /^\+\d{8,15}$/.test(p) ? p : "";
}

function parseExpiryWatchDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime());
  const t = String(v || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return makeValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return makeValidDate_(Number(m[3]), Number(m[2]), Number(m[1]));
  const p = new Date(t);
  return isNaN(p.getTime()) ? null : p;
}

function makeValidDate_(y, m, d) {
  const date = new Date(y, m - 1, d);
  return (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) ? date : null;
}

function subtractCalendarMonths_(d, m) {
  const res = new Date(d.getTime());
  res.setMonth(res.getMonth() - m);
  return res;
}
function addCalendarDays_(d, days) { const res = new Date(d.getTime()); res.setDate(res.getDate() + days); return res; }
function startOfDay_(d) { const res = new Date(d.getTime()); res.setHours(0, 0, 0, 0); return res; }
function formatSheetDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd"); }
function formatSmsDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "dd MMM yyyy"); }

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const tz = ss.getSpreadsheetTimeZone();
  let entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
  if (isNaN(entryDate.getTime())) entryDate = new Date();
  const nextRow = logSheet.getLastRow() + 1;
  const uniqueId = `${nextRow}-${Utilities.formatDate(entryDate, tz, "yyyyMMddHHmmss")}`;
  logSheet.getRange(nextRow, 1, 1, 10).setValues([[
    Utilities.formatDate(entryDate, tz, "d/M/yyyy HH:mm:ss"), item.barcode || "", item.quantity || "", item.expiryDate || "", 
    item.location || "", item.staff || item.identity || item.staffName || "", item.productName || "", "", item.itemType || item.type || "", uniqueId
  ]]);
  setFormResponseSupplierFormula_(logSheet, nextRow);
  if (item.disableNotification === true) return;
  let alert = item.isSpecial === true;
  if (item.expiryDate) {
    const exp = new Date(item.expiryDate);
    if (!isNaN(exp.getTime())) {
      const today = new Date(); today.setHours(0,0,0,0); exp.setHours(0,0,0,0);
      if (exp <= today) alert = true;
    }
  }
  if (alert) sendExpiryAlertEmail(item, entryDate);
}

function sendExpiryAlertEmail(item, logDate) {
  const dateStr = Utilities.formatDate(logDate, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "EEE, MMM d, yyyy HH:mm");
  const htmlBody = `<div style="font-family:sans-serif;max-width:600px;border:1px solid #eee;border-radius:10px;padding:20px;">
    <h2 style="color:#dc2626;">Expired Item Alert</h2>
    <p>Product: <b>${item.productName}</b></p><p>Barcode: ${item.barcode}</p><p>Qty: ${item.quantity}</p>
    <p>Expiry: <span style="color:#dc2626;">${item.expiryDate}</span></p><p>Logged By: ${item.staff || item.staffName}</p>
    <p>Time: ${dateStr}</p></div>`;
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `⚠️ EXPIRED: ${item.productName}`, htmlBody });
}

function sendWipeAlertEmail(data) {
  const dateStr = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "EEE, MMM d, yyyy HH:mm:ss");
  const htmlBody = `<div style="font-family:sans-serif;max-width:600px;border:1px solid #fecaca;padding:20px;">
    <h2 style="color:#7f1d1d;">Forensic Wipe Alert</h2>
    <p>Admin: ${data.adminEmail || data.identity}</p><p>Target: ${data.barcode}</p><p>Time: ${dateStr}</p></div>`;
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `❗ SECURITY: Forensic Wipe`, htmlBody });
}

function setFormResponseSupplierFormula_(sheet, rowNumber) {
  const formula = '=IF(B' + rowNumber + '=\"\",\"\",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&\"\")=TRIM(B' + rowNumber + '&\"\"))+(TRIM(DB!$B$2:$B$100000&\"\")=TRIM(B' + rowNumber + '&\"\")))>0),1),\"Not Found\"))';
  sheet.getRange(rowNumber, 8).setFormula(formula);
}