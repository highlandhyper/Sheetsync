/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 6.0.0 (Grouped Multi-Batch SMS)
 * 
 * Instructions:
 * 1. Set the APP_URL to your Vercel project URL.
 * 2. Deploy this script as a "Web App" (Execute as: Me, Access: Anyone).
 * 3. Run installOnDisplayDailyTrigger() once from the toolbar.
 */

const APP_URL = "https://sheetsync-five.vercel.app";
const ADMIN_PASSWORD = "0438";

const DB_SHEET_NAME = "DB";
const LOG_SHEET_NAME = "Form responses 2";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";
const AUDIT_LOG_SHEET_NAME = "Audit Log";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";

/**
 * AUTO-ID & FORMULA ENGINE (Columns G/H)
 */
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

/**
 * REST HANDSHAKE (doPost)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.password !== ADMIN_PASSWORD) return JSON_RESPONSE({ status: 'error', message: 'Unauthorized' });

    if (data.action === 'triggerOnDisplayAlerts') {
      return JSON_RESPONSE(triggerOnDisplayAlerts_(data.staffName));
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
function triggerOnDisplayAlerts_(staffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const alertSheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME) || ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);
  const dbSheet = ss.getSheetByName(DB_SHEET_NAME);
  
  if (alertSheet.getLastRow() === 0) {
    alertSheet.appendRow(["Timestamp", "Barcode", "Product", "Expiry", "Staff", "Token", "PIN", "Expires At", "Used"]);
  }

  const data = invSheet.getDataRange().getValues();
  const dbData = dbSheet.getDataRange().getValues();
  
  // Create DB Map for fallback lookup
  const productMap = {};
  for(let i = 1; i < dbData.length; i++) {
    const bc = String(dbData[i][0]).trim();
    if(bc) productMap[bc] = dbData[i][2]; // ProductName is Col C
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const targetStaff = String(staffName).trim().toUpperCase();
  const groups = {};
  let totalProcessed = 0;

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
        groups[bc].push(row);
      }
    }
  }

  const barcodes = Object.keys(groups);
  if (barcodes.length === 0) return { status: 'success', processed: 0 };

  barcodes.forEach(bc => {
    const batches = groups[bc];
    const totalQty = batches.reduce((s, r) => s + parseFloat(r[2]), 0);
    const firstRow = batches[0];
    const pName = String(firstRow[6] || productMap[bc] || "Unregistered Product").trim();
    
    const token = Math.random().toString(36).substr(2, 12);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Log Alert Session
    alertSheet.appendRow([
      new Date(), bc, pName, firstRow[3], staffName, token, pin, 
      new Date(Date.now() + 86400000), "No"
    ]);
    
    // Construct summarized SMS
    const sms = [
      "HIGHLAND HYPERMARKET",
      "ON-DISPLAY ALERT: " + pName,
      "Staff: " + staffName,
      "Access Key: " + pin,
      "Total Qty: " + totalQty,
      "Batches Found: " + batches.length,
      "",
      APP_URL + "/on-display/" + token
    ].join("\n");
    
    sendSmsViaTextBee_(staffName, sms); 
    totalProcessed++;
  });

  return { status: 'success', processed: totalProcessed };
}

/**
 * SMS HANDSHAKE (TextBee)
 */
function sendSmsViaTextBee_(staffName, message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = settingsSheet.getDataRange().getValues();
  
  let staffList = [];
  data.forEach(row => { if (row[0] === 'staffList') try { staffList = JSON.parse(row[1]); } catch(e) {} });

  const member = staffList.find(s => String(s.name).toUpperCase() === String(staffName).toUpperCase());
  if (!member || !member.phone) return;

  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");

  if (!apiKey || !deviceId) return;

  UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey },
    payload: JSON.stringify({ message, recipients: [member.phone], deviceId }),
    muteHttpExceptions: true
  });
}

/**
 * DATE NORMALIZATION
 */
function parseFlexibleDate_(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val);
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    return parts[0].length === 4 
      ? new Date(parts[0], parts[1]-1, parts[2]) 
      : new Date(parts[2], parts[1]-1, parts[0]);
  }
  return new Date(s);
}

/**
 * DAILY CRON JOB
 */
function installOnDisplayDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => { if(t.getHandlerFunction() === 'runDailyOnDisplayScan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runDailyOnDisplayScan').timeBased().everyDays(1).atHour(9).create();
}

function runDailyOnDisplayScan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  const data = settingsSheet.getDataRange().getValues();
  
  let staffList = [];
  data.forEach(row => { if (row[0] === 'staffList') try { staffList = JSON.parse(row[1]); } catch(e) {} });

  staffList.forEach(s => {
    if (s.name) triggerOnDisplayAlerts_(s.name);
  });
}
