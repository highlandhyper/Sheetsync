import 'server-only';

import { getFirestoreAppMetaData, saveSupplierContactsToFirestore } from '@/lib/firestore-app-settings';
import { readSheetData, batchUpdateSheetCells, appendSheetData } from '@/lib/google-sheets-client';

const DB_RANGE = 'DB!A2:H';
const INVENTORY_RANGE = 'Form responses 2!A2:J';
const AUDIT_RANGE = 'Audit Log!A:E';

export async function updateSupplierAcrossRegistryInFirestore(
  email: string,
  supplierId: string,
  oldName: string,
  newName: string,
  meta: Record<string, unknown>,
) {
  const appMeta = await getFirestoreAppMetaData();
  const updatedContacts = appMeta.supplierContacts.map((supplier: any) =>
    supplier.id === supplierId ? { ...supplier, name: newName, ...meta } : supplier
  );
  await saveSupplierContactsToFirestore(updatedContacts);

  const [productRows, inventoryRows] = await Promise.all([
    readSheetData(DB_RANGE),
    readSheetData(INVENTORY_RANGE),
  ]);

  if (productRows === null || inventoryRows === null) {
    throw new Error('Supplier details were saved, but the product or inventory cascade could not be read.');
  }

  const productUpdates = productRows.flatMap((row, index) =>
    String(row[3] || '').trim() === oldName
      ? [{ range: `DB!D${index + 2}`, values: [[newName]] }]
      : []
  );
  if (productUpdates.length) await batchUpdateSheetCells(productUpdates);

  const inventoryUpdates = inventoryRows.flatMap((row, index) =>
    String(row[7] || '').trim() === oldName
      ? [{ range: `Form responses 2!H${index + 2}`, values: [[newName]] }]
      : []
  );
  if (inventoryUpdates.length) await batchUpdateSheetCells(inventoryUpdates);

  await appendSheetData(AUDIT_RANGE, [[
    new Date().toISOString(),
    email,
    'SYNC_SUPPLIER',
    oldName,
    `[RENAMED] ${oldName} -> ${newName}. Registry cascaded.`,
  ]]);

  return true;
}
