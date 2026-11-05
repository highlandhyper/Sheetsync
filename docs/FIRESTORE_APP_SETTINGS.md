# Firestore-backed application settings

SheetSync application configuration is stored server-side through the Firebase Admin SDK.

## Firestore layout

- `appSettings/config`
  - `permissions`
  - `staff`
  - `locations`
  - `supplierContacts`
  - `legacySheetMigrationVersion`
  - `legacySheetMigrationCompletedAt`
- `specialRequests/{encodedRequestId}`
  - One special-entry request per document.
  - The original request ID is retained in the `id` field.

The existing `userRoles/{uid}` collection is unchanged. The `staffList` row in `APP_SETTINGS` is retained as a compatibility mirror because the deployed Apps Script `Code.gs` still reads staff phone numbers from that row to send expiry SMS. Firestore remains the source of truth for the Next.js application; staff-list saves update the Firestore document and this small Apps Script mirror.

## Migration

The first server-side application metadata read checks the migration marker. If migration version 1 is not present, the server reads `APP_SETTINGS!A2:B`, parses the existing JSON settings, and copies them into Firestore. Special requests are written in batches using deterministic document IDs so an interrupted migration can be retried.

The migration:
- Preserves already-populated Firestore settings.
- Does not delete the old `APP_SETTINGS` sheet. Only the `staffList` compatibility row continues to be updated for Apps Script SMS delivery.
- Writes the completion marker only after the special-request documents and settings have been written.
- Stops with an error if a legacy JSON value cannot be parsed or the sheet cannot be read.

After migration, application settings reads and writes use Firestore. Google Sheets remains the operational store for products, inventory, expiry records, and audit logs.

## Rollback

Do not delete the old `APP_SETTINGS` sheet during initial rollout. It remains the migration source and rollback copy. If rollback is required, revert the feature branch and restore the previous deployment before changing or deleting any Firestore data.
