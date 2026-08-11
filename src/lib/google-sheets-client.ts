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
      "- GOOGLE_SHEETS_PRIVATE_KEY is missing or empty in .env.local."
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
    sheetsClientInitializationError = "CRITICAL GOOGLE SHEETS API CONFIGURATION ERROR";
    console.error(sheetsClientInitializationError);
    return null;
  }

  try {
    const auth = new JWT({
      email: GOOGLE_SHEETS_CLIENT_EMAIL!,
      key: GOOGLE_SHEETS_PRIVATE_KEY!,
      scopes: SCOPES,
    });

    sheets = google.sheets({ version: 'v4', auth: auth });
    return sheets;
  } catch (error: any) {
    sheetsClientInitializationError = `Error initializing Google Sheets API client: ${error.message}`;
    console.error(sheetsClientInitializationError);
    return null;
  }
}

export async function readSheetData(range: string): Promise<any[][] | null> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return null;

  try {
    const response = await currentSheetsClient.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (error: any) {
    console.error(`Error reading sheet data from range ${range}:`, error.message);
    return null;
  }
}

export async function appendSheetData(range: string, values: any[][]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;
  try {
    await currentSheetsClient.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: values },
    });
    return true;
  } catch (error: any) {
    console.error(`Error appending sheet data:`, error.message);
    return false;
  }
}

export async function updateSheetData(range: string, values: any[][]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;
  try {
    await currentSheetsClient.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: values },
    });
    return true;
  } catch (error: any) {
    console.error(`Error updating sheet data:`, error.message);
    return false;
  }
}

export async function clearSheetData(range: string): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;
  try {
    await currentSheetsClient.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range,
    });
    return true;
  } catch (error: any) {
    console.error(`Error clearing sheet data:`, error.message);
    return false;
  }
}

export async function batchUpdateSheetCells(data: {range: string; values: any[][] }[]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;
  try {
    const requestBody: sheets_v4.Schema$BatchUpdateValuesRequest = {
      valueInputOption: 'USER_ENTERED',
      data: data.map(update => ({ range: update.range, values: update.values })),
    };
    await currentSheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: requestBody,
    });
    return true;
  } catch (error: any) {
    console.error(`Error batch updating sheet data:`, error.message);
    return false;
  }
}

async function getSheetGid(sheetName: string): Promise<number | null> {
  if (sheetGidCache.has(sheetName)) return sheetGidCache.get(sheetName)!;
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return null;

  try {
    const response = await currentSheetsClient.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    });
    if (response.data.sheets) {
      for (const sheet of response.data.sheets) {
        if (sheet.properties && sheet.properties.title === sheetName && sheet.properties.sheetId != null) {
          sheetGidCache.set(sheetName, sheet.properties.sheetId);
          return sheet.properties.sheetId;
        }
      }
    }
    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Ensures the sheet has at least targetRowCount rows. 
 * Prevents "update" operations from failing due to sheet size limits.
 */
export async function ensureSheetRows(sheetName: string, targetRowCount: number): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;

  const numericSheetId = await getSheetGid(sheetName);
  if (numericSheetId === null) return false;

  try {
    const spreadsheet = await currentSheetsClient.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      ranges: [sheetName],
      fields: 'sheets(properties(gridProperties))'
    });

    const currentMaxRows = spreadsheet.data.sheets?.[0]?.properties?.gridProperties?.rowCount || 0;

    if (currentMaxRows < targetRowCount) {
      const rowsToAdd = targetRowCount - currentMaxRows + 500; // Add some buffer
      await currentSheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: {
          requests: [{
            appendDimension: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              length: rowsToAdd
            }
          }]
        }
      });
      console.log(`Expanded sheet "${sheetName}" from ${currentMaxRows} to ${currentMaxRows + rowsToAdd} rows.`);
    }
    return true;
  } catch (error: any) {
    console.error(`Error ensuring sheet rows:`, error.message);
    return false;
  }
}

export async function deleteSheetRow(sheetName: string, rowIndex: number): Promise<boolean> {
  return deleteSheetRowsRange(sheetName, rowIndex - 1, rowIndex);
}

export async function deleteSheetRowsRange(sheetName: string, startIndex: number, endIndex: number): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;

  const numericSheetId = await getSheetGid(sheetName);
  if (numericSheetId === null) return false;

  try {
    await currentSheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              startIndex: startIndex,
              endIndex: endIndex,
            },
          },
        }],
      },
    });
    return true;
  } catch (error: any) {
    return false;
  }
}

export async function deleteSheetRowsBatch(sheetName: string, rowIndices: number[]): Promise<boolean> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return false;
  const numericSheetId = await getSheetGid(sheetName);
  if (numericSheetId === null) return false;

  const sortedIndices = [...rowIndices].sort((a, b) => b - a);
  try {
    const requests = sortedIndices.map(index => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: index - 1,
          endIndex: index,
        },
      },
    }));
    await currentSheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { requests: requests },
    });
    return true;
  } catch (error: any) {
    return false;
  }
}

export async function findRowByUniqueValue(sheetName: string, uniqueValueToFind: string, columnIndex: number): Promise<number | null> {
  const currentSheetsClient = await getSheetsClient();
  if (!currentSheetsClient || !GOOGLE_SHEET_ID) return null;
  if (columnIndex < 0) return null;

  let columnLetter = '';
  let tempColumnIndex = columnIndex;
  while (tempColumnIndex >= 0) {
    columnLetter = String.fromCharCode((tempColumnIndex % 26) + 'A'.charCodeAt(0)) + columnLetter;
    tempColumnIndex = Math.floor(tempColumnIndex / 26) - 1;
  }

  const searchRange = `${sheetName}!${columnLetter}1:${columnLetter}`;
  const columnData = await readSheetData(searchRange);
  if (!columnData) return null;

  for (let i = 0; i < columnData.length; i++) {
    if (columnData[i] && columnData[i][0] !== undefined && columnData[i][0] !== null && String(columnData[i][0]).trim() === String(uniqueValueToFind).trim()) {
      return i + 1;
    }
  }
  return null;
}
