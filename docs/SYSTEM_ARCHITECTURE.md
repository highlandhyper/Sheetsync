# SheetSync System Architecture (A to Z)

This document provides a technical overview of how the SheetSync Inventory Management system functions, from data storage to user interaction.

## 1. High-Level Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & ShadCN UI
- **Auth**: Firebase Authentication
- **Primary Database**: Google Sheets (via Google Sheets API v4)
- **State Management**: React Context API (Provider Pattern)

---

## 2. Data Storage & Structure
The "Database" is a single Google Spreadsheet with the following key tabs:

| Sheet Name | Purpose | Key Columns |
|------------|---------|-------------|
| **DB** | Product Catalog | Barcode, Product Name, Supplier, Cost Price |
| **Form responses 2** | Inventory Logs | Timestamp, Barcode, Qty, Expiry, Location, Staff |
| **Audit Log** | Security Tracking | Timestamp, User, Action, Target, Details |
| **APP_SETTINGS** | System Meta | Access Permissions, Special Requests (JSON blobs) |

---

## 3. The "Read" Lifecycle
How data gets from the Spreadsheet to your screen:

1. **Initialization**: The `DataCacheProvider` (located in `src/context/data-cache-context.tsx`) mounts.
2. **Cached Load**: It immediately pulls the "last known good" data from the browser's `localStorage`. This allows the app to load in milliseconds.
3. **Background Sync**: A `useEffect` hook triggers a call to `fetchAllDataAction` (in `src/app/actions.ts`).
4. **Server-Side Fetch**:
   - The server authenticates with Google using a Service Account JWT.
   - It fetches raw arrays of strings/numbers from the Sheets API.
5. **Data Transformation**:
   - In `src/lib/data.ts`, functions like `transformToInventoryItem` map column indices (e.g., Column B is Barcode) into structured objects.
6. **State Update**: The React Context updates, and all components (Dashboard, Lists) re-render with the live data.

---

## 4. The "Write" Lifecycle
How your actions are saved securely:

1. **Input Validation**: When you submit a form, **Zod** validates the data types.
2. **Optimistic UI Update**: The `DataCacheProvider` adds the item to the local list *before* the server confirms it. This removes "loading lag" for the user.
3. **Server Execution**: The data is sent to a **Server Action**.
4. **Sheet Append**: The server calls `appendSheetData`, which adds a new row to the Spreadsheet.
5. **Audit Trail**: Every write action automatically calls `logAuditEvent`, which records the administrator or viewer who performed the action in the `Audit Log` tab.
6. **Revalidation**: `revalidatePath('/')` is called to clear the Next.js server-side cache for all other users.

---

## 5. Offline Capabilities
1. **Detection**: The app monitors `window.addEventListener('online/offline')`.
2. **Action Queue**: If offline, writes are saved to a `pendingActions` array in `localStorage`.
3. **Automatic Replay**: Once the browser detects a connection, the queue is processed one-by-one via the standard Server Action pipeline.

---

## 6. Access Control Logic
- **Roles**: Defined by email. `viewer@example.com` is hardcoded as the Viewer role; all others are Admins.
- **Granular Permissions**: The Admin can toggle specific pages (e.g., "Manage Products") for the Viewer role. These settings are stored as a JSON string in the `APP_SETTINGS` sheet and synced to all devices.

---

## 7. Visual Verification (Image Lookup)
When a user clicks "View Image":
1. The app sends the barcode to `fetchProductExternalDataAction`.
2. The server makes a request to the **Open Food Facts API**.
3. It returns a URL for the product image, which is then displayed in a high-resolution full-screen modal on mobile.
