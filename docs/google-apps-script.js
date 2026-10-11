
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
const INV_COL_REPORTED_AT = 10; // Column K (Weekly Mail)
const INV_COL_DAILY_SMS_AT = 11; // Column L (Daily SMS Summary)

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
      "triggerDailySmsSummary",
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
    if (action === "triggerDailySmsSummary") {
      return jsonResponse(generateDailySupplierSmsReports());
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
// STANDARD LOG
// ============================================================

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
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
  logAuditEvent_(item.userEmail || "Terminal", "LOG_INVENTORY", item.barcode || "N/A", `[LOGGED] Qty: ${item.quantity} | Loc: ${item.location}`);

  if (item.disableNotification === true) return;

  try {
    sendSevenDayExpiryStaffSmsIfDue_(item, entryDate);
    // Instant supplier SMS removed as per protocol update. Handled by Daily Summary.
    
    if (item.expiryDate) {
      const expiryDate = parseSevenDaySmsDate_(item.expiryDate, tz);
      if (expiryDate) {
        const todayKey = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
        const expiryKey = Utilities.formatDate(expiryDate, tz, "yyyy-MM-dd");
        if (expiryKey <= todayKey) sendExpiryAlertEmail(item, entryDate);
      }
    }
  } catch (e) { console.warn("Non-blocking notification error:", e); }
}

// ============================================================
// DAILY SUPPLIER SMS SUMMARY ENGINE
// ============================================================

function generateDailySupplierSmsReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const supplierContacts = meta.supplierContacts || [];
  
  if (logSheet.getLastRow() < 2) return { status: "success", message: "No data." };
  
  // Read up to Col L (Daily SMS At)
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 12).getValues();
  const unreported = data.map((row, i) => ({ row: row, index: i + 2 }))
                        .filter(item => item.row[7] && (item.row[11] === "" || item.row[11] === null));
  
  if (unreported.length === 0) return { status: "success", message: "No new logs for daily SMS." };
  
  const grouped = {};
  unreported.forEach(item => {
    const name = item.row[7];
    if (!grouped[name]) grouped[name] = { items: [], rows: [] };
    grouped[name].items.push(item.row);
    grouped[name].rows.push(item.index);
  });
  
  const now = new Date();
  const timestamp = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  let sentCount = 0;

  Object.keys(grouped).forEach(name => {
    const contact = supplierContacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (contact && contact.phone) {
      const totalUnits = grouped[name].items.reduce((s, row) => s + parseFloat(String(row[2] || 0)), 0);
      const msg = `SHEETSYNC: Today's summary for your catalog. ${grouped[name].items.length} new items logged. Total Units: ${totalUnits}. View live portal: ${APP_URL}/supplier-portal/${contact.supplierCode}`;
      
      if (sendTextbeeSms_(contact.phone, msg)) {
        sentCount++;
        grouped[name].rows.forEach(rowIdx => {
          logSheet.getRange(rowIdx, 12).setValue(timestamp);
        });
      }
    }
  });

  return { status: "success", smsSent: sentCount };
}

// ============================================================
// WEEKLY SUPPLIER EMAIL REPORT ENGINE
// ============================================================

function generateWeeklySupplierReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const supplierContacts = meta.supplierContacts || [];
  
  if (logSheet.getLastRow() < 2) return { status: "success", message: "No data." };
  
  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).getValues();
  const unreportedLogs = data.map((row, i) => ({ row: row, index: i + 2 }))
                             .filter(item => item.row[10] === "" || item.row[10] === null);
  
  if (unreportedLogs.length === 0) return { status: "success", message: "No new logs for weekly report." };
  
  const groupedBySupplier = {};
  unreportedLogs.forEach(item => {
    const name = item.row[7];
    if (!groupedBySupplier[name]) groupedBySupplier[name] = { items: [], rows: [] };
    groupedBySupplier[name].items.push(item.row);
    groupedBySupplier[name].rows.push(item.index);
  });
  
  let reportsSent = 0;
  const now = new Date();
  const reportedDate = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

  Object.keys(groupedBySupplier).forEach(name => {
    const contactIndex = supplierContacts.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    const contact = supplierContacts[contactIndex];
    
    if (contact && contact.email) {
      const logs = groupedBySupplier[name].items;
      const previousValue = contact.lastReportValue || 0;
      
      let currentBatchValue = 0;
      let tableRows = "";
      logs.forEach(l => {
        // Simple heuristic for value if not in log: Qty * 10 (or actual cost if we had it here)
        // Ideally, we'd lookup cost from DB, but for now we rely on the metadata provided in APP_SETTINGS
        tableRows += `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${l[6]}</td><td style="padding:8px; border-bottom:1px solid #eee;">${l[1]}</td><td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${l[2]}</td><td style="padding:8px; border-bottom:1px solid #eee;">${l[3]}</td></tr>`;
      });
      
      const htmlBody = `
        <div style="font-family:sans-serif; max-width:600px; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
          <h2 style="color:#0f172a; margin-bottom:4px;">Weekly Inventory Report</h2>
          <p style="color:#64748b; font-size:12px; margin-bottom:20px;">System Dispatch: ${reportedDate}</p>
          <p>Dear ${name},</p>
          <p>This is your automated incremental inventory summary. The following items have been added to your catalog this week.</p>
          
          <div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;">
            <p style="margin:0; font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Previous Report Value</p>
            <p style="margin:0; font-size:20px; font-weight:bold; color:#0f172a;">QAR ${previousValue.toLocaleString()}</p>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;">
            <tr style="background:#f1f5f9; text-align:left;">
              <th style="padding:8px; font-weight:bold;">Product</th>
              <th style="padding:8px; font-weight:bold;">Barcode</th>
              <th style="padding:8px; font-weight:bold; text-align:right;">Qty</th>
              <th style="padding:8px; font-weight:bold;">Expiry</th>
            </tr>
            ${tableRows}
          </table>

          <div style="margin-top:30px; text-align:center;">
            <a href="${APP_URL}/supplier-portal/${contact.supplierCode}" style="background:#000; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; display:inline-block;">View Live Dashboard</a>
          </div>
        </div>
      `;
      
      MailApp.sendEmail({ to: contact.email, subject: `Weekly Inventory Report - ${name}`, htmlBody: htmlBody });
      reportsSent++;

      // Update registry metadata: Mark items as reported and update "Last Report Value"
      groupedBySupplier[name].rows.forEach(rowIdx => {
        logSheet.getRange(rowIdx, 11).setValue(reportedDate);
      });
      
      // Calculate new total value from inventory items linked to this supplier for the next previousValue
      const totalInventoryForSupplier = data.filter(r => r[7] === name && r[2] > 0);
      // Note: We don't have prices here easily, so we update the value based on your industrial logic elsewhere
      // If the app calculates value, it should be synced here.
    }
  });
  
  return { status: "success", reportsSent };
}

// ============================================================
// HELPERS
// ============================================================

function logAuditEvent_(user, action, target, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);
  if (!sheet) return;
  const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([ts, user, action, target, details]);
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

function getStaffContactByName_(staffName) {
  const wantedName = String(staffName || "").trim().toUpperCase();
  const meta = getAppMetaData();
  const staffList = meta.staff || [];
  for (let s of staffList) {
    if (String(s.name || "").trim().toUpperCase() === wantedName) return s;
  }
  return null;
}

function sendTextbeeSms_(phone, message) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("TEXTBEE_API_KEY");
  const deviceId = props.getProperty("TEXTBEE_DEVICE_ID");
  if (!apiKey || !deviceId || !phone) return false;
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

function normalizeStaffPhone_(v) {
  let p = String(v || "").replace(/[\s\-\(\)]/g, "");
  if (p.indexOf("00") === 0) p = "+" + p.substring(2);
  if (/^\d{8}$/.test(p)) p = "+974" + p;
  if (/^974\d{8}$/.test(p)) p = "+" + p;
  return p;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setFormResponseSupplierFormula_(sheet, row) {
  const f = '=IF(B' + row + '="","",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&"")=TRIM(B' + row + '&""))+(TRIM(DB!$B$2:$B$100000&"")=TRIM(B' + row + '&"")))>0),1),"Not Found"))';
  sheet.getRange(row, 8).setFormula(f);
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
  staffSheet.appendRow([String(item.staffName || "").trim()]);
  updateDbVersion();
  return jsonResponse({ status: "success" });
}

function updateDbVersion() { PropertiesService.getScriptProperties().setProperty("DB_VERSION", Date.now().toString()); }

// ============================================================
// AUTOMATION INSTALLER
// ============================================================

function installSupplierAutomationTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "generateDailySupplierSmsReports" || fn === "generateWeeklySupplierReports") ScriptApp.deleteTrigger(t);
  });

  // Daily SMS Summary at 9:00 PM
  ScriptApp.newTrigger("generateDailySupplierSmsReports").timeBased().everyDays(1).atHour(21).create();
  
  // Weekly Email Report on Sunday at 10:00 PM
  ScriptApp.newTrigger("generateWeeklySupplierReports").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();
}
