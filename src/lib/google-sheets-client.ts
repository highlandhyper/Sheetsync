
// src/lib/google-sheets-client.ts
import { google, type sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

const GOOGLE_SHEETS_CLIENT_EMAIL_RAW = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const GOOGLE_SHEETS_PRIVATE_KEY_RAW = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
const GOOGLE_SHEET_ID_RAW = process.env.GOOGLE_SHEET_ID;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheets: sheets_v4.Sheets | null = null;
let GOOGLE_SHEETS_CLIENT_EMAIL: string | undefined;
let GOOGLE_SHEETS_PRIVATE_KEY: string | undefined;
let GOOGLE_SHEET_ID: string | undefined;
let sheetsClientInitializationError: string | null = null;

const sheetGidCache = new Map<string, number>();

async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (sheets) {
    return sheets;
  }
  if (sheetsClientInitializationError) {
    console.error("Google Sheets Client: Aborting due to previous initialization error:", sheetsClientInitializationError);
    return null;
  }

  let criticalEnvVarsMissing = false;
  let missingVarsMessages: string[] = [];

  if (!GOOGLE_SHEETS_CLIENT_EMAIL_RAW || GOOGLE_SHEETS_CLIENT_EMAIL_RAW.trim() === "") {
    missingVarsMessages.push("- GOOGLE_SHEETS_CLIENT_EMAIL is missing or empty in .env.local.");
    criticalEnvVarsMissing = true;
  } else {
    GOOGLE_SHEETS_CLIENT_EMAIL = GOOGLE_SHEETS_CLIENT_EMAIL_RAW.trim();
  }

  if (!GOOGLE_SHEETS_PRIVATE_KEY_RAW || GOOGLE_SHEETS_PRIVATE_KEY_RAW.trim() === "") {
    missingVarsMessages.push(
      "- GOOGLE_SHEETS_PRIVATE_KEY is missing or empty in .env.local. It should be the full key string from your service account JSON, enclosed in double quotes, with literal '\\n' for newlines if on a single line in .env.local."
    );
    criticalEnvVarsMissing = true;
  } else {
    GOOGLE_SHEETS_PRIVATE_KEY = GOOGLE_SHEETS_PRIVATE_KEY_RAW.replace(/\\n/g, '\n');
  }

  if (!GOOGLE_SHEET_ID_RAW || GOOGLE_SHEET_ID_RAW.trim() === "") {
    missingVarsMessages.push("- GOOGLE_SHEET_ID is missing or empty in .env.local.");
    criticalEnvVarsMissing = true;
  } else {
    GOOGLE_SHEET_ID = GOOGLE_SHEET_ID_RAW.trim();
  }

  if (criticalEnvVarsMissing) {
    sheetsClientInitializationError =
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
      "CRITICAL GOOGLE SHEETS API CONFIGURATION ERROR (from getSheetsClient):\n" +
      missingVarsMessages.join("\n") + "\n\n" +
      "Please ensure these are correctly set up in your .env.local file in the project root.\n" +
      "This typically involves:\n" +
      "1. Creating a Service Account in your Google Cloud Project.\n" +
      "2. Enabling the Google Sheets API for that project.\n" +
      "3. Downloading the JSON key for the service account.\n" +
      "4. Sharing your Google Sheet with the service account's email address (giving it 'Editor' permissions).\n" +
      "5. Copying the 'client_email', 'private_key', and your 'sheet_id' into .env.local variables:\n" +
      "   GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email\n" +
      "   GOOGLE_SHEETS_PRIVATE_KEY=\"your_private_key_with_newlines_as_literal_backslash_n\"\n" +
      "   GOOGLE_SHEET_ID=your_sheet_id\n" +
      "6. AFTER creating or updating .env.local, YOU MUST RESTART your Next.js development server.\n" +
      "Google Sheets API client will NOT be initialized.";
    console.error(sheetsClientInitializationError + "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    return null;
  }

  if (!GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEET_ID) {
      sheetsClientInitializationError = "getSheetsClient: Processed private key, client email, or sheet ID is undefined after initial checks. This indicates an unexpected issue with environment variable processing.";
      console.error(sheetsClientInitializationError);
      return null;
  }

  try {
    const auth = new JWT({
      email: GOOGLE_SHEETS_CLIENT_EMAIL,
      key: GOOGLE_SHEETS_PRIVATE_KEY,
      scopes: SCOPES,
    });

    sheets = google.sheets({ version: 'v4', auth: auth });
    console.log("Google Sheets API client initialized successfully.");
    return sheets;
  } catch (error: any) {
    sheetsClientInitializationError = `Error initializing Google Sheets API client (getSheetsClient): ${error.message}. This often indicates a problem with the GOOGLE_SHEETS_PRIVATE_KEY format or content after processing. Ensure it's correctly represented in .env.local (using '\\n' for newlines if it's a single-line string). Original error: ${error.name}`;
    console.error(sheetsClientInitializationError);
     if (error.stack) {
        console.error("Stack trace for getSheetsClient init error:", error.stack);
    }
    return null;
  }
}

export async function readSheetData(range: string): Promise<any[][] | null> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`readSheetData: Sheets client or Sheet ID not available for range '${range}'. Client: ${!!currentSheetsClient}, SheetID: ${GOOGLE_SHEET_ID}. Ensure .env.local is correctly set up and server restarted.`);
    if (sheetsClientInitializationError) console.error("Underlying reason for client not being available:", sheetsClientInitializationError);
    return null;
  }

  const startTime = Date.now();
  try {
    // console.log(`Reading from sheet: ${GOOGLE_SHEET_ID}, range: ${range}`);
    const response = await currentSheetsClient.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
    });
    const duration = Date.now() - startTime;
    console.log(`Successfully read ${response.data.values?.length || 0} rows from range: ${range} in ${duration}ms.`);
    return response.data.values || [];
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const sheetNameInError = range.split('!')[0];
    console.error(`Error reading sheet data from range ${range} (took ${duration}ms):`, error.message);
    if (error.message && (error.message.toLowerCase().includes("requested entity was not found") || error.code === 404)) {
        console.error(
            `IMPORTANT: 'Requested entity was not found' (or 404) for range '${range}' typically means:\n` +
            `1. The GOOGLE_SHEET_ID ('${GOOGLE_SHEET_ID || 'NOT SET OR READ'}') in your .env.local is incorrect OR the service account doesn't have access to it.\n` +
            `2. The sheet name specified in the range ('${sheetNameInError}') does NOT exist in that spreadsheet, or is misspelled (case-sensitive).\n` +
            "Please verify your GOOGLE_SHEET_ID, the sheet name within the range, and that your service account has 'Editor' (or at least 'Viewer') permissions on the Google Sheet."
        );
    }
     if (error.stack) {
        console.error("Stack trace for readSheetData error:", error.stack);
    }
    return null;
  }
}

export async function appendSheetData(range: string, values: any[][]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`appendSheetData: Sheets client or GOOGLE_SHEET_ID not available for range '${range}'.`);
    if (sheetsClientInitializationError) console.error("Underlying reason for client not being available:", sheetsClientInitializationError);
    return false;
  }
  const startTime = Date.now();
  try {
    await currentSheetsClient.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: values,
      },
    });
    const duration = Date.now() - startTime;
    console.log(`Successfully appended ${values.length} row(s) to range: ${range} in ${duration}ms.`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error appending sheet data to range ${range} (took ${duration}ms):`, error.message);
     if (error.stack) {
        console.error("Stack trace for appendSheetData error:", error.stack);
    }
    return false;
  }
}

export async function updateSheetData(range: string, values: any[][]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`updateSheetData: Sheets client or GOOGLE_SHEET_ID not available for range '${range}'.`);
     if (sheetsClientInitializationError) console.error("Underlying reason for client not being available:", sheetsClientInitializationError);
    return false;
  }
  const startTime = Date.now();
  try {
    await currentSheetsClient.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });
    const duration = Date.now() - startTime;
    console.log(`Successfully updated data in range: ${range} in ${duration}ms.`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error updating sheet data in range ${range} (took ${duration}ms):`, error.message);
     if (error.stack) {
        console.error("Stack trace for updateSheetData error:", error.stack);
    }
    return false;
  }
}

export async function batchUpdateSheetCells(data: {range: string; values: any[][] }[]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`batchUpdateSheetCells: Sheets client or GOOGLE_SHEET_ID not available.`);
    if (sheetsClientInitializationError) console.error("Underlying reason for client not being available:", sheetsClientInitializationError);
    return false;
  }
  const startTime = Date.now();
  try {
    const requestBody: sheets_v4.Schema$BatchUpdateValuesRequest = {
      valueInputOption: 'USER_ENTERED',
      data: data.map(update => ({
        range: update.range,
        values: update.values,
      })),
    };
    await currentSheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: requestBody,
    });
    const duration = Date.now() - startTime;
    console.log(`Successfully batch updated ${data.length} cell range(s) in ${duration}ms.`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error batch updating sheet data (took ${duration}ms):`, error.message);
    if (error.stack) {
      console.error("Stack trace for batchUpdateSheetCells error:", error.stack);
    }
    return false;
  }
}


async function getSheetGid(sheetName: string): Promise<number | null> {
  if (sheetGidCache.has(sheetName)) {
    return sheetGidCache.get(sheetName)!;
  }

  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`getSheetGid: Sheets client or GOOGLE_SHEET_ID not available for sheet '${sheetName}'.`);
    return null;
  }

  try {
    // console.log(`getSheetGid: Fetching metadata for spreadsheet ID: ${GOOGLE_SHEET_ID} to find GID for sheet: "${sheetName}"`);
    const response = await currentSheetsClient.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    });

    if (response.data.sheets) {
      for (const sheet of response.data.sheets) {
        if (sheet.properties && sheet.properties.title === sheetName && sheet.properties.sheetId != null) {
          // console.log(`getSheetGid: Found GID ${sheet.properties.sheetId} for sheet "${sheetName}"`);
          sheetGidCache.set(sheetName, sheet.properties.sheetId);
          return sheet.properties.sheetId;
        }
      }
    }
    console.error(`getSheetGid: Sheet with name "${sheetName}" not found in spreadsheet ${GOOGLE_SHEET_ID}. Ensure the sheet name constant in data.ts matches the actual sheet tab name (case-sensitive).`);
    return null;
  } catch (error: any) {
    console.error(`getSheetGid: Error fetching sheet GID for "${sheetName}": ${error.message}`);
    return null;
  }
}

export async function deleteSheetRow(sheetName: string, rowIndex: number): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`deleteSheetRow: Sheets client or GOOGLE_SHEET_ID not available for sheet '${sheetName}'.`);
    return false;
  }

  const numericSheetId = await getSheetGid(sheetName);
  if (numericSheetId === null) {
    console.error(`deleteSheetRow: Could not get GID for sheet "${sheetName}". Cannot delete row ${rowIndex}.`);
    return false;
  }
  if (rowIndex <= 0) {
    console.error(`deleteSheetRow: Invalid rowIndex ${rowIndex}. Must be 1-based.`);
    return false;
  }

  const startTime = Date.now();
  try {
    const request: sheets_v4.Params$Resource$Spreadsheets$Batchupdate = {
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // API is 0-indexed
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    };
    await currentSheetsClient.spreadsheets.batchUpdate(request);
    const duration = Date.now() - startTime;
    console.log(`Successfully deleted row ${rowIndex} from sheet "${sheetName}" (GID: ${numericSheetId}) in ${duration}ms.`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Error deleting row ${rowIndex} from sheet "${sheetName}" (GID: ${numericSheetId}) (took ${duration}ms): ${error.message}`);
    if (error.stack) {
      console.error("Stack trace for deleteSheetRow error:", error.stack);
    }
    return false;
  }
}


export async function findRowByUniqueValue(sheetName: string, uniqueValueToFind: string, columnIndex: number): Promise<number | null> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) {
    console.error(`findRowByUniqueValue: Sheets client or GOOGLE_SHEET_ID not available for sheet '${sheetName}'.`);
    return null;
  }
   if (columnIndex < 0) {
      console.error(`findRowByUniqueValue: Invalid columnIndex ${columnIndex} for sheet '${sheetName}'. Must be 0 or greater.`);
      return null;
  }

  let columnLetter = '';
  let tempColumnIndex = columnIndex;
  while (tempColumnIndex >= 0) {
    columnLetter = String.fromCharCode((tempColumnIndex % 26) + 'A'.charCodeAt(0)) + columnLetter;
    tempColumnIndex = Math.floor(tempColumnIndex / 26) - 1;
  }

  const searchRange = `${sheetName}!${columnLetter}1:${columnLetter}`;
  console.log(`findRowByUniqueValue: Searching for '${uniqueValueToFind}' in sheet '${sheetName}', column ${columnLetter} (0-indexed: ${columnIndex}), range ${searchRange}.`);

  const startTime = Date.now();
  const columnData = await readSheetData(searchRange);
  if (!columnData) {
    console.warn(`findRowByUniqueValue: Could not read column ${columnLetter} from sheet '${sheetName}'. readSheetData returned null.`);
    return null;
  }

  for (let i = 0; i < columnData.length; i++) {
    if (columnData[i] && columnData[i][0] !== undefined && columnData[i][0] !== null && String(columnData[i][0]).trim() === String(uniqueValueToFind).trim()) {
      const duration = Date.now() - startTime;
      const rowNumberInSheet = i + 1; // 1-based row number in sheet
      console.log(`findRowByUniqueValue: Found '${uniqueValueToFind}' in ${sheetName}:${columnLetter} at sheet row ${rowNumberInSheet} in ${duration}ms (including column read).`);
      return rowNumberInSheet;
    }
  }
  const duration = Date.now() - startTime;
  console.warn(`findRowByUniqueValue: Value '${uniqueValueToFind}' not found in sheet '${sheetName}', column ${columnLetter} (search took ${duration}ms).`);
  return null;
}

    