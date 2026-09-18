/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 7.0.0 (Unified Handshake + Grouped Multi-Batch)
 *
 * This script handles:
 * 1. Grouped On-Display Alerts (Today + 7 Days)
 * 2. Expiry Watch (Diary) SMS Reminders (1 Month Threshold)
 * 3. Forensic Audit Mailing
 * 4. Auto-ID generation for DB Sheet
 * 5. REST API Handshake for Next.js
 */

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
const APP_URL = "https://sheetsync-five.vercel.app";
const ADMIN_PASSWORD = "0438";
const RECIPIENT_EMAIL = "ashiqmathath@gmail.com";

// Expiry Watch (Diary) Column Indices (1-based)
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

// On-Display Alert Column Indices (1-based)
const ODA_COL_ID = 1;
const ODA_COL_BARCODE = 2;
const ODA_COL_PRODUCT = 3;
const ODA_COL_EXPIRY = 4;
const ODA_COL_STAFF = 5;
const ODA_COL_TOKEN = 6;
const ODA_COL_PIN = 7;
const ODA_COL_EXPIRES_AT = 8;
const ODA_COL_USED = 9;
const ODA_COL_SENT_AT = 10;

// ============================================================
// AUTO-ID ENGINE (onEdit)
// ============================================================

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const sheetName = sheet.getName();
  
  if (sheetName === DB_SHEET_NAME && range.getColumn() === 1 && range.getRow() > 1) {
    const row = range.getRow();
    const barcode = range.getValue();
    
    if (barcode !== "") {
      const formulaCell = sheet.getRange(row, 7);
      if (formulaCell.getFormula() === "") {
        formulaCell.setFormula(`=IFERROR(IF(A${row}<>"", VLOOKUP(A${row}, '${LOG_SHEET_NAME}'!B:G, 6, FALSE), ""), "")`);
      }
      
      const idCell = sheet.getRange(row, 8);
      if (idCell.getValue() === "") {
        const uniqueId = "prod_" + new Date().getTime() + "_" + Math.random().toString(36).substr(2, 5);
        idCell.setValue(uniqueId);
      }
    }
  }
}

// ============================================================
// GET REQUEST DISPATCHER
// ============================================================

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "getProducts") {
      return getProductJSON();
    }
    return ContentService.createTextOutput("SheetSync Industrial Core Active.");
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// POST REQUEST DISPATCHER
// ============================================================

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("No payload.");
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    const restricted = ["addProduct", "addStaff", "forensicWipe", "triggerWatchSmsOnly", "triggerWatchResolvedSms", "triggerOnDisplayAlerts"];
    if (restricted.includes(action) && data.password !== ADMIN_PASSWORD) {
      throw new Error("Unauthorized Access Key");
    }

    switch(action) {
      case "addProduct": return manageProduct(data);
      case "addStaff": return addNewStaff(data);
      case "forensicWipe": 
        sendWipeAlertEmail(data);
        return jsonResponse({ status: "success", message: "Wipe alert logged." });
      case "triggerWatchSmsOnly":
        ensureExpiryWatchSmsColumns_();
        return jsonResponse({ status: "success", sms: data.reminderId ? processExpiryWatchRowById_(data.reminderId) : "scheduled" });
      case "triggerWatchResolvedSms":
        ensureExpiryWatchSmsColumns_();
        return jsonResponse({ status: "success", sms: data.reminderId ? processExpiryWatchResolvedSmsById_(data.reminderId) : "error" });
      case "triggerOnDisplayAlerts":
        return jsonResponse(processOnDisplayAlerts_(data.staffName));
      case "standardLog":
        submitData(data);
        return jsonResponse({ status: "success" });
      default:
        return jsonResponse({ status: "error", message: "Unknown endpoint: " + action });
    }
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// GROUPED ON-DISPLAY ENGINE
// ============================================================

function processOnDisplayAlerts_(targetStaffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME) || ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);
  
  if (alertSheet.getLastRow() === 0) {
    alertSheet.appendRow(["ID", "Barcode", "Product", "Expiry", "Staff", "Token", "PIN", "Expires At", "Used", "Sent At"]);
  }

  const invData = invSheet.getDataRange().getValues();
  const today = startOfDay_(new Date());
  const threshold = addCalendarDays_(today, 7);

  // GROUPING: Map barcode to batches
  const groups = {};
  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    const barcode = String(row[1] || "").trim();
    const qty = parseFloat(row[2]);
    const expiry = parseExpiryWatchDate_(row[3]);
    const location = String(row[4] || "").trim();
    const staffName = String(row[5] || "").trim();

    if (!barcode || isNaN(qty) || qty <= 0 || location !== "On Display" || !expiry) continue;
    if (targetStaffName && staffName.toUpperCase() !== targetStaffName.toUpperCase()) continue;

    if (expiry <= threshold) {
      if (!groups[barcode]) groups[barcode] = [];
      groups[barcode].push({ row, expiry, staffName, qty, productName: String(row[6] || "Unregistered Product") });
    }
  }

  const barcodes = Object.keys(groups);
  if (barcodes.length === 0) return { status: "success", processed: 0 };

  let count = 0;
  barcodes.forEach(bc => {
    const items = groups[bc];
    const main = items[0];
    const totalQty = items.reduce((s, x) => s + x.qty, 0);

    if (!hasSentOnDisplayAlert_(alertSheet, bc, main.expiry, main.staffName)) {
      const token = Math.random().toString(36).substring(2, 14);
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      
      const sms = [
        "HIGHLAND HYPERMARKET",
        "ON-DISPLAY ALERT: " + main.productName,
        "Staff: " + main.staffName,
        "Access Key: " + pin,
        "Total Qty: " + totalQty,
        "Batches: " + items.length,
        "",
        APP_URL + "/on-display/" + token
      ].join("\n");

      if (sendSmsViaTextBee_(main.staffName, sms).success) {
        alertSheet.appendRow([
          "oda_" + Date.now(), bc, main.productName, main.expiry, main.staffName,
          token, pin, new Date(Date.now() + 86400000), "No", new Date()
        ]);
        count++;
      }
    }
  });

  return { status: "success", processed: count };
}

function hasSentOnDisplayAlert_(sheet, bc, exp, staff) {
  const data = sheet.getDataRange().getValues();
  const sName = String(staff).toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(bc).trim() && 
        isSameDay_(new Date(data[i][3]), exp) && 
        String(data[i][4]).trim().toUpperCase() === sName) return true;
  }
  return false;
}

// ============================================================
// DIARY REMINDER (EXPIRY WATCH) LOGIC
// ============================================================

function processExpiryWatchRowById_(id) {
  const sheet = ensureExpiryWatchSmsColumns_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      return processExpiryWatchRow_(sheet, i + 1, data[i]);
    }
  }
  return "not-found";
}

function processExpiryWatchRow_(sheet, rowNum, row) {
  const status = String(row[WATCH_COL_STATUS - 1]).toLowerCase();
  if (status !== "pending") return "resolved";
  
  const expiry = parseExpiryWatchDate_(row[WATCH_COL_EXPIRY - 1]);
  if (!expiry) return "invalid-date";

  const today = startOfDay_(new Date());
  const threshold = subtractCalendarMonths_(expiry, 1);
  if (today < threshold) return "scheduled";

  const staffName = String(row[WATCH_COL_STAFF - 1]);
  const product = String(row[WATCH_COL_PRODUCT - 1]);
  
  const sms = [
    "HIGHLAND EXPIRY ALERT",
    "Personnel: " + staffName,
    "Product: " + product,
    "Threshold: " + formatSmsDate_(expiry),
    "Identity: " + row[WATCH_COL_BARCODE - 1]
  ].join("\n");

  const res = sendSmsViaTextBee_(staffName, sms);
  if (res.success) {
    sheet.getRange(rowNum, WATCH_COL_SMS_STATUS).setValue("SENT");
    sheet.getRange(rowNum, WATCH_COL_SMS_SENT_AT).setValue(new Date());
    return "sent";
  }
  return "failed";
}

function processExpiryWatchResolvedSmsById_(id) {
  const sheet = ensureExpiryWatchSmsColumns_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[WATCH_COL_ID - 1]).trim() === String(id).trim()) {
      const staffName = String(row[WATCH_COL_STAFF - 1]);
      const sms = ["HIGHLAND DIARY RESOLVED", "Hi " + staffName, row[WATCH_COL_PRODUCT - 1], "Entry has been cleared.", "Thank you."].join("\n");
      const res = sendSmsViaTextBee_(staffName, sms);
      if (res.success) {
        sheet.getRange(i + 1, WATCH_COL_RESOLUTION_SMS_STATUS).setValue("SENT");
        sheet.getRange(i + 1, WATCH_COL_RESOLUTION_SMS_SENT_AT).setValue(new Date());
        return "sent";
      }
    }
  }
  return "error";
}

// ============================================================
// UTILITIES (SMS, AUTH, DATE)
// ============================================================

function sendSmsViaTextBee_(staffName, message) {
  const staff = getStaffContactByName_(staffName);
  if (!staff || !staff.phone) return { success: false };

  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");

  const res = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [normalizeStaffPhone_(staff.phone)], deviceId }),
    muteHttpExceptions: true
  });
  return { success: res.getResponseCode() === 200 };
}

function getStaffContactByName_(name) {
  const sSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = sSheet.getDataRange().getValues();
  let list = [];
  data.forEach(r => { if(r[0] === STAFF_LIST_KEY) list = JSON.parse(r[1]); });
  const match = list.find(s => String(s.name).toUpperCase() === String(name).toUpperCase());
  return match ? { name: match.name, phone: match.phone } : null;
}

function normalizeStaffPhone_(p) {
  let clean = String(p).replace(/\D/g, "");
  if (clean.length === 8) clean = "974" + clean;
  return "+" + clean;
}

function parseExpiryWatchDate_(v) {
  if (v instanceof Date) return v;
  const s = String(v);
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    return parts[0].length === 4 
      ? new Date(parts[0], parts[1]-1, parts[2]) 
      : new Date(parts[2], parts[1]-1, parts[0]);
  }
  return new Date(s);
}

function startOfDay_(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function isSameDay_(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
function addCalendarDays_(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function subtractCalendarMonths_(d, n) { const r = new Date(d); r.setMonth(r.getMonth() - n); return r; }
function formatSmsDate_(d) { return Utilities.formatDate(d, "GMT+3", "dd MMM yyyy"); }
function jsonResponse(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// ============================================================
// LEGACY HANDLERS (Audit, Staff, DB)
// ============================================================

function manageProduct(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DB_SHEET_NAME);
  const bc = String(item.barcode).trim();
  const data = sheet.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]).trim() === bc) { row = i + 1; break; } }
  const vals = [[bc, "", item.name || "", item.supplier || "", item.cost || ""]];
  if (row !== -1) sheet.getRange(row, 1, 1, 5).setValues(vals);
  else sheet.appendRow(vals[0]);
  return jsonResponse({ status: "success" });
}

function addNewStaff(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAFF_SHEET_NAME);
  sheet.appendRow([String(item.staffName).trim()]);
  return jsonResponse({ status: "success" });
}

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOG_SHEET_NAME);
  const ts = item.timestamp ? new Date(item.timestamp) : new Date();
  const nextRow = sheet.getLastRow() + 1;
  const uid = nextRow + "-" + Utilities.formatDate(ts, "GMT+3", "yyyyMMddHHmmss");
  
  sheet.getRange(nextRow, 1, 1, 10).setValues([[
    Utilities.formatDate(ts, "GMT+3", "d/M/yyyy HH:mm:ss"), item.barcode || "", item.quantity || "", item.expiryDate || "",
    item.location || "", item.staffName || "", item.productName || "", item.supplier || "", item.itemType || "", uid
  ]]);
}

function sendWipeAlertEmail(d) {
  const body = `Forensic Wipe triggered by ${d.adminEmail || 'Admin'} for SKU ${d.barcode}. Time: ${new Date().toLocaleString()}`;
  MailApp.sendEmail(RECIPIENT_EMAIL, "❗ SECURITY: Forensic Wipe", body);
}

function ensureExpiryWatchSmsColumns_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPIRY_WATCH_SHEET_NAME);
  if (s.getMaxColumns() < 13) s.insertColumnsAfter(s.getMaxColumns(), 13 - s.getMaxColumns());
  return s;
}

function getProductJSON() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(DB_SHEET_NAME).getDataRange().getValues();
  const staff = ss.getSheetByName(STAFF_SHEET_NAME)?.getDataRange().getValues().flat().filter(String) || [];
  const products = {};
  for(let i=1; i<db.length; i++) {
    const b = String(db[i][0]).trim();
    if(b) products[b] = { name: db[i][2], supplier: db[i][3], cost: db[i][4] };
  }
  return jsonResponse({ products, staff: staff.sort() });
}
