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

// IMPORTANT: Update this to your deployed Next.js URL
const APP_URL = "https://your-sheetsync-url.vercel.app"; 

// Expiry Watch sheet columns:
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
const ODA_COL_ID = 1;
const ODA_COL_BARCODE = 2;
const ODA_COL_PRODUCT = 3;
const ODA_COL_EXPIRY = 4;
const ODA_COL_STAFF = 5;
const ODA_COL_TOKEN = 6;
const ODA_COL_EXPIRES = 7;
const ODA_COL_USED = 8;
const ODA_COL_SENT_AT = 9;

const ADMIN_PASSWORD = "0438";
const RECIPIENT_EMAIL = "ashiqmathath@gmail.com";


// ============================================================
// GET REQUEST
// ============================================================

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "getProducts") {
      return getProductJSON();
    }
    return ContentService.createTextOutput("System Active.");
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
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    // --------------------------------------------------------
    // Restricted actions
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

    if (action === "addProduct") return manageProduct(data);
    if (action === "addStaff") return addNewStaff(data);
    
    if (action === "forensicWipe") {
      sendWipeAlertEmail(data);
      return jsonResponse({ status: "success", message: "Forensic wipe alert processed" });
    }

    if (action === "triggerWatchSmsOnly") {
      ensureExpiryWatchSmsColumns_();
      let smsResult = { status: "scheduled", message: "Diary saved. SMS handled by daily trigger." };
      if (data.reminderId) smsResult = processExpiryWatchReminderById_(data.reminderId);
      return jsonResponse({ status: "success", type: "expiryWatch", sms: smsResult });
    }

    if (action === "triggerWatchResolvedSms") {
      ensureExpiryWatchSmsColumns_();
      const smsResult = data.reminderId ? processExpiryWatchResolvedSmsById_(data.reminderId) : { status: "error", message: "No ID supplied" };
      return jsonResponse({ status: "success", type: "expiryWatchResolved", sms: smsResult });
    }

    if (action === "triggerOnDisplayAlerts") {
      // Manual trigger for On-Display SMS
      const result = processOnDisplayAlerts_(data.staffName || null);
      return jsonResponse(result);
    }

    if (action === "standardLog") {
      submitData(data);
      return jsonResponse({ status: "success", type: "standardLog" });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });

  } catch (error) {
    console.error("doPost Error:", error);
    return jsonResponse({ status: "error", message: error.toString() });
  }
}


// ============================================================
// ON-DISPLAY EXPIRY ALERTS (7 DAYS)
// ============================================================

function installOnDisplayDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "runDailyOnDisplayCheck") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("runDailyOnDisplayCheck").timeBased().everyDays(1).atHour(10).create();
}

function runDailyOnDisplayCheck() {
  processOnDisplayAlerts_();
}

function processOnDisplayAlerts_(staffNameFilter = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME) || ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);
  
  if (alertSheet.getLastRow() === 0) {
    alertSheet.appendRow(["ID", "Barcode", "Product", "Expiry", "Staff", "Token", "Expires At", "Used", "Sent At"]);
  }

  const invData = invSheet.getDataRange().getValues();
  const today = startOfDay_(new Date());
  const targetDate = addCalendarDays_(today, 7);

  const results = [];
  
  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    const qty = parseFloat(row[2] || 0);
    const location = String(row[4] || "").trim();
    const staffName = String(row[5] || "").trim();
    const expiryDate = parseExpiryWatchDate_(row[3]);

    if (location === "On Display" && qty > 0 && expiryDate) {
      // Apply staff filter if it's a manual trigger
      if (staffNameFilter && normalizeStaffName_(staffName) !== normalizeStaffName_(staffNameFilter)) continue;

      const expiryDay = startOfDay_(expiryDate);
      
      // TRIGGER CONDITION: Exactly 7 days before expiry OR if already within that 7-day window and not yet sent
      if (today.getTime() >= addCalendarDays_(expiryDay, -7).getTime() && today.getTime() < expiryDay.getTime()) {
        const barcode = String(row[1]);
        
        if (!hasSentOnDisplayAlert_(alertSheet, barcode, expiryDay, staffName)) {
          const token = generateSecureToken_();
          const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours
          const alertId = "oda_" + Date.now() + "_" + i;
          const productName = String(row[6]);

          const smsResult = sendOnDisplaySms_(staffName, productName, barcode, qty, expiryDay, token);
          
          if (smsResult.success) {
            alertSheet.appendRow([alertId, barcode, productName, expiryDay, staffName, token, expiresAt, "No", new Date()]);
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
  const normStaff = normalizeStaffName_(staff);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(barcode) && isSameDay_(new Date(data[i][3]), expiry) && normalizeStaffName_(data[i][4]) === normStaff) return true;
  }
  return false;
}

function generateSecureToken_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function isSameDay_(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function sendOnDisplaySms_(staffName, product, barcode, qty, expiry, token) {
  const staffContact = getStaffContactByName_(staffName);
  if (!staffContact || !staffContact.phone) return { success: false };
  
  const recipient = normalizeStaffPhone_(staffContact.phone);
  const link = APP_URL + "/on-display/" + token;
  
  const message = [
    "HIGHLAND HYPERMARKET",
    "ON DISPLAY EXPIRY ALERT",
    "",
    "Product: " + product,
    "Barcode: " + barcode,
    "Quantity: " + qty,
    "Location: On Display",
    "Expiry: " + formatSmsDate_(expiry),
    "",
    "Please check this product in SheetSync.",
    "",
    "Open:",
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


// ============================================================
// JSON RESPONSE HELPER
// ============================================================

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// GET PRODUCT DATABASE
// ============================================================

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
      if (barcode && name) productMap[barcode] = { name: name, supplier: supplier, cost: cost };
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


// ============================================================
// ADD / UPDATE PRODUCT
// ============================================================

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
    if (existingBarcode === barcode) {
      foundRow = i + 1;
      break;
    }
  }

  const rowData = [barcode, "", item.name || "", item.supplier || "", item.cost || ""];
  if (foundRow !== -1) dbSheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
  else dbSheet.appendRow(rowData);

  updateDbVersion();
  return jsonResponse({ status: "success" });
}


// ============================================================
// ADD NEW STAFF
// ============================================================

function addNewStaff(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!staffSheet) throw new Error('Sheet "' + STAFF_SHEET_NAME + '" not found.');
  if (!item.staffName || !item.staffName.toString().trim()) throw new Error("Staff name is required.");

  staffSheet.appendRow([item.staffName.toString().trim()]);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}


// ============================================================
// UPDATE DATABASE VERSION
// ============================================================

function updateDbVersion() {
  PropertiesService.getScriptProperties().setProperty("DB_VERSION", Date.now().toString());
}


// ============================================================
// EXPIRY WATCH - SMS TRACKING
// ============================================================

function ensureExpiryWatchSmsColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EXPIRY_WATCH_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + EXPIRY_WATCH_SHEET_NAME + '" not found.');

  if (sheet.getMaxColumns() < WATCH_COL_RESOLUTION_SMS_SENT_AT) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), WATCH_COL_RESOLUTION_SMS_SENT_AT - sheet.getMaxColumns());
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
  } finally {
    lock.releaseLock();
  }
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

  if (lastSentAt) {
    const nextReminderDay = addCalendarDays_(startOfDay_(lastSentAt), 7);
    if (today.getTime() < nextReminderDay.getTime()) return { status: "waiting" };
  }

  try {
    const item = {
      reminderId,
      barcode: String(row[WATCH_COL_BARCODE - 1] || "").trim(),
      productName: String(row[WATCH_COL_PRODUCT - 1] || "").trim(),
      expiryDate: formatSheetDate_(expiryDay),
      staffName: String(row[WATCH_COL_STAFF - 1] || "").trim()
    };

    sendExpiryWatchSms_(item, firstReminderDay, expiryDay, !!lastSentAt);

    sheet.getRange(rowNumber, WATCH_COL_SMS_STATUS, 1, 3).setValues([["SENT", new Date(), smsCount + 1]]);
    return { status: "sent" };
  } catch (error) {
    sheet.getRange(rowNumber, WATCH_COL_SMS_STATUS).setValue("ERROR");
    return { status: "error", message: error.toString() };
  }
}

function processExpiryWatchResolvedSmsById_(reminderId) {
  const id = String(reminderId || "").trim();
  const sheet = ensureExpiryWatchSmsColumns_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: "error" };

  const rows = sheet.getRange(2, 1, lastRow - 1, WATCH_COL_RESOLUTION_SMS_SENT_AT).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][WATCH_COL_ID - 1] || "").trim() !== id) continue;
    
    const rowNumber = i + 2;
    if (String(rows[i][WATCH_COL_STATUS - 1]).toLowerCase() !== "resolved") return { status: "ignored" };
    if (String(rows[i][WATCH_COL_RESOLUTION_SMS_STATUS - 1]).toUpperCase() === "SENT") return { status: "already-sent" };

    const staffName = String(rows[i][WATCH_COL_STAFF - 1]).trim();
    const productName = String(rows[i][WATCH_COL_PRODUCT - 1]).trim();
    const barcode = String(rows[i][WATCH_COL_BARCODE - 1]).trim();
    const expiryDate = parseExpiryWatchDate_(rows[i][WATCH_COL_EXPIRY - 1]);

    try {
      const staffContact = getStaffContactByName_(staffName);
      if (!staffContact?.phone) throw new Error("No phone contact.");
      const recipient = normalizeStaffPhone_(staffContact.phone);

      const message = [
        "HIGHLAND EXPIRY RESOLVED",
        "Hi " + staffName + ",",
        productName,
        "This item has been resolved.",
        "Exp: " + (expiryDate ? formatSmsDate_(expiryDate) : "-"),
        "BC: " + barcode
      ].join("\n");

      UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": PropertiesService.getScriptProperties().getProperty("TEXTBEE_API_KEY") },
        payload: JSON.stringify({ message, recipients: [recipient], deviceId: PropertiesService.getScriptProperties().getProperty("TEXTBEE_DEVICE_ID") })
      });

      sheet.getRange(rowNumber, WATCH_COL_RESOLUTION_SMS_STATUS, 1, 2).setValues([["SENT", new Date()]]);
      return { status: "sent" };
    } catch (e) {
      sheet.getRange(rowNumber, WATCH_COL_RESOLUTION_SMS_STATUS).setValue("ERROR");
      return { status: "error", message: e.toString() };
    }
  }
  return { status: "error" };
}

function sendExpiryWatchSms_(item, reminderDay, expiryDay, isFollowUp) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");

  const staffContact = getStaffContactByName_(item.staffName);
  if (!staffContact?.phone) throw new Error("Staff phone missing.");
  const recipient = normalizeStaffPhone_(staffContact.phone);

  const message = isFollowUp
    ? `HIGHLAND EXPIRY FOLLOW-UP\nHi ${item.staffName},\n${item.productName}\nStill pending after 7 days.\nExp: ${formatSmsDate_(expiryDay)}`
    : `HIGHLAND EXPIRY ALERT\nHi ${item.staffName},\n${item.productName}\nExp: ${formatSmsDate_(expiryDay)}\nBC: ${item.barcode}`;

  UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [recipient], deviceId })
  });
}


// ============================================================
// HELPERS & LOOKUPS
// ============================================================

function getStaffContactByName_(staffName) {
  const wantedName = normalizeStaffName_(staffName);
  if (!wantedName) return null;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  if (!settingsSheet) return null;

  const data = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
  let staffJson = null;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === STAFF_LIST_KEY) staffJson = data[i][1];
  }

  if (!staffJson) return null;
  const staffList = typeof staffJson === "string" ? JSON.parse(staffJson) : staffJson;
  if (!Array.isArray(staffList)) return null;

  for (let s of staffList) {
    if (typeof s === "string") {
      if (normalizeStaffName_(s) === wantedName) return { name: s, phone: "" };
      continue;
    }
    if (normalizeStaffName_(s.name || s.staffName) === wantedName) {
      return { name: s.name || staffName, phone: String(s.phone || s.phoneNumber || s.mobile || "").trim() };
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
  const iso = parseISO(t);
  if (isValid(iso)) return iso;
  const p = new Date(t);
  return isNaN(p.getTime()) ? null : p;
}

function startOfDay_(d) {
  const res = new Date(d.getTime());
  res.setHours(0, 0, 0, 0);
  return res;
}

function subtractCalendarMonths_(d, m) {
  const res = new Date(d.getTime());
  res.setMonth(res.getMonth() - m);
  return res;
}

function addCalendarDays_(d, days) {
  const res = new Date(d.getTime());
  res.setDate(res.getDate() + days);
  return res;
}

function formatSheetDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd"); }
function formatSmsDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "dd MMM yyyy"); }

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const tz = ss.getSpreadsheetTimeZone();
  const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
  const nextRow = logSheet.getLastRow() + 1;
  const uniqueId = `${nextRow}-${Utilities.formatDate(entryDate, tz, "yyyyMMddHHmmss")}`;

  logSheet.getRange(nextRow, 1, 1, 10).setValues([[
    Utilities.formatDate(entryDate, tz, "d/M/yyyy HH:mm:ss"),
    item.barcode || "", item.quantity || "", item.expiryDate || "",
    item.location || "", item.staff || item.staffName || "",
    item.productName || "", "", item.itemType || "", uniqueId
  ]]);
  
  setFormResponseSupplierFormula_(logSheet, nextRow);
  if (item.disableNotification !== true) checkAndSendExpiryAlert(item, entryDate);
}

function checkAndSendExpiryAlert(item, logDate) {
  if (!item.expiryDate) return;
  const exp = new Date(item.expiryDate);
  const today = startOfDay_(new Date());
  if (!isNaN(exp.getTime()) && startOfDay_(exp) <= today) {
    try { sendExpiryAlertEmail(item, logDate); } catch(e) {}
  }
}

function sendExpiryAlertEmail(item, logDate) {
  const dateStr = Utilities.formatDate(logDate, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "EEE, MMM d, yyyy HH:mm");
  const htmlBody = `<div style="font-family:sans-serif;max-width:600px;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="background:#dc2626;padding:20px;color:white"><h2>Expired Item Alert</h2></div>
    <div style="padding:20px">
      <p>Product: <b>${item.productName}</b></p>
      <p>Barcode: ${item.barcode}</p>
      <p>Qty: ${item.quantity}</p>
      <p>Expiry: <span style="color:red">${item.expiryDate}</span></p>
      <p>Staff: ${item.staffName || item.staff}</p>
      <p>Log Time: ${dateStr}</p>
    </div>
  </div>`;
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `⚠️ EXPIRED ITEM: ${item.productName}`, htmlBody });
}

function sendWipeAlertEmail(data) {
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  const dateStr = Utilities.formatDate(ts, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "EEE, MMM d, yyyy HH:mm:ss");
  const htmlBody = `<div style="font-family:sans-serif;max-width:600px;border:1px solid #fecaca;border-radius:10px;overflow:hidden">
    <div style="background:#7f1d1d;padding:20px;color:white"><h2>Forensic Wipe Alert</h2></div>
    <div style="padding:20px">
      <p>Admin: ${data.adminEmail || 'Unknown'}</p>
      <p>Barcode: ${data.barcode}</p>
      <p>Reason: ${data.reason}</p>
      <p>Time: ${dateStr}</p>
    </div>
  </div>`;
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `❗ SECURITY ALERT: Forensic Wipe (${data.barcode})`, htmlBody });
}

function setFormResponseSupplierFormula_(sheet, rowNumber) {
  const formula = '=IF(B' + rowNumber + '=\"\",\"\",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&\"\")=TRIM(B' + rowNumber + '&\"\"))+(TRIM(DB!$B$2:$B$100000&\"\")=TRIM(B' + rowNumber + '&\"\")))>0),1),\"Not Found\"))';
  sheet.getRange(rowNumber, 8).setFormula(formula);
}

function parseISO(s) { return new Date(s); }
function isValid(d) { return d instanceof Date && !isNaN(d.getTime()); }