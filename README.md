# SheetSync: Next-Gen Inventory Management

SheetSync is a high-performance, industrial-grade inventory management system built to synchronize warehouse operations with Google Sheets in real-time. It provides a robust, offline-capable interface for tracking product lifecycles, forensic audit trails, and staff-based return protocols.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & ShadCN UI (Industrial Theme)
- **Authentication**: Firebase Auth
- **Primary Database**: Google Sheets API v4
- **State Management**: React Context API (Provider Pattern)
- **Persistence**: IndexedDB (idb) & LocalStorage (Offline Data Cache)
- **Scanning**: HTML5-QRCode (Optical Barcode Identification)

## 🏗️ System Architecture

### 1. Data Lifecycle
- **Read**: The system utilizes a "Cache-First" approach. On load, data is pulled from IndexedDB for zero-latency startup. A background sync then triggers a server-side fetch from the Google Sheets Registry to ensure data integrity.
- **Write**: Operations use "Optimistic UI" updates. When a log is created, it appears instantly in the UI. The background process then dispatches a Server Action to append the data to the master spreadsheet and records a Forensic Audit entry.

### 2. Offline Synchronization
- **Detection**: The app monitors connection states via `window` listeners.
- **Queueing**: If the device is offline, write operations (Logs, Returns) are stored in an `OfflineAction` queue within `localStorage`.
- **Handshake**: Upon reconnection, the system automatically replays the queue, ensuring zero data loss in low-connectivity warehouse environments.

## 🛠️ Key Features

- **Inventory Control**: Real-time tracking of SKU volume, location, and expiry thresholds.
- **Product Catalog**: Master registry for defining industrial assets and cost valuations.
- **Diary Registry (Expiry Watch)**: Specialized systematic tracking for items requiring regular rotation or replacement.
- **Forensic Audit Log**: Immutable record of every administrative and operational action for security compliance.
- **Approval Center**: Secure protocol for authorizing temporary staff access or product registration requests without persistent OTP sessions.
- **Return Protocol**: Systematic stock removal workflow categorized by Staff or Supplier with automatic forensic logging.

## 📋 Operational Workflow

1. **Authentication**: Secure entry via Firebase Identity Platform. Permissions are enforced based on a hardcoded security model (Admin/Viewer).
2. **Identification**: Users identify assets via optical barcode scanning or fuzzy search against the local Registry cache.
3. **Logging**: Personnel record stock arrivals, identifying quantity, location, and expiry.
4. **Audit**: Every transaction generates a forensic trace, identifying the "who, what, and when" of registry changes.
5. **Security**: Sensitive operations (Wipes, Overrides) require local administrator verification via a high-security challenge dialog.

---
*SheetSync Core • Secure Industrial Registry Terminal • v5.0.0*