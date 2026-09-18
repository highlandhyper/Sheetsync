/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 8.0.0 (Ultimate Consolidated)
 */

const APP_URL = "https://sheetsync-five.vercel.app";
const ADMIN_PASSWORD = "0438";
const RECIPIENT_EMAIL = "ashiqmathath@gmail.com";

const LOG_SHEET_NAME = "Form responses 2";
const DB_SHEET_NAME = "DB";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";

/**
 * REST HANDSHAKE (doPost)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    // Restricted Access Validation
    const restricted = ["addProduct", "addStaff", "forensicWipe", "triggerWatchSmsOnly", "triggerWatchResolvedSms", "triggerOnDisplayAlerts"];
    if (restricted.includes(action) && data.password !== ADMIN_PASSWORD) {
      return JSON_RESPONSE({ status: 'error', message: 'Forbidden' });
    }

    if (action === 'triggerOnDisplayAlerts') {
      return JSON_RESPONSE(triggerOnDisplayAlerts_(data.staffName, true)); // Manual bypass enabled
    }
    
    if (action === 'triggerWatchResolvedSms') {
      return JSON_RESPONSE({ status: 'success', sms: processExpiryWatchResolvedSmsById_(data.reminderId) });
    }

    if (action === 'standardLog') {
      submitData_(data);
      return JSON_RESPONSE({ status: 'success' });
    }

    return JSON_RESPONSE({ status: 'error', message: 'Unknown Action' });
  } catch (err) {
    return JSON_RESPONSE({ status: 'error', message: err.toString() });
  }
}

function JSON_RESPONSE(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GROUPED ON-DISPLAY SCANNER
 */
function triggerOnDisplayAlerts_(staffName, isManual = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME);
  const dbSheet = ss.getSheetByName(DB_SHEET_NAME);
  
  const data = invSheet.getDataRange().getValues();
  const dbData = dbSheet.getDataRange().getValues();
  const productMap = {};
  for(let i = 1; i < dbData.length; i++) {
    const bc = String(dbData[i][0]).trim();
    if(bc) productMap[bc] = dbData[i][2]; // Col C is Name
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const targetStaff = String(staffName).trim().toUpperCase();
  const groups = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const qty = parseFloat(row[2]);
    if (qty <= 0 || isNaN(qty)) continue;

    const loc = String(row[4] || '').trim();
    const itemStaff = String(row[5] || '').trim().toUpperCase();
    
    if (loc === "On Display" && itemStaff === targetStaff) {
      const exp = parseFlexibleDate_(row[3]);
      if (exp && exp <= threshold) {
        const bc = String(row[1]).trim();
        if (!groups[bc]) groups[bc] = [];
        groups[bc].push({ row: row, expiry: exp });
      }
    }
  }

  const barcodes = Object.keys(groups);
  if (barcodes.length === 0) return { status: 'success', processed: 0 };

  let totalProcessed = 0;
  barcodes.forEach(bc => {
    const batches = groups[bc];
    const firstItem = batches[0];
    const totalQty = batches.reduce((s, b) => s + parseFloat(b.row[2]), 0);
    const pName = String(firstItem.row[6] || productMap[bc] || "Unregistered Product").trim();

    if (isManual || !hasSentRecently_(alertSheet, bc, targetStaff)) {
      const token = Math.random().toString(36).substr(2, 12);
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      
      alertSheet.appendRow([Date.now(), bc, pName, firstItem.row[3], staffName, token, pin, new Date(Date.now() + 86400000), "No"]);
      
      // DETAILED COMPLETE SMS CONTENT
      const batchList = batches.map(b => `- ${b.row[2]} units (Exp: ${formatSmsDate_(b.expiry)})`).join("\n");
      const sms = [
        "HIGHLAND HYPERMARKET",
        "ON-DISPLAY ALERT",
        "Product: " + pName,
        "Total Qty: " + totalQty,
        "Batches:",
        batchList,
        "",
        "Access Key: " + pin,
        "Link: " + APP_URL + "/on-display/" + token
      ].join("\n");
      
      const success = sendSmsViaTextBee_(staffName, sms);
      if (success) totalProcessed++;
    }
  });

  return { status: 'success', processed: totalProcessed };
}

function hasSentRecently_(sheet, barcode, staff) {
  const data = sheet.getRange(Math.max(1, sheet.getLastRow() - 50), 1, 50, 9).getValues();
  const today = new Date().setHours(0,0,0,0);
  return data.some(r => String(r[1]) === barcode && String(r[4]).toUpperCase() === staff && new Date(r[0]).setHours(0,0,0,0) === today);
}

function sendSmsViaTextBee_(staffName, message) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");
  const staffObj = getStaffContact_(staffName);
  if (!staffObj?.phone || !apiKey) return false;

  const res = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [normalizePhone_(staffObj.phone)], deviceId }),
    muteHttpExceptions: true
  });
  return res.getResponseCode() === 200;
}

function getStaffContact_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let list = [];
  data.forEach(r => { if(r[0] === 'staffList') list = JSON.parse(r[1]); });
  return list.find(s => String(s.name).toUpperCase() === String(name).toUpperCase());
}

function parseFlexibleDate_(v) {
  if (v instanceof Date) return v;
  const s = String(v);
  const p = s.split(/[-/]/);
  return p.length === 3 ? (p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0])) : new Date(s);
}

function formatSmsDate_(d) {
  return Utilities.formatDate(d, "GMT+3", "dd MMM yyyy");
}

function normalizePhone_(p) {
  let res = String(p).replace(/\D/g, '');
  if (res.length === 8) res = "974" + res;
  return "+" + res;
}

/**
 * LEGACY SYNC & TRIGGERS
 */
function installTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runDailyScan').timeBased().everyDays(1).atHour(9).create();
}

function runDailyScan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let list = [];
  data.forEach(r => { if(r[0] === 'staffList') list = JSON.parse(r[1]); });
  list.forEach(s => triggerOnDisplayAlerts_(s.name, false));
}

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() === "DB" && e.range.getColumn() === 1 && e.range.getRow() > 1) {
    const row = e.range.getRow();
    const cellH = sheet.getRange(row, 8);
    if (!cellH.getValue()) cellH.setValue("prod_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5));
    const cellG = sheet.getRange(row, 7);
    if (!cellG.getFormula()) cellG.setFormula(`=IFERROR(VLOOKUP(A${row}, 'Form responses 2'!B:G, 6, FALSE), "")`);
  }
}
