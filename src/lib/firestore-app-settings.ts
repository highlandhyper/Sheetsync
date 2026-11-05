import 'server-only';

import { adminDb } from '@/lib/firebase-admin';
import { readSheetData, updateSheetDataRaw, appendSheetDataRaw } from '@/lib/google-sheets-client';
import type { Permissions, SpecialEntryRequest, StaffMember, Supplier } from '@/lib/types';

const LEGACY_SETTINGS_RANGE = 'APP_SETTINGS!A2:B';
const SETTINGS_COLLECTION = 'appSettings';
const SETTINGS_DOCUMENT = 'config';
const REQUESTS_COLLECTION = 'specialRequests';

const LEGACY_KEYS = {
  staff: 'staffList',
  permissions: 'permissions',
  requests: 'specialRequests',
  locations: 'locationList',
  suppliers: 'supplierContacts',
} as const;

type LegacySettings = Record<string, any>;

function parseLegacyRows(rows: any[][]): LegacySettings {
  const result: LegacySettings = {};
  for (const row of rows) {
    const key = String(row?.[0] || '').trim();
    if (!key) continue;
    const raw = row?.[1];
    try {
      result[key] = raw === undefined || raw === null || raw === '' ? null : JSON.parse(String(raw));
    } catch (error) {
      throw new Error(`Cannot migrate APP_SETTINGS: invalid JSON in "${key}". ${String(error)}`);
    }
  }
  return result;
}

function safeData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableSerialize(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  ).join(',')}}`;
}

function requestDocId(id: string): string {
  const normalized = String(id || '').trim();
  if (!normalized) throw new Error('A special request is missing its ID.');
  return encodeURIComponent(normalized);
}

async function writeRequests(requests: SpecialEntryRequest[]): Promise<void> {
  const unique = new Map<string, SpecialEntryRequest>();
  for (const request of requests || []) {
    if (!request?.id) throw new Error('Cannot save a special request without an ID.');
    unique.set(String(request.id), request);
  }

  const collection = adminDb.collection(REQUESTS_COLLECTION);
  const entries = [...unique.values()];
  for (let offset = 0; offset < entries.length; offset += 450) {
    const batch = adminDb.batch();
    for (const request of entries.slice(offset, offset + 450)) {
      const id = String(request.id);
      batch.set(collection.doc(requestDocId(id)), safeData({ ...request, id }) as any, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Imports legacy APP_SETTINGS once. The original sheet is deliberately retained
 * as a rollback copy; subsequent application reads and writes use Firestore.
 */
export async function ensureFirestoreAppSettingsMigrated(): Promise<void> {
  const configRef = adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT);
  const current = await configRef.get();
  if (current.get('legacySheetMigrationVersion') === 1) return;

  const rows = await readSheetData(LEGACY_SETTINGS_RANGE);
  if (rows === null) {
    throw new Error('Cannot migrate application settings: APP_SETTINGS could not be read.');
  }

  const legacy = parseLegacyRows(rows);
  const requests = Array.isArray(legacy[LEGACY_KEYS.requests])
    ? legacy[LEGACY_KEYS.requests] as SpecialEntryRequest[]
    : [];

  // Deterministic document IDs make interrupted migrations safe to retry.
  await writeRequests(requests);

  const legacyStaff = Array.isArray(legacy[LEGACY_KEYS.staff]) ? legacy[LEGACY_KEYS.staff] : [];
  const migrated = {
    permissions: legacy[LEGACY_KEYS.permissions] ?? null,
    staff: legacyStaff.map((staff: any) =>
      typeof staff === 'string' ? { name: staff.toUpperCase() } : staff
    ),
    locations: Array.isArray(legacy[LEGACY_KEYS.locations])
      ? legacy[LEGACY_KEYS.locations]
      : ['Back side', 'On Display', 'Front Side'],
    supplierContacts: Array.isArray(legacy[LEGACY_KEYS.suppliers])
      ? legacy[LEGACY_KEYS.suppliers]
      : [],
  };

  await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(configRef);
    const existing = snapshot.data() || {};
    const update: Record<string, any> = {
      legacySheetMigrationVersion: 1,
      legacySheetMigrationCompletedAt: new Date().toISOString(),
    };

    // Do not overwrite any setting that has already been created in Firestore.
    for (const [key, value] of Object.entries(migrated)) {
      if (existing[key] === undefined) update[key] = value;
    }
    transaction.set(configRef, update, { merge: true });
  });

  console.info('[APP_SETTINGS_MIGRATION] Migrated legacy settings to Firestore.', {
    specialRequestCount: requests.length,
    staffCount: migrated.staff.length,
    supplierCount: migrated.supplierContacts.length,
  });
}

export async function getFirestoreAppMetaData() {
  await ensureFirestoreAppSettingsMigrated();

  const configRef = adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT);
  const [configSnapshot, requestsSnapshot] = await Promise.all([
    configRef.get(),
    adminDb.collection(REQUESTS_COLLECTION).get(),
  ]);

  const config = configSnapshot.data() || {};
  const specialRequests = requestsSnapshot.docs
    .map(document => {
      const data = document.data() as SpecialEntryRequest;
      return { ...data, id: data.id || decodeURIComponent(document.id) };
    })
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));

  const rawStaff = Array.isArray(config.staff) ? config.staff : [];
  const staff = rawStaff.map((item: any) =>
    typeof item === 'string' ? { name: item.toUpperCase() } : item
  );

  return {
    permissions: (config.permissions as Permissions | null) ?? null,
    specialRequests,
    staff,
    locations: Array.isArray(config.locations)
      ? config.locations as string[]
      : ['Back side', 'On Display', 'Front Side'],
    supplierContacts: Array.isArray(config.supplierContacts)
      ? config.supplierContacts as Supplier[]
      : [],
  };
}

export async function loadPermissionsFromFirestore() {
  return (await getFirestoreAppMetaData()).permissions;
}

export async function savePermissionsToFirestore(value: Permissions) {
  await ensureFirestoreAppSettingsMigrated();
  await adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT)
    .set({ permissions: safeData(value) }, { merge: true });
}

export async function saveSpecialRequestsToFirestore(value: SpecialEntryRequest[]): Promise<boolean> {
  await ensureFirestoreAppSettingsMigrated();

  const collection = adminDb.collection(REQUESTS_COLLECTION);
  const existingSnapshot = await collection.get();
  const existingById = new Map<string, Record<string, any>>();
  existingSnapshot.docs.forEach(document => {
    const data = document.data();
    const id = String(data.id || decodeURIComponent(document.id));
    existingById.set(id, data);
  });

  // The client still submits its current list, but only changed/new request
  // documents are written. Rejecting one request therefore does not rewrite
  // every other request in the collection.
  const changed = (value || []).filter(request => {
    if (!request?.id) throw new Error('Cannot save a special request without an ID.');
    const current = existingById.get(String(request.id));
    return !current || stableSerialize(safeData(request)) !== stableSerialize(current);
  });

  await writeRequests(changed);
  return true;
}

async function mirrorStaffListForAppsScript(value: StaffMember[]): Promise<void> {
  // Code.gs still reads staff phone numbers from APP_SETTINGS for SMS delivery.
  // Keep only this small compatibility row mirrored; Firestore remains the app's source of truth.
  const rows = await readSheetData(LEGACY_SETTINGS_RANGE);
  if (rows === null) throw new Error('Staff list could not be mirrored to the Apps Script compatibility row.');

  let rowIndex = -1;
  rows.forEach((row, index) => {
    if (String(row?.[0] || '').trim() === LEGACY_KEYS.staff) rowIndex = index;
  });

  const serialized = JSON.stringify(value);
  const saved = rowIndex >= 0
    ? await updateSheetDataRaw(`APP_SETTINGS!B${rowIndex + 2}`, [[serialized]])
    : await appendSheetDataRaw('APP_SETTINGS!A:B', [[LEGACY_KEYS.staff, serialized]]);

  if (!saved) throw new Error('Firestore staff settings were not mirrored to APP_SETTINGS for Apps Script SMS delivery.');
}

export async function saveStaffListToFirestore(value: StaffMember[]) {
  await ensureFirestoreAppSettingsMigrated();
  await adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT)
    .set({ staff: safeData(value) }, { merge: true });
  await mirrorStaffListForAppsScript(value);
}

export async function saveLocationListToFirestore(value: string[]) {
  await ensureFirestoreAppSettingsMigrated();
  await adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT)
    .set({ locations: safeData(value) }, { merge: true });
}

export async function saveSupplierContactsToFirestore(value: Supplier[]) {
  await ensureFirestoreAppSettingsMigrated();
  await adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT)
    .set({ supplierContacts: safeData(value) }, { merge: true });
}
