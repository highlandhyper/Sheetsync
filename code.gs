
// IMPORTANT: Replace with your actual Firebase Realtime Database URL
// You can get this from your Firebase Console: Realtime Database section (it usually ends with .firebaseio.com)
var FIREBASE_DB_URL = "YOUR_FIREBASE_REALTIME_DATABASE_URL_HERE"; // e.g., "https://your-project-id.firebaseio.com"

// IMPORTANT: For writing to Firebase, you'll need to authenticate.
// Using a Database Secret is one way for Apps Script. GET THIS FROM:
// Firebase Console -> Project Settings -> Service accounts -> Database secrets (Legacy) -> Show Secret
// HANDLE WITH EXTREME CARE. DO NOT SHARE IT PUBLICLY.
// Consider restricting your RTDB rules and using this secret only for specific paths.
var FIREBASE_DB_SECRET = "YOUR_DATABASE_SECRET_HERE"; // Optional, but needed for writes if rules are restrictive

// --- Helper Function to make requests to Firebase REST API ---
function callFirebaseAPI(path, method, payload) {
  var url = FIREBASE_DB_URL + path + ".json";
  if (FIREBASE_DB_SECRET) {
    url += "?auth=" + FIREBASE_DB_SECRET;
  }

  var options = {
    'method': method,
    'contentType': 'application/json',
    'muteHttpExceptions': true // Important to get error responses instead of script failing
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseBody);
    } else {
      Logger.log("Error calling Firebase API for path: " + path + ". Status: " + responseCode + ". Response: " + responseBody);
      return null; // Or throw new Error(responseBody);
    }
  } catch (e) {
    Logger.log("Exception calling Firebase API for path: " + path + ". Error: " + e.toString());
    return null; // Or throw e;
  }
}

// --- Example: Sync Inventory from Firebase RTDB to a Google Sheet ---
function syncInventoryFromFirebaseToSheet() {
  var sheetName = "Inventory_From_Firebase"; // Change to your target sheet name
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clearContents(); // Clear existing data

  var inventoryData = callFirebaseAPI("inventoryItems", "get");

  if (!inventoryData) {
    Logger.log("Failed to fetch inventory data from Firebase or data is null.");
    SpreadsheetApp.getUi().alert("Failed to fetch inventory data from Firebase.");
    return;
  }

  var rows = [];
  // Define headers based on your desired sheet structure and data from Firebase
  var headers = ["ID", "Barcode", "Product Name", "Quantity", "Expiry Date", "Location", "Staff Name", "Item Type", "Supplier Name", "Timestamp"];
  rows.push(headers);

  for (var itemId in inventoryData) {
    if (inventoryData.hasOwnProperty(itemId)) {
      var item = inventoryData[itemId];
      rows.push([
        itemId,
        item.barcode || "",
        item.productName || "",
        item.quantity || 0,
        item.expiryDate || "",
        item.location || "",
        item.staffName || "",
        item.itemType || "",
        item.supplierName || "",
        item.timestamp ? new Date(item.timestamp).toLocaleString() : "" // Format timestamp
      ]);
    }
  }

  if (rows.length > 1) { // If more than just headers
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    Logger.log(rows.length - 1 + " inventory items synced to sheet '" + sheetName + "'.");
    SpreadsheetApp.getUi().alert(rows.length - 1 + " inventory items synced to sheet '" + sheetName + "'.");
  } else {
    Logger.log("No inventory items found in Firebase to sync.");
    SpreadsheetApp.getUi().alert("No inventory items found in Firebase to sync.");
  }
}

// --- Example: Sync Products from Firebase RTDB to a Google Sheet ---
function syncProductsFromFirebaseToSheet() {
  var sheetName = "Products_From_Firebase"; // Change to your target sheet name
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clearContents();

  var productsData = callFirebaseAPI("products", "get");

  if (!productsData) {
    Logger.log("Failed to fetch products data from Firebase or data is null.");
    SpreadsheetApp.getUi().alert("Failed to fetch products data from Firebase.");
    return;
  }

  var rows = [];
  var headers = ["ID", "Barcode", "Product Name", "Supplier Name", "Supplier ID", "Created At"];
  rows.push(headers);

  for (var productId in productsData) {
    if (productsData.hasOwnProperty(productId)) {
      var product = productsData[productId];
      rows.push([
        productId,
        product.barcode || "",
        product.productName || "",
        product.supplierName || "",
        product.supplierId || "",
        product.createdAt ? new Date(product.createdAt).toLocaleString() : ""
      ]);
    }
  }

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    Logger.log(rows.length - 1 + " products synced to sheet '" + sheetName + "'.");
    SpreadsheetApp.getUi().alert(rows.length - 1 + " products synced to sheet '" + sheetName + "'.");
  } else {
    Logger.log("No products found in Firebase to sync.");
    SpreadsheetApp.getUi().alert("No products found in Firebase to sync.");
  }
}


// --- Example: Sync a "Products" sheet TO Firebase RTDB ---
// This is more complex if you need to handle updates vs. new items.
// This example assumes each row in the sheet should be an item in Firebase, using Barcode as a potential key.
// Be careful: this can overwrite data in Firebase.
function syncProductsSheetToFirebase() {
  var sheetName = "Products_To_Firebase"; // The sheet YOU want to be the source
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("Sheet '" + sheetName + "' not found.");
    SpreadsheetApp.getUi().alert("Sheet '" + sheetName + "' not found.");
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data.shift(); // Assumes first row is headers

  // Find column indices (more robust than hardcoding)
  var barcodeCol = headers.indexOf("Barcode");
  var productNameCol = headers.indexOf("Product Name");
  var supplierNameCol = headers.indexOf("Supplier Name");
  // Add other columns as needed

  if (barcodeCol === -1 || productNameCol === -1 || supplierNameCol === -1) {
    Logger.log("Required headers (Barcode, Product Name, Supplier Name) not found in sheet '" + sheetName + "'.");
    SpreadsheetApp.getUi().alert("Required headers not found.");
    return;
  }

  var productsPayload = {};
  var successCount = 0;
  var errorCount = 0;

  data.forEach(function(row) {
    var barcode = row[barcodeCol];
    if (barcode) { // Only process if barcode exists
      var productData = {
        barcode: barcode.toString().trim(),
        productName: row[productNameCol] ? row[productNameCol].toString().trim() : "N/A",
        supplierName: row[supplierNameCol] ? row[supplierNameCol].toString().trim() : "N/A",
        // supplierId: "LOOKUP_OR_CREATE_SUPPLIER_ID", // You'd need logic to get/create supplierId
        createdAt: new Date().toISOString() // Or use Firebase Server Timestamp if pushing one by one
      };
      // Using barcode as key here. If barcodes are not unique, this will overwrite.
      // Alternatively, query Firebase first to see if product exists, then update or create.
      // For simplicity, this example uses PATCH which will create or update.
      // productsPayload["products/" + productData.barcode] = productData; // For a single PATCH update
      
      // Or push one by one (slower, but gives unique IDs)
      // To use barcode as the node key, you'd structure your path like: "products/" + barcode
      // This example will use PATCH on the "products" root, effectively replacing it if not careful.
      // A safer way is to PUT/PATCH individual items: "products/someUniqueFirebasePushKey" or "products/barcodeValue"
      
      // Let's PUT each product individually using barcode as a key (ensure barcodes are valid RTDB keys)
      // Note: RTDB keys cannot contain ., #, $, [, ], or ASCII control characters 0-31 or 127.
      var safeBarcodeKey = barcode.toString().trim().replace(/[.#$[\]]/g, '_'); // Basic sanitization
      var result = callFirebaseAPI("products/" + safeBarcodeKey, "put", productData);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    }
  });

  // If you were to update all products at once with PATCH (less safe for this structure):
  // if (Object.keys(productsPayload).length > 0) {
  //   var response = callFirebaseAPI("", "patch", productsPayload); // PATCH to root with structured paths
  //   if (response) {
  //     Logger.log("Products sheet synced to Firebase.");
  //     SpreadsheetApp.getUi().alert("Products sheet synced to Firebase.");
  //   } else {
  //     Logger.log("Failed to sync products sheet to Firebase.");
  //     SpreadsheetApp.getUi().alert("Failed to sync products sheet to Firebase.");
  //   }
  // } else {
  //   Logger.log("No products with barcodes found in sheet to sync.");
  // }
  Logger.log("Sync complete. Success: " + successCount + ", Errors: " + errorCount);
  SpreadsheetApp.getUi().alert("Sync complete. Success: " + successCount + ", Errors: " + errorCount);
}


// --- Menu to run these functions from the Google Sheet UI ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Firebase Sync')
      .addItem('Sync Inventory from Firebase to Sheet', 'syncInventoryFromFirebaseToSheet')
      .addItem('Sync Products from Firebase to Sheet', 'syncProductsFromFirebaseToSheet')
      .addSeparator()
      .addItem('Sync "Products_To_Firebase" Sheet to Firebase', 'syncProductsSheetToFirebase')
      .addToUi();
}

// This doPost function is if your Next.js app was calling Apps Script directly.
// Since your Next.js app now talks to Firebase RTDB, this doPost is less relevant
// for *that* interaction, but you might keep it if your HTML form still submits to Apps Script.
// If you merged it before, ensure it's structured correctly or remove/comment out if not needed.
/*
function doPost(e) {
  try {
    // ... (Your existing or merged doPost logic) ...
    // This was for when Next.js called Apps Script as an API endpoint.
    // Now, Next.js calls Firebase RTDB directly.
    // If your HTML form still posts here, that logic should remain.
    // Otherwise, this function might not be used by the Next.js app anymore.

    // Example: If HTML form submits here
    if (e && e.parameter && e.parameter.formIdentifier === 'yourHtmlForm') {
      // ... process HTML form data ...
      return HtmlService.createHtmlOutput("HTML form submitted!");
    }
    
    // Fallback or error if request isn't from HTML form
    Logger.log("doPost called with unrecognized request: " + JSON.stringify(e));
    return ContentService.createTextOutput(JSON.stringify({ error: "Unsupported POST request."})).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error in doPost: " + err.message + "\nStack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, success: false })).setMimeType(ContentService.MimeType.JSON);
  }
}
*/

// You might also need a doGet(e) function if you want to test the web app URL in a browser
function doGet(e) {
  return HtmlService.createHtmlOutput("Apps Script is running. Use POST requests for data operations or run sync functions from editor/menu.");
}

    