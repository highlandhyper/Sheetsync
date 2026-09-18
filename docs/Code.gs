/**
 * SHEETSYNC INDUSTRIAL REGISTRY CORE
 * Version: 6.5.0 (Grouped Multi-Batch & SMS Engine)
 */

const APP_URL = "https://your-app.vercel.app"; // UPDATE THIS TO YOUR VERCEL URL
const ADMIN_PASSWORD = "0438"; 

/**
 * REST HANDSHAKE (doPost)
 * Handles incoming requests from the Next.js frontend.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.password !== ADMIN_PASSWORD) {
      return JSON_RESPONSE({ status: 'error', message: 'Unauthorized: Invalid Admin Key' });
    }

    if (data.action === 'triggerOnDisplayAlerts') {
      return JSON_RESPONSE(triggerOnDisplayAlerts_(data.staffName));
    }
    
    return JSON_RESPONSE({ status: 'error', message: 'Protocol Mapping Failure: Unknown Action' });
  } catch (err) {
    return JSON_RESPONSE({ status: 'error', message: 'Industrial Node Exception: ' + err.toString() });
  }
}

function JSON_RESPONSE(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GROUPED ON-DISPLAY SCANNER
 * Scans for expiring items in "On Display" and groups them by SKU for a single SMS.
 */
function triggerOnDisplayAlerts_(staffName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName("Form responses 2");
  const alertSheet = ss.getSheetByName("On Display Alerts");
  const dbSheet = ss.getSheetByName("DB");
  
  if (!invSheet || !alertSheet) {
    return { status: 'error', message: 'Registry sheets missing.' };
  }

  const data = invSheet.getDataRange().getValues();
  const dbData = dbSheet ? dbSheet.getDataRange().getValues() : [];
  
  // Create Product Map for fallback name lookups
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

  // Scan for matches
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const qty = parseFloat(row[2]);
    if (qty <= 0 || isNaN(qty)) continue;

    const loc = String(row[4] || '').trim();
    const itemStaff = String(row[5] || '').trim().toUpperCase();
    
    // Industrial check: must be "On Display" and match personnel ID
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
    
    // Fallback: Use DB name if log name is blank
    const pName = String(firstRow[6] || productMap[bc] || "SKU: " + bc).trim();
    
    const token = Math.random().toString(36).substr(2, 12);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    
    // 1. Record Alert Session
    alertSheet.appendRow([
      Date.now(), 
      bc, 
      pName, 
      firstRow[3], 
      staffName, 
      token, 
      pin, 
      new Date(Date.now() + 86400000), // 24H TTL
      "No"
    ]);
    
    // 2. Construct Professional SMS
    const sms = [
      "SHEETSYNC: ON-DISPLAY ALERT",
      "Product: " + pName,
      "Access Key: " + pin,
      "Total Qty: " + totalQty,
      "Batches: " + batches.length,
      "",
      "Sync Link:",
      APP_URL + "/on-display/" + token
    ].join("\n");
    
    // 3. Dispatch to Gateway
    sendSmsViaTextBee_(staffName, sms); 
    totalProcessed++;
  });

  return { status: 'success', processed: totalProcessed };
}

/**
 * TEXTBEE SMS GATEWAY
 */
function sendSmsViaTextBee_(staffName, message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const data = settingsSheet.getDataRange().getValues();
  
  let perms = {};
  data.forEach(row => {
    if (row[0] === 'accessPermissions') {
      try { perms = JSON.parse(row[1]); } catch(e) {}
    }
  });

  const apiKey = "YOUR_TEXTBEE_API_KEY"; // Set this or use env vars
  const deviceId = perms.smsDeviceId || "YOUR_DEVICE_ID";
  const phone = perms.smsRecipientNumber;

  if (!apiKey || !phone) return;

  const url = "https://api.textbee.dev/api/v1/gateway/send-sms";
  const options = {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    payload: JSON.stringify({ message, recipients: [phone], deviceId })
  };

  UrlFetchApp.fetch(url, options);
}

/**
 * UTILITY: FLEXIBLE DATE PARSER
 */
function parseFlexibleDate_(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val);
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    // Check for YYYY-MM-DD vs DD/MM/YYYY
    if (parts[0].length === 4) return new Date(parts[0], parts[1]-1, parts[2]);
    return new Date(parts[2], parts[1]-1, parts[0]);
  }
  const d = new Date(s);
  return isValidDate_(d) ? d : null;
}

function isValidDate_(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * AUTOMATION: DAILY SCANNER
 */
function installOnDisplayDailyTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(t => { 
    if(t.getHandlerFunction() === 'runDailyOnDisplayScan') ScriptApp.deleteTrigger(t); 
  });
  ScriptApp.newTrigger('runDailyOnDisplayScan')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}

function runDailyOnDisplayScan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName("APP_SETTINGS");
  const data = settingsSheet.getDataRange().getValues();
  
  let staffList = [];
  data.forEach(row => {
    if (row[0] === 'staffList') {
        try { staffList = JSON.parse(row[1]); } catch(e) {}
    }
  });

  staffList.forEach(s => {
    if (s.name) triggerOnDisplayAlerts_(s.name);
  });
}