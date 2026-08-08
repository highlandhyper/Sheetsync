# SheetSync Android Native Blueprint

Use this prompt with Gemini or any LLM to build the native Android version of the SheetSync Inventory System.

## Role: Senior Android Engineer (Kotlin & Jetpack Compose)

## Project Overview: SheetSync Inventory Management
Build a native Android application called "SheetSync" that functions as an industrial-grade inventory hub. The app must sync in real-time with a Google Spreadsheet serving as the primary database.

## 1. Technical Stack Requirements
- **Language**: Kotlin 2.x
- **UI Framework**: Jetpack Compose (Material 3)
- **Architecture**: MVVM with Clean Architecture
- **Data Persistence (Offline)**: Room Database
- **Networking**: Retrofit / Ktor with Google Sheets API v4
- **Auth**: Firebase Authentication (Email/Password)
- **Scanning**: Google ML Kit Barcode Scanning (High-speed)
- **Background Tasks**: WorkManager (for syncing offline queue)
- **DI**: Hilt or Koin

## 2. Core Visual Aesthetic (The "Industrial Hub" Look)
- **Geometry**: Uniform `16dp` (rounded-2xl equivalent) corner radius for all cards and dialogs.
- **Atmosphere**: Technical precision grid background with subtle radial gradients.
- **Glassmorphism**: Use `Surface` with subtle alpha and `blur` effects where supported.
- **Theme**: Dark/Light mode support using a Primary Blue (`#29abe2`) accent.

## 3. Key Feature Specifications

### A. Centered "Spotlight" Search (Brave-Inspired)
- **Trigger**: A floating search bar triggered by a dedicated icon or system-wide shortcut.
- **UI**: A centered, floating rounded-rectangle search bar.
- **Animation**: When active, the background dims; results appear in a fluid sliding panel below the search bar.
- **Functionality**: Immediate barcode lookup or product name search. Integrated "Quick Scan" button inside the bar.

### B. Mission Control Dashboard
- **Metric Grid**: 4 main cards (Volume, Valuation, Expiring, Damage) using `rounded-2xl` architecture.
- **Live Analytics**: A Bar Chart (using `Compose Charts` or `Canvas`) showing stock by supplier.
- **Real-time Status**: A sync indicator (Network: Encrypted / Offline Mode).

### C. The Logging Stepper (Multi-step Form)
- **Step 1**: Barcode Scan (ML Kit Camera).
- **Step 2**: Details (Personnel selection, Qty, Expiry Date picker, Damage/Expiry toggle).
- **Step 3**: Location/Zone selection.
- **Step 4**: Review & Commit with "Silent Entry" toggle (Admin only).

### D. Security & Permissions
- **Roles**: Hardcoded logic: `viewer@example.com` = Restricted Viewer; others = Admin.
- **Admin Features**: CRUD on Products, Return processing, User registry management, Local Key settings.
- **Silent Mode**: OTP-based activation for Viewers to bypass email alerts on specific logs.
- **Inactivity Lock**: A "Security Gate" screen that triggers after X minutes, requiring a Local Access Key.

## 4. Data Layer & Data Flow
- **Single Source of Truth**: Google Sheets (Form responses 2, DB, Audit Log, APP_SETTINGS).
- **Offline First**: Writes must be saved to a `pending_actions` Room table if network is lost.
- **Sync Engine**: WorkManager should process the queue immediately when connectivity is restored.
- **Audit Trail**: Every action (create, edit, delete, return) must log a row to the "Audit Log" sheet.

## 5. Instructions for LLM Implementation
1.  **Start with the Data Domain**: Define the Kotlin Data Classes for `InventoryItem`, `Product`, and `SpecialRequest`.
2.  **Repository Logic**: Implement a `Repository` that handles the logic between local Room cache and Remote Sheets API.
3.  **UI Implementation**: Build the "Spotlight" search component first, ensuring the smooth `rounded-2xl` geometry is maintained.
4.  **Security**: Implement a `SecurityGate` ViewModel that manages the inactivity timer and Local Access Key validation.
