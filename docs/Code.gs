/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 6.0.0 (On-Display Grouped Protocol)
 *
 * Manual Implementation:
 * 1. Update APP_URL with your Vercel address.
 * 2. Run installOnDisplayDailyTrigger() once.
 */

const APP_URL = "https://your-app.vercel.app"; // UPDATE THIS
const ADMIN_PASSWORD = "0438"; 

/**
 * Main Web Endpoint
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    
    if (params.password !== ADMIN_PASSWORD) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Forbidden' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'triggerOnDisplayAlerts') {
      const result = triggerOnDisplayAlerts_(params.staffName);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'triggerWatchResolvedSms') {
      const result = triggerWatchResolvedSms_(params.reminderId);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 7-Day Grouped Alert Scanner (Manual & Automated)
 */
function triggerOnDisplayAlerts_(staffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName("Form responses 2");
  const alertSheet = ss.getSheetByName("On Display Alerts");
  const data = invSheet.getDataRange().getValues();
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Grouping: { "barcode": [row_objects] }
  const groups = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const itemStaff = String(row[5] || '').trim();
    const loc = String(row[4] || '').trim();
    const qty = parseFloat(row[2]);
    const exp = new Date(row[3]);
    
    // Scan criteria: Correct Staff, "On Display" zone, positive qty, expires within 7 days
    if (itemStaff === staffName && loc === "On Display" && qty > 0 && exp <= threshold) {
      const bc = String(row[1]).trim();
      if (!groups[bc]) groups[bc] = [];
      groups[bc].push(row);
    }
  }

  const barcodes = Object.keys(groups);
  if (barcodes.length === 0) return { status: 'success', processed: 0 };

  barcodes.forEach(bc => {
    const batches = groups[bc];
    const mainItem = batches[0];
    const totalQty = batches.reduce((sum, r) => sum + parseFloat(r[2]), 0);
    
    const token = Math.random().toString(36).substr(2, 12);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h session

    // Registry Entry
    alertSheet.appendRow([
      Date.now(),
      bc,
      mainItem[6] || "Unknown SKU",
      mainItem[3],
      staffName,
      token,
      pin,
      expiration,
      "No"
    ]);

    // SMS Protocol
    const msg = [
      "HIGHLAND HYPERMARKET",
      "ON-DISPLAY ALERT: " + (mainItem[6] || bc),
      "Staff: " + staffName,
      "Access Key: " + pin,
      "Total Qty: " + totalQty,
      "Batches: " + batches.length,
      "",
      APP_URL + "/on-display/" + token
    ].join("\n");

    sendSmsViaTextBee_(staffName, msg);
  });

  return { status: 'success', processed: barcodes.length };
}

/**
 * Automated Daily Trigger Entry
 */
function automatedDailyOnDisplayCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const data = settingsSheet.getDataRange().getValues();
  
  let staffList = [];
  data.forEach(row => {
    if (row[0] === 'staffList') {
      try { staffList = JSON.parse(row[1]); } catch(e) {}
    }
  });

  staffList.forEach(staff => {
    if (staff.name) triggerOnDisplayAlerts_(staff.name);
  });
}

/**
 * SMS Gateway Utility
 */
function sendSmsViaTextBee_(staffName, message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const data = settingsSheet.getDataRange().getValues();
  
  let apiKey = "";
  let deviceId = "";
  let phone = "";
  
  // 1. Get Gateway Config
  data.forEach(row => {
    if (row[0] === 'accessPermissions') {
      try {
        const perms = JSON.parse(row[1]);
        phone = perms.smsRecipientNumber;
        deviceId = perms.smsDeviceId;
      } catch(e) {}
    }
  });

  // 2. Get Staff Specific Phone (if any)
  data.forEach(row => {
    if (row[0] === 'staffList') {
      try {
        const list = JSON.parse(row[1]);
        const member = list.find(s => s.name === staffName);
        if (member && member.phone) phone = member.phone;
      } catch(e) {}
    }
  });

  // 3. Dispatch
  // Note: API Key must be set in Script Properties or env
  const apiKeyProp = PropertiesService.getScriptProperties().getProperty("TEXTBEE_API_KEY");
  if (!apiKeyProp || !deviceId || !phone) return;

  const url = "https://api.textbee.dev/api/v1/gateway/send-sms";
  const options = {
    method: "POST",
    headers: { "x-api-key": apiKeyProp, "Content-Type": "application/json" },
    payload: JSON.stringify({ message, recipients: [phone], deviceId })
  };

  try { UrlFetchApp.fetch(url, options); } catch(e) {}
}

/**
 * Diary Resolved Logic
 */
function triggerWatchResolvedSms_(reminderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const watchSheet = ss.getSheetByName("Expiry Watch");
  const data = watchSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === reminderId) {
      const staffName = data[i][8];
      const product = data[i][3];
      const msg = `SheetSync: Resolved entry for "${product}" has been cleared from your registry.`;
      sendSmsViaTextBee_(staffName, msg);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'ID not found' };
}

/**
 * Unique ID Generation (DB Sheet)
 */
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() === "DB" && e.range.getColumn() === 1 && e.value) {
    const row = e.range.getRow();
    const cellH = sheet.getRange(row, 8);
    if (!cellH.getValue()) {
      const id = "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
      cellH.setValue(id);
    }
  }
}

/**
 * Trigger Management
 */
function installOnDisplayDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'automatedDailyOnDisplayCheck') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('automatedDailyOnDisplayCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}