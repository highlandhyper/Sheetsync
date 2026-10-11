
// ============================================================
// HIGHLAND HYPERMARKET - SHEETSYNC GOOGLE APPS SCRIPT
// ============================================================

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
const INV_COL_REPORTED_AT = 10; // New column K for weekly reports

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
      "triggerOnDisplayAlerts",
      "triggerWeeklyReports"
    ];

    if (restrictedActions.includes(action)) {
      if (data.password !== ADMIN_PASSWORD) {
        throw new Error("Unauthorized");
      }
    }

    if (action === "addProduct") return manageProduct(data);
    if (action === "addStaff") return addNewStaff(data);
    if (action === "standardLog") {
      submitData(data);
      return jsonResponse({ status: "success", type: "standardLog" });
    }
    if (action === "triggerOnDisplayAlerts") {
      const requestedStaff = String(data.staffName || "").trim();
      const result = processOnDisplayAlerts_(requestedStaff, requestedStaff !== "");
      return jsonResponse(result);
    }
    if (action === "triggerWeeklyReports") {
      return jsonResponse(generateWeeklySupplierReports());
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (error) {
    console.error("doPost Error:", error);
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// ============================================================
// STANDARD LOG - MODIFIED FOR SUPPLIER NOTIFICATION
// ============================================================

function submitData(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) throw new Error('Sheet "' + LOG_SHEET_NAME + '" not found.');

  const tz = ss.getSpreadsheetTimeZone();
  const entryDate = item.timestamp ? new Date(item.timestamp) : new Date();
  const nextRow = logSheet.getLastRow() + 1;
  const uniqueId = `${nextRow}-${Utilities.formatDate(entryDate, tz, "yyyyMMddHHmmss")}`;

  logSheet.getRange(nextRow, 1, 1, 10).setValues([[
    Utilities.formatDate(entryDate, tz, "d/M/yyyy HH:mm:ss"),
    item.barcode || "",
    item.quantity || "",
    item.expiryDate || "",
    item.location || "",
    item.staffName || "",
    item.productName || "",
    "", // Supplier (filled by formula)
    item.itemType || "",
    uniqueId
  ]]);

  setFormResponseSupplierFormula_(logSheet, nextRow);

  if (item.disableNotification !== true) {
    // 1. Immediate Staff 7-day Alert
    sendSevenDayExpiryStaffSmsIfDue_(item, entryDate);
    
    // 2. IMMEDIATE SUPPLIER NOTIFICATION
    triggerSupplierInstantNotification_(item);
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
    const msg = `SHEETSYNC: New item logged for your catalog. Product: ${item.productName}. Qty: ${item.quantity}. Full report link sent via email. Live view: ${APP_URL}/supplier-portal/${supplier.supplierCode}`;
    sendTextbeeSms_(supplier.phone, msg);
  }
}

// ============================================================
// WEEKLY SUPPLIER REPORT ENGINE
// ============================================================

function generateWeeklySupplierReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  const meta = getAppMetaData();
  const suppliers = meta.supplierContacts;
  
  if (!suppliers || suppliers.length === 0) return { status: "error", message: "No supplier contacts found." };

  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return { status: "error", message: "No logs found." };

  // Read all logs up to column K (Reported At)
  const logRange = logSheet.getRange(2, 1, lastRow - 1, 11);
  const logData = logRange.getValues();
  const now = new Date();
  const updatedSuppliers = [...suppliers];
  const results = [];

  suppliers.forEach((supplier, sIdx) => {
    if (!supplier.email && !supplier.phone) return;

    const newItems = [];
    let currentNewValue = 0;
    const rowsToUpdate = [];

    logData.forEach((row, rIdx) => {
      const rowSupplier = String(row[INV_COL_SUPPLIER_NAME] || "").trim();
      const reportedAt = row[INV_COL_REPORTED_AT];

      if (rowSupplier.toLowerCase() === supplier.name.toLowerCase() && !reportedAt) {
        newItems.push({
          product: row[INV_COL_PRODUCT_NAME],
          qty: row[INV_COL_QTY],
          barcode: row[INV_COL_BARCODE],
          expiry: row[INV_COL_EXPIRY]
        });
        rowsToUpdate.push(rIdx + 2);
        
        // Value calculation logic (requires cost price lookup)
        // For simplicity, we aggregate and use the previous report value in the email
      }
    });

    if (newItems.length > 0) {
      // Calculate this batch's "Estimated Value" based on quantity (requires DB link)
      // For this script, we'll send the email with the link to the portal
      sendSupplierReportEmail_(supplier, newItems);
      
      // Mark as reported in sheet
      rowsToUpdate.forEach(row => {
        logSheet.getRange(row, INV_COL_REPORTED_AT + 1).setValue(now);
      });

      // Update the last report value in the meta registry
      // This is a placeholder - actual value would be calculated from SKU cost
      results.push({ supplier: supplier.name, items: newItems.length });
    }
  });

  return { status: "success", reportsSent: results };
}

// ============================================================
// SMS HELPER (Textbee)
// ============================================================

function sendTextbeeSms_(phone, message) {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty("TEXTBEE_API_KEY");
  const deviceId = properties.getProperty("TEXTBEE_DEVICE_ID");

  if (!apiKey || !deviceId) return false;

  try {
    const response = UrlFetchApp.fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "post",
      contentType: "application/json",
      headers: { "x-api-key": apiKey },
      payload: JSON.stringify({
        message: message,
        recipients: [normalizeStaffPhone_(phone)],
        deviceId: deviceId
      }),
      muteHttpExceptions: true
    });
    return response.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

// ============================================================
// EMAIL HELPER (Supplier)
// ============================================================

function sendSupplierReportEmail_(supplier, items) {
  const portalUrl = `${APP_URL}/supplier-portal/${supplier.supplierCode}`;
  const prevValue = supplier.lastReportValue || 0;

  const htmlBody = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #29abe2;">SheetSync Weekly Inventory Report</h2>
      <p>Dear ${supplier.name},</p>
      <p>Please find the summary of new inventory logged for your account this week.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f4f4f4;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Qty</th>
        </tr>
        ${items.map(i => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${i.product}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${i.qty}</td>
          </tr>
        `).join('')}
      </table>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <p style="margin: 0; font-size: 12px; color: #666;">PREVIOUS REPORT VALUE</p>
        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">QAR ${prevValue.toLocaleString()}</p>
      </div>

      <p style="margin-top: 30px;">You can view your complete live stock list at any time via your secure portal:</p>
      <a href="${portalUrl}" style="display: inline-block; padding: 12px 25px; background: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">OPEN SUPPLIER PORTAL</a>
      
      <p style="font-size: 11px; color: #999; margin-top: 40px;">This is an automated industrial registry notification. Log ID: ${Date.now()}</p>
    </div>
  `;

  if (supplier.email) {
    MailApp.sendEmail({
      to: supplier.email,
      subject: `Weekly Inventory Sync - ${supplier.name} [Code: ${supplier.supplierCode}]`,
      htmlBody: htmlBody
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function getSupplierContactByName_(name) {
  const meta = getAppMetaData();
  return meta.supplierContacts.find(s => s.name.toLowerCase() === name.toLowerCase());
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

function normalizeStaffPhone_(v) {
  let p = String(v || "").trim().replace(/[\s\-\(\)]/g, "");
  if (p.indexOf("00") === 0) p = "+" + p.substring(2);
  if (/^\d{8}$/.test(p)) p = "+974" + p;
  if (/^974\d{8}$/.test(p)) p = "+" + p;
  return p;
}

function setFormResponseSupplierFormula_(sheet, rowNumber) {
  const formula = '=IF(B' + rowNumber + '="","",IFERROR(INDEX(FILTER(DB!$D$2:$D$100000,((TRIM(DB!$A$2:$A$100000&"")=TRIM(B' + rowNumber + '&""))+(TRIM(DB!$B$2:$B$100000&"")=TRIM(B' + rowNumber + '&"")))>0),1),"Not Found"))';
  sheet.getRange(rowNumber, 8).setFormula(formula);
}
