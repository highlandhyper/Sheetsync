
// ============================================================
// HIGHLAND HYPERMARKET - SHEETSYNC GOOGLE APPS SCRIPT
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const DB_SHEET_NAME = "DB";
const LOG_SHEET_NAME = "Form responses 2";
const STAFF_SHEET_NAME = "Staff";
const AUDIT_LOG_SHEET_NAME = "Audit Log";
const EXPIRY_WATCH_SHEET_NAME = "Expiry Watch";
const APP_SETTINGS_SHEET_NAME = "APP_SETTINGS";
const ON_DISPLAY_ALERTS_SHEET_NAME = "On Display Alerts";

const STAFF_LIST_KEY = "staffList";
const SUPPLIER_CONTACTS_KEY = "supplierContacts";

// App Domain
const APP_URL = "https://sheetsync-five.vercel.app";

// ------------------------------------------------------------
// LOG SHEET COLUMNS (Form responses 2)
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
const INV_COL_REPORTED_AT = 10; 

// ------------------------------------------------------------
// EXPIRY WATCH COLUMNS
// ------------------------------------------------------------
const WATCH_COL_ID = 1;
const WATCH_COL_BARCODE = 2;
const WATCH_COL_PRODUCT = 3;
const WATCH_COL_EXPIRY = 4;
const WATCH_COL_SUPPLIER = 5;
const WATCH_COL_STATUS = 6;
const WATCH_COL_TIMESTAMP = 7;
const WATCH_COL_STAFF = 8;

// ------------------------------------------------------------
// ON DISPLAY ALERT COLUMNS
// ------------------------------------------------------------
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
const ODA_COL_LOG_ROW = 11;
const ODA_COL_LOG_ID = 12;

// ------------------------------------------------------------
// SECURITY / EMAIL
// ------------------------------------------------------------
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
    console.error("doGet Error:", error);
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

    const restrictedActions = [
      "addProduct",
      "addStaff",
      "forensicWipe",
      "triggerWatchSmsOnly",
      "triggerWatchResolvedSms",
      "triggerOnDisplayAlerts",
      "sendAdminExpiryAlert",
      "triggerWeeklyReports",
      "sendManualSupplierReport"
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
      let smsResult = { status: "scheduled", message: "Reminder saved." };
      if (data.reminderId) smsResult = processExpiryWatchReminderById_(data.reminderId);
      return jsonResponse({ status: "success", type: "expiryWatch", sms: smsResult });
    }
    if (action === "triggerWatchResolvedSms") {
      ensureExpiryWatchSmsColumns_();
      const smsResult = data.reminderId ? processExpiryWatchResolvedSmsById_(data.reminderId) : { status: "error", message: "No ID." };
      return jsonResponse({ status: "success", type: "expiryWatchResolved", sms: smsResult });
    }
    if (action === "triggerOnDisplayAlerts") {
      const requestedStaff = String(data.staffName || "").trim();
      return jsonResponse(processOnDisplayAlerts_(requestedStaff, requestedStaff !== ""));
    }
    if (action === "sendAdminExpiryAlert") {
      if (!data.item) throw new Error("Item data missing.");
      sendExpiryAlertEmail(data.item, new Date());
      return jsonResponse({ status: "success", message: "Admin alert email sent." });
    }
    if (action === "standardLog") {
      submitData(data);
      return jsonResponse({ status: "success", type: "standardLog" });
    }
    if (action === "triggerWeeklyReports") {
      return jsonResponse(generateWeeklySupplierReports());
    }
    if (action === "sendManualSupplierReport") {
      return jsonResponse(sendSingleSupplierReport_(data.supplierName));
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (error) {
    console.error("doPost Error:", error);
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// STANDARD LOG - OPTIMIZED HANDSHAKE
// ============================================================

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) throw new Error('Sheet "' + LOG_SHEET_NAME + '" not found.');

  const tz = ss.getSpreadsheetTimeZone();
  const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
  const nextRow = logSheet.getLastRow() + 1;
  const uniqueId = item.id || `${nextRow}-${Utilities.formatDate(entryDate, tz, "yyyyMMddHHmmss")}`;

  logSheet.getRange(nextRow, 1, 1, 10).setValues([[
    Utilities.formatDate(entryDate, tz, "d/M/yyyy HH:mm:ss"),
    item.barcode || "",
    item.quantity || "",
    item.expiryDate || "",
    item.location || "",
    item.staffName || item.staff || item.identity || "",
    item.productName || "",
    "", // Supplier (auto-filled by formula)
    item.itemType || item.type || "",
    uniqueId
  ]]);

  setFormResponseSupplierFormula_(logSheet, nextRow);

  // INTERNAL AUDIT LOGGING: Fast, server-side
  logAuditEvent_(item.userEmail || "Terminal", "LOG_INVENTORY", item.barcode || "N/A", `[LOGGED] Qty: ${item.quantity} | Loc: ${item.location}`);

  if (item.disableNotification === true) return;

  // ASYNCHRONOUS NOTIFICATIONS (Simulated via script flow)
  try {
    sendSevenDayExpiryStaffSmsIfDue_(item, entryDate);
    triggerSupplierInstantNotification_(item);
    
    if (item.expiryDate) {
      const expiryDate = parseSevenDaySmsDate_(item.expiryDate, tz);
      if (expiryDate) {
        const todayKey = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
        const expiryKey = Utilities.formatDate(expiryDate, tz, "yyyy-MM-dd");
        if (expiryKey <= todayKey) {
          sendExpiryAlertEmail(item, entryDate);
        }
      }
    }
  } catch (e) {
      console.warn("Non-blocking notification error:", e);
  }
}

// ============================================================
// SUPPLIER INSTANT NOTIFICATION
// ============================================================

function triggerSupplierInstantNotification_(item) {
  const supplierName = item.supplierName || item.supplier;
  if (!supplierName || supplierName === "Not Found") return;

  const supplier = getSupplierContactByName_(supplierName);
  if (supplier && supplier.phone) {
    const msg = `SHEETSYNC: New item logged for your catalog. Product: ${item.productName}. Qty: ${item.quantity}. Live portal: ${APP_URL}/supplier-portal/${supplier.supplierCode}`;
    sendTextbeeSms_(supplier.phone, msg);
  }
}

// ============================================================
// SINGLE SUPPLIER MANUAL REPORT
// ============================================================

function sendSingleSupplierReport_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const contact = (meta.supplierContacts || []).find(c => c.name.toLowerCase() === name.toLowerCase());
  
  if (!contact || !contact.email) return { status: "error", message: "Supplier email not registered." };
  
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).getValues();
  const supplierLogs = data.filter(row => String(row[7]).toLowerCase() === name.toLowerCase() && (row[10] === "" || row[10] === null));
  
  if (supplierLogs.length === 0) return { status: "error", message: "No new logs identified for this vendor." };
  
  const reportedDate = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  let tableRows = "";
  supplierLogs.forEach(l => {
    tableRows += `<tr><td>${l[6]}</td><td>${l[1]}</td><td>${l[2]}</td><td>${l[3]}</td></tr>`;
  });
  
  const htmlBody = `
    <div style="font-family:sans-serif; max-width:600px; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
      <h2 style="color:#0f172a;">Manual Inventory Report</h2>
      <p>Dear ${name},</p>
      <p>This is a manual inventory summary requested from our terminal.</p>
      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:8px; font-size:12px;">Product</th>
          <th style="padding:8px; font-size:12px;">Barcode</th>
          <th style="padding:8px; font-size:12px;">Qty</th>
          <th style="padding:8px; font-size:12px;">Expiry</th>
        </tr>
        ${tableRows}
      </table>
      <div style="margin-top:30px; text-align:center;">
        <a href="${APP_URL}/supplier-portal/${contact.supplierCode}" style="background:#000; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">View Live Portal</a>
      </div>
    </div>
  `;
  
  MailApp.sendEmail({
    to: contact.email,
    subject: `Manual Inventory Report - ${name}`,
    htmlBody: htmlBody
  });
  
  // Mark these specific rows as reported
  const allDataWithRows = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).getValues();
  allDataWithRows.forEach((row, i) => {
    if (String(row[7]).toLowerCase() === name.toLowerCase() && (row[10] === "" || row[10] === null)) {
      logSheet.getRange(i + 2, 11).setValue(reportedDate);
    }
  });
  
  return { status: "success" };
}

// ============================================================
// WEEKLY SUPPLIER REPORT ENGINE
// ============================================================

function generateWeeklySupplierReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const supplierContacts = meta.supplierContacts || [];
  
  if (logSheet.getLastRow() < 2) return { status: "success", message: "No data." };
  
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).getValues();
  const unreportedLogs = data.filter(row => row[10] === "" || row[10] === null);
  
  if (unreportedLogs.length === 0) return { status: "success", message: "No new logs." };
  
  const groupedBySupplier = {};
  unreportedLogs.forEach(row => {
    const name = row[7]; // Supplier Name
    if (!groupedBySupplier[name]) groupedBySupplier[name] = [];
    groupedBySupplier[name].push(row);
  });
  
  let reportsSent = 0;
  const now = new Date();
  
  Object.keys(groupedBySupplier).forEach(name => {
    const contact = supplierContacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (contact && contact.email) {
      const logs = groupedBySupplier[name];
      const previousValue = contact.lastReportValue || 0;
      
      let tableRows = "";
      logs.forEach(l => {
        tableRows += `<tr><td>${l[6]}</td><td>${l[1]}</td><td>${l[2]}</td><td>${l[3]}</td></tr>`;
      });
      
      const htmlBody = `
        <div style="font-family:sans-serif; max-width:600px; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
          <h2 style="color:#0f172a;">Weekly Inventory Report</h2>
          <p>Dear ${name},</p>
          <p>This is your automated weekly inventory log summary.</p>
          <div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:20px;">
            <p style="margin:0; font-size:12px; color:#64748b;">PREVIOUS REPORT VALUE</p>
            <p style="margin:0; font-size:18px; font-weight:bold;">QAR ${previousValue.toLocaleString()}</p>
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:20px;">
            <tr style="background:#f1f5f9; text-align:left;">
              <th style="padding:8px; font-size:12px;">Product</th>
              <th style="padding:8px; font-size:12px;">Barcode</th>
              <th style="padding:8px; font-size:12px;">Qty</th>
              <th style="padding:8px; font-size:12px;">Expiry</th>
            </tr>
            ${tableRows}
          </table>
          <div style="margin-top:30px; text-align:center;">
            <a href="${APP_URL}/supplier-portal/${contact.supplierCode}" style="background:#000; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">View Live Portal</a>
          </div>
        </div>
      `;
      
      MailApp.sendEmail({
        to: contact.email,
        subject: `Weekly Inventory Report - ${name}`,
        htmlBody: htmlBody
      });
      reportsSent++;
    }
  });
  
  // Mark as reported
  const reportedDate = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const lastRow = logSheet.getLastRow();
  const statusColumnValues = [];
  for (let i = 2; i <= lastRow; i++) {
    statusColumnValues.push([reportedDate]);
  }
  logSheet.getRange(2, 11, statusColumnValues.length, 1).setValues(statusColumnValues);
  
  return { status: "success", reportsSent };
}

// ============================================================
// AUDIT LOG HELPER
// ============================================================

function logAuditEvent_(user, action, target, details) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);
    if (!sheet) return;
    const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([ts, user, action, target, details]);
}

// ============================================================
// PRESERVED HELPERS & CORE LOGIC
// ============================================================

function getSupplierContactByName_(name) {
  const meta = getAppMetaData();
  return (meta.supplierContacts || []).find(s => s.name.toLowerCase() === name.toLowerCase());
}

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

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getProductJSON() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!sheet) throw new Error('DB not found.');
  const props = PropertiesService.getScriptProperties();
  const dbVersion = props.getProperty("DB_VERSION") || "1";
  const productMap = {};
  const supplierSet = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    const data = sheet.getRange(1, 1, lastRow, 5).getValues();
    data.forEach(row => {
      const barcode = String(row[0] || "").trim();
      const name = String(row[2] || "").trim();
      const supplier = String(row[3] || "").trim();
      if (barcode && name) productMap[barcode] = { name, supplier, cost: row[4] || "" };
      if (supplier && supplier !== "Supplier") supplierSet.add(supplier);
    });
  }
  const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
  let staffList = [];
  if (staffSheet && staffSheet.getLastRow() > 0) staffList = staffSheet.getDataRange().getValues().flat().filter(String);
  return jsonResponse({ version: dbVersion, products: productMap, suppliers: Array.from(supplierSet).sort(), staff: staffList.sort() });
}

function manageProduct(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!dbSheet) throw new Error('DB not found.');
  const barcode = String(item.barcode || "").trim();
  const data = dbSheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 0; i < data.length; i++) { if (String(data[i][0]).trim() === barcode) { foundRow = i + 1; break; } }
  const rowData = [barcode, "", item.name || "", item.supplier || "", item.cost || ""];
  if (foundRow !== -1) dbSheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
  else dbSheet.appendRow(rowData);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}

function addNewStaff(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!staffSheet) throw new Error('Staff sheet not found.');
  staffSheet.appendRow([String(item.staffName || "").trim()]);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}

function updateDbVersion() { PropertiesService.getScriptProperties().setProperty("DB_VERSION", Date.now().toString()); }

// ============================================================
// PRESERVED ON-DISPLAY & EXPIRY WATCH
// ============================================================

function processOnDisplayAlerts_(targetStaffName, forceManual) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { status: "error", message: "Locked." };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const alertSheet = getOrCreateOnDisplayAlertSheet_();
    const lastRow = invSheet.getLastRow();
    if (lastRow < 2) return { status: "success", processed: 0 };
    const invData = invSheet.getRange(1, 1, lastRow, 10).getValues();
    const today = startOfDay_(new Date());
    const sevenDays = startOfDay_(addCalendarDays_(today, 7));
    const wantedStaff = normalizeStaffName_(targetStaffName);
    const pendingAlerts = [];
    for (let i = 1; i < invData.length; i++) {
      const row = invData[i];
      const barcode = String(row[1] || "").trim();
      const qty = parseFloat(String(row[2] || "0").replace(/[^0-9.-]+/g,""));
      const expiry = parseExpiryWatchDate_(row[3]);
      const location = String(row[4] || "").trim();
      const staffName = String(row[5] || "").trim();
      const productName = String(row[6] || "Unregistered").trim();
      const logId = String(row[9] || "").trim();
      if (!barcode || isNaN(qty) || qty <= 0 || !expiry) continue;
      if (normalizeLocation_(location) !== "ON DISPLAY") continue;
      if (wantedStaff && normalizeStaffName_(staffName) !== wantedStaff) continue;
      const expiryDay = startOfDay_(expiry);
      if (expiryDay < today || expiryDay > sevenDays) continue;
      if (!forceManual && hasOnDisplayLogBeenSent_(alertSheet, { sheetRow: i+1, logId })) continue;
      pendingAlerts.push({ barcode, expiryDay, staffName, productName, qty, sheetRow: i+1, logId });
    }
    if (pendingAlerts.length === 0) return { status: "success", processed: 0 };
    const alertsByStaff = {};
    pendingAlerts.forEach(item => {
      const k = normalizeStaffName_(item.staffName);
      if (!alertsByStaff[k]) alertsByStaff[k] = { staffName: item.staffName, items: [] };
      alertsByStaff[k].items.push(item);
    });
    let processed = 0;
    Object.keys(alertsByStaff).forEach(k => {
      const s = alertsByStaff[k];
      const token = generateSecureToken_();
      const pin = generateOnDisplayPin_();
      const smsRes = sendOnDisplaySms_(s.staffName, s.items, token, pin);
      if (smsRes.success) {
        s.items.forEach((item, idx) => {
          alertSheet.appendRow(["oda_"+Date.now()+"_"+item.sheetRow+"_"+idx, item.barcode, item.productName, item.expiryDay, item.staffName, token, pin, new Date(Date.now()+86400000), "No", new Date(), item.sheetRow, item.logId]);
          processed++;
        });
      }
    });
    return { status: "success", processed };
  } finally { lock.releaseLock(); }
}

function getOrCreateOnDisplayAlertSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ON_DISPLAY_ALERTS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(ON_DISPLAY_ALERTS_SHEET_NAME);
  const h = ["ID","Barcode","Product","Expiry","Staff","Token","PIN","Expires At","Used","Sent At","Log Row","Log ID"];
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,h.length).setValues([h]);
  return sheet;
}

function hasOnDisplayLogBeenSent_(sheet, item) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const data = sheet.getRange(2, 11, last - 1, 2).getValues();
  for (let i=0; i<data.length; i++) {
    if (String(item.logId) === String(data[i][1]) || String(item.sheetRow) === String(data[i][0])) return true;
  }
  return false;
}

function generateOnDisplayPin_() { return String(Math.floor(1000 + Math.random() * 9000)); }
function generateSecureToken_() { return Utilities.getUuid().replace(/-/g, "").substring(0, 16); }

function sendOnDisplaySms_(staffName, items, token, pin) {
  const contact = getStaffContactByName_(staffName);
  if (!contact || !contact.phone) return { success: false };
  const link = APP_URL + "/on-display/" + token;
  const msg = `SHEETSYNC REGISTRY\nURGENT EXPIRY ALERT\n\nStaff: ${staffName}\nKey: ${pin}\n\nUrgent verification required for zone "On Display".\n\nHandshake:\n${link}`;
  return { success: sendTextbeeSms_(contact.phone, msg) };
}

function normalizeStaffName_(v) { return String(v || "").trim().toUpperCase(); }
function normalizeLocation_(v) { return String(v || "").trim().toUpperCase(); }
function normalizeStaffPhone_(v) {
  let p = String(v || "").replace(/[\s\-\(\)]/g, "");
  if (p.indexOf("00") === 0) p = "+" + p.substring(2);
  if (/^\d{8}$/.test(p)) p = "+974" + p;
  if (/^974\d{8}$/.test(p)) p = "+" + p;
  return p;
}

function parseExpiryWatchDate_(v) {
  if (v instanceof Date) return v;
  const t = String(v || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return makeValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return makeValidDate_(Number(m[3]), Number(m[2]), Number(m[1]));
  return new Date(t);
}

function makeValidDate_(y,m,d) { const dt = new Date(y, m-1, d); return (dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d) ? dt : null; }
function startOfDay_(d) { const res = new Date(d); res.setHours(0,0,0,0); return res; }
function addCalendarDays_(d, days) { const res = new Date(d); res.setDate(res.getDate() + days); return res; }
function subtractCalendarMonths_(d, m) { const res = new Date(d); res.setMonth(res.getMonth() - m); return res; }
function formatSheetDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd"); }
function formatSmsDate_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "dd MMM yyyy"); }

function sendSevenDayExpiryStaffSmsIfDue_(item, entryDate) {
  try {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const expiryDate = parseSevenDaySmsDate_(item.expiryDate, tz);
    if (!expiryDate) return;
    const expKey = Utilities.formatDate(expiryDate, tz, "yyyy-MM-dd");
    const target = new Date(entryDate); target.setDate(target.getDate() + 7);
    const targetKey = Utilities.formatDate(target, tz, "yyyy-MM-dd");
    if (expKey !== targetKey) return;
    const contact = getStaffContactByName_(item.staffName || item.staff);
    if (contact?.phone) {
      const msg = `HIGHLAND EXPIRY ALERT\nItem: ${item.productName}\nQty: ${item.quantity}\nExpires in 7 days.`;
      sendTextbeeSms_(contact.phone, msg);
    }
  } catch(e) {}
}

function parseSevenDaySmsDate_(v, tz) {
  if (v instanceof Date) return v;
  const t = String(v || "").trim();
  let match = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) return makeValidDate_(Number(Utilities.formatDate(new Date(), tz, "yyyy")), Number(match[2]), Number(match[1]));
  return parseExpiryWatchDate_(v);
}

function sendExpiryAlertEmail(item, logDate) {
  const html = `<div style="padding:20px; border:1px solid #dc2626; border-radius:10px;">
    <h2 style="color:#dc2626;">Expired Item Logged</h2>
    <p><strong>Product:</strong> ${item.productName}</p>
    <p><strong>Barcode:</strong> ${item.barcode}</p>
    <p><strong>Qty:</strong> ${item.quantity}</p>
    <p><strong>Exp:</strong> ${item.expiryDate}</p>
  </div>`;
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `⚠️ EXPIRED: ${item.productName}`, htmlBody: html });
}

function sendWipeAlertEmail(data) {
  MailApp.sendEmail({ to: RECIPIENT_EMAIL, subject: `❗ SECURITY: Wipe`, htmlBody: `Wipe target: ${data.barcode}` });
}

function setFormResponseSupplierFormula_(sheet, row) {
  const f = '=IF(B' + row + '="","",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&"")=TRIM(B' + row + '&""))+(TRIM(DB!$B$2:$B$100000&"")=TRIM(B' + row + '&"")))>0),1),"Not Found"))';
  sheet.getRange(row, 8).setFormula(f);
}

function sendTextbeeSms_(phone, message) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");
  if (!apiKey || !deviceId) return false;
  try {
    const res = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": apiKey },
      payload: JSON.stringify({ message: message, recipients: [normalizeStaffPhone_(phone)], deviceId: deviceId }),
      muteHttpExceptions: true
    });
    return res.getResponseCode() === 200;
  } catch (e) { return false; }
}

function ensureExpiryWatchSmsColumns_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPIRY_WATCH_SHEET_NAME);
  if (s.getMaxColumns() < 13) s.insertColumnsAfter(s.getMaxColumns(), 13 - s.getMaxColumns());
  s.getRange(1, 9, 1, 5).setValues([["SMS Status", "Last Sent At", "Count", "Res SMS Status", "Res Sent At"]]);
  return s;
}

function automaticOnDisplayDailyCheck() { return processOnDisplayAlerts_(); }
