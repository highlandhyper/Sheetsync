/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 5.8.0 (Grouped Log Protocol)
 * 
 * DESCRIPTION:
 * Manages automated 7-day expiry alerts, grouped SMS dispatch,
 * secure PIN generation, and legacy registry formulas.
 */

const APP_URL = "https://your-app-url.vercel.app"; // UPDATE TO YOUR VERCEL URL
const MASTER_PASS = "0438"; 

/**
 * 1. ACTION HANDLER (doPost)
 * Routes requests from the Next.js server actions.
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const password = params.password;

    if (password !== MASTER_PASS) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unauthorized Protocol' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'triggerOnDisplayAlerts') {
      const result = triggerOnDisplayAlerts_(params.staffName);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'triggerWatchResolvedSms') {
      const result = triggerWatchResolvedSms_(params.reminderId);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Action Mapping Missing' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. ON-DISPLAY SCANNER (CORE)
 * Groups multiple batches of the same SKU into one SMS.
 */
function triggerOnDisplayAlerts_(staffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName("Form responses 2");
  const alertSheet = ss.getSheetByName("On Display Alerts");
  
  if (!invSheet || !alertSheet) return { status: 'error', message: 'Registry Sheets Missing' };

  const data = invSheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0,0,0,0);
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Grouping logic: { "barcode": { rows: [], productName: "" } }
  const groups = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const itemStaff = String(row[5] || '').trim();
    const loc = String(row[4] || '').trim();
    const qty = parseFloat(row[2]);
    const exp = new Date(row[3]);
    const bc = String(row[1]).trim();
    
    // Condition: Correct Staff + On Display Zone + Active Stock + Expiring in 7 days
    if (itemStaff === staffName && loc === "On Display" && qty > 0 && exp <= threshold) {
      if (!groups[bc]) {
        groups[bc] = { rows: [], productName: String(row[6] || 'Unidentified Item') };
      }
      groups[bc].rows.push(row);
    }
  }

  const barcodes = Object.keys(groups);
  if (barcodes.length === 0) return { status: 'success', processed: 0 };

  let processedCount = 0;

  barcodes.forEach(bc => {
    const group = groups[bc];
    const totalQty = group.rows.reduce((sum, r) => sum + parseFloat(r[2]), 0);
    const token = Math.random().toString(36).substr(2, 12);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 86400000); // 24H window

    // Record alert in registry
    alertSheet.appendRow([
      new Date(), 
      bc, 
      group.productName, 
      "Multiple Batches", 
      staffName, 
      token, 
      pin, 
      expiresAt, 
      "No"
    ]);

    // Construct Grouped SMS
    const msg = [
      "HIGHLAND HYPERMARKET",
      "ON-DISPLAY ALERT: " + group.productName,
      "Personnel: " + staffName,
      "Access Key: " + pin,
      "Total Qty: " + totalQty,
      "Batches: " + group.rows.length,
      "Status: Immediate Action Required",
      "",
      APP_URL + "/on-display/" + token
    ].join("\n");

    const smsSent = sendSmsViaTextBee_(staffName, msg);
    if (smsSent) processedCount++;
  });

  return { status: 'success', processed: processedCount };
}

/**
 * 3. SMS GATEWAY HELPER
 * Fetches personnel phone and dispatches via TextBee API.
 */
function sendSmsViaTextBee_(staffName, message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const settings = settingsSheet.getDataRange().getValues();
  
  // 1. Fetch TextBee Credentials
  let apiKey = "";
  let deviceId = "";
  let smsRecipient = ""; // Default global recipient
  
  settings.forEach(row => {
    const key = String(row[0]);
    if (key === "accessPermissions") {
      try {
        const perms = JSON.parse(row[1]);
        smsRecipient = perms.smsRecipientNumber || "";
        // Optional: override device from sheet if not in ENV
        if (!deviceId) deviceId = perms.smsDeviceId || ""; 
      } catch(e) {}
    }
    if (key === "staffList") {
      try {
        const staff = JSON.parse(row[1]);
        const member = staff.find(s => s.name === staffName);
        if (member && member.phone) smsRecipient = member.phone;
      } catch(e) {}
    }
  });

  // These should ideally be set in Script Properties for security
  const props = PropertiesService.getScriptProperties();
  apiKey = props.getProperty('TEXTBEE_API_KEY');
  deviceId = deviceId || props.getProperty('TEXTBEE_DEVICE_ID');

  if (!apiKey || !deviceId || !smsRecipient) {
    Logger.log("SMS Aborted: Credentials or Recipient missing for " + staffName);
    return false;
  }

  const payload = {
    "message": message,
    "recipients": [smsRecipient],
    "deviceId": deviceId
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "x-api-key": apiKey },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", options);
    return response.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

/**
 * 4. DIARY RESOLVED SMS
 * Sends an immediate alert when a staff member clears a diary item.
 */
function triggerWatchResolvedSms_(reminderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const watchSheet = ss.getSheetByName("Expiry Watch");
  const data = watchSheet.getDataRange().getValues();
  
  const row = data.find(r => String(r[1]) === reminderId);
  if (!row) return { status: 'error', message: 'Reminder not found' };
  
  const staffName = String(row[8] || '').trim();
  const productName = String(row[3] || '');
  
  const msg = [
    "DIARY REGISTRY UPDATED",
    "Product: " + productName,
    "Status: RESOLVED by " + staffName,
    "Trace ID: " + reminderId
  ].join("\n");
  
  const sent = sendSmsViaTextBee_(staffName, msg);
  return { status: 'success', sms: { status: sent ? 'sent' : 'failed' } };
}

/**
 * 5. AUTOMATED TRIGGERS
 */
function installOnDisplayDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => { if (t.getHandlerFunction() === 'runDailyOnDisplayScan') ScriptApp.deleteTrigger(t); });
  
  ScriptApp.newTrigger('runDailyOnDisplayScan')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
}

function runDailyOnDisplayScan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const data = settingsSheet.getDataRange().getValues();
  
  let staff = [];
  data.forEach(row => {
    if (row[0] === "staffList") {
      try { staff = JSON.parse(row[1]); } catch(e) {}
    }
  });
  
  staff.forEach(member => {
    triggerOnDisplayAlerts_(member.name);
  });
}

/**
 * 6. LEGACY FORMULAS & ID GENERATION
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const sheetName = sheet.getName();
  
  // DB Sheet: Auto-ID and Formula Injection
  if (sheetName === "DB" && range.getRow() > 1 && range.getColumn() === 1) {
    const row = range.getRow();
    const barcode = range.getValue();
    
    if (barcode !== "") {
      // Column G: Supplier formula
      const cellG = sheet.getRange(row, 7);
      if (cellG.getValue() === "") {
        cellG.setFormula('=IFERROR(VLOOKUP(A' + row + ',\'Form responses 2\'!B:H,6,FALSE),"NOT FOUND")');
      }
      
      // Column H: Unique ID generation
      const cellH = sheet.getRange(row, 8);
      if (cellH.getValue() === "") {
        const id = "PROD_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        cellH.setValue(id);
      }
    }
  }
}
