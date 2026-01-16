

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addProductSchema, // Re-using for validation, consider renaming to productSchema
  addInventoryItemSchema,
  addSupplierSchema,
  editInventoryItemSchema,
  editSupplierSchema
} from '@/lib/schemas';
import {
  addProduct as dbAddProduct,
  getProductDetailsByBarcode,
  addInventoryItem as dbAddInventoryItem,
  processReturn as dbProcessReturn,
  addSupplier as dbAddSupplier,
  updateSupplierNameAndReferences as dbUpdateSupplierName,
  updateInventoryItemDetails as dbUpdateInventoryItemDetails,
  updateProductAndSupplierLinks as dbUpdateProductAndSupplierLinks, 
  getInventoryLogEntriesByBarcode,
  getDashboardMetrics,
  deleteInventoryItemById as dbDeleteInventoryItemById,
  loadPermissionsFromSheet,
  savePermissionsToSheet,
  getInventoryItems,
  getProducts,
  getSuppliers,
  getReturnedItems,
  getUniqueLocations,
  getUniqueStaffNames,
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, ItemType, DashboardMetrics, Permissions, ReturnedItem } from '@/lib/types';
import { format } from 'date-fns';


export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
}

// --- New Action for fetching all cached data ---
export async function fetchAllDataAction(): Promise<ActionResponse<{
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
}>> {
  try {
    const [
      inventoryItems,
      products,
      suppliers,
      returnedItems,
      uniqueLocations,
      uniqueStaffNames
    ] = await Promise.all([
      getInventoryItems(),
      getProducts(),
      getSuppliers(),
      getReturnedItems(),
      getUniqueLocations(),
      getUniqueStaffNames()
    ]);

    return {
      success: true,
      data: {
        inventoryItems: inventoryItems || [],
        products: products || [],
        suppliers: suppliers || [],
        returnedItems: returnedItems || [],
        uniqueLocations: uniqueLocations || [],
        uniqueStaffNames: uniqueStaffNames || []
      }
    };
  } catch (error) {
    console.error("Error in fetchAllDataAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching all app data.";
    return { success: false, message: errorMessage };
  }
}

// Action specifically for the real-time inventory list page
export async function fetchInventoryListDataAction(): Promise<ActionResponse<{
    inventoryItems: InventoryItem[];
    suppliers: Supplier[];
    uniqueLocations: string[];
}>> {
    try {
        const [inventoryItems, suppliers, uniqueLocations] = await Promise.all([
            getInventoryItems(),
            getSuppliers(),
            getUniqueLocations()
        ]);
        return {
            success: true,
            data: {
                inventoryItems: inventoryItems || [],
                suppliers: suppliers || [],
                uniqueLocations: uniqueLocations || [],
            }
        };
    } catch (error) {
        console.error("Error in fetchInventoryListDataAction:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching inventory list data.";
        return { success: false, message: errorMessage };
    }
}


// This action might be deprecated or merged into saveProductAction
export async function addProductAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<Product>> {
  const timeLabel = "Action: addProductAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validationResult = addProductSchema.safeParse(rawFormData);
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for product.",
        errors: validationResult.error.issues,
      };
    }

    const { barcode, productName, supplierName, costPrice } = validationResult.data;

    // Using the more comprehensive dbAddProduct which handles BAR DATA and SUP DATA
    const newProduct = await dbAddProduct(userEmail, {
      barcode,
      productName,
      supplierName,
      costPrice
    });

    if (!newProduct) {
        throw new Error("Failed to create product. Check server logs (Google Sheets API or other data source).");
    }

    revalidateRelevantPaths();

    return {
      success: true,
      message: 'Product added successfully!',
      data: newProduct,
    };
  } catch (error) {
    console.error("Error in addProductAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while adding the product.";
    return {
      success: false,
      message: `Failed to add product: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function fetchProductAction(barcode: string): Promise<ActionResponse<Product | null>> {
  const timeLabel = `Action: fetchProductAction for ${barcode}`;
  console.time(timeLabel);
  try {
    if (!barcode || barcode.trim() === '') {
      return { success: false, message: "Barcode is required for search." };
    }
    // getProductDetailsByBarcode returns an InventoryItem-like structure, adapting for Product
    const productDetails = await getProductDetailsByBarcode(barcode.trim());

    if (productDetails && productDetails.productName) { // Check productName as a sign of existence
      const product: Product = {
        id: productDetails.barcode, // Assuming id is barcode for products
        barcode: productDetails.barcode,
        productName: productDetails.productName,
        supplierName: productDetails.supplierName || '', // Ensure supplierName is a string
        costPrice: productDetails.costPrice,
      };
      return { success: true, data: product };
    } else {
      return { success: false, message: `Product with barcode ${barcode} not found.` , data: null };
    }
  } catch (error) {
    console.error(`Error in fetchProductAction for ${barcode}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to fetch product: ${errorMessage}`, data: null };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function saveProductAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<Product>> {
  const timeLabel = "Action: saveProductAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const editMode = rawFormData.editMode as 'create' | 'edit';
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    const validationResult = addProductSchema.safeParse(rawFormData); // Using addProductSchema for now

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for product details.",
        errors: validationResult.error.issues,
      };
    }

    const { barcode, productName, supplierName, costPrice } = validationResult.data;
    let savedProduct: Product | null = null;

    if (editMode === 'create') {
      savedProduct = await dbAddProduct(userEmail, { barcode, productName, supplierName, costPrice });
      if (!savedProduct) {
        throw new Error("Failed to create new product. Check server logs.");
      }
    } else if (editMode === 'edit') {
      const success = await dbUpdateProductAndSupplierLinks(userEmail, barcode, productName, supplierName, costPrice);
      if (!success) {
        throw new Error("Failed to update existing product. Check server logs.");
      }
      savedProduct = { id: barcode, barcode, productName, supplierName, costPrice, createdAt: new Date().toISOString() }; // Construct a representative Product object
    } else {
      throw new Error("Invalid edit mode specified.");
    }

    revalidateRelevantPaths();

    return {
      success: true,
      message: `Product ${editMode === 'create' ? 'created' : 'updated'} successfully!`,
      data: savedProduct,
    };
  } catch (error) {
    console.error("Error in saveProductAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while saving the product.";
    return {
      success: false,
      message: `Failed to save product: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}


export async function addSupplierAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<Supplier>> {
  const timeLabel = "Action: addSupplierAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validationResult = addSupplierSchema.safeParse(rawFormData);
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for supplier name.",
        errors: validationResult.error.issues,
      };
    }

    const { supplierName } = validationResult.data;

    const result = await dbAddSupplier(userEmail, { name: supplierName });

    if (result.error || !result.supplier) {
      return {
        success: false,
        message: result.error || 'Failed to add supplier for an unknown reason. Check server logs.',
        errors: result.error ? [{ path: ['supplierName'], message: result.error, code: z.ZodIssueCode.custom }] : []
      };
    }

    revalidateRelevantPaths();

    return {
      success: true,
      message: `Supplier "${result.supplier.name}" added successfully!`,
      data: result.supplier,
    };
  } catch (error) {
    console.error("Error in addSupplierAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while adding the supplier.";
    return {
      success: false,
      message: `Failed to add supplier: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function editSupplierAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<Supplier>> {
  const timeLabel = "Action: editSupplierAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validationResult = editSupplierSchema.safeParse(rawFormData);
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for supplier details.",
        errors: validationResult.error.issues,
      };
    }

    const { supplierId, currentSupplierName, newSupplierName } = validationResult.data;

    if (currentSupplierName.trim().toLowerCase() === newSupplierName.trim().toLowerCase()) {
       return {
        success: true, // Or false if you consider it an "action not taken"
        message: "Supplier name is already the same. No update performed.",
        data: { id: supplierId, name: newSupplierName.trim() }
      };
    }

    const success = await dbUpdateSupplierName(userEmail, currentSupplierName, newSupplierName);

    if (!success) {
      // dbUpdateSupplierName logs specific errors, but we can generalize here
      throw new Error(`Failed to update supplier name in the data source. Check server logs. It's possible no supplier named "${currentSupplierName}" was found or an API error occurred.`);
    }
    
    revalidateRelevantPaths();

    return {
      success: true,
      message: `Supplier "${currentSupplierName}" updated to "${newSupplierName}" successfully!`,
      data: { id: supplierId, name: newSupplierName.trim() }, // Return a representative Supplier object
    };
  } catch (error) {
    console.error("Error in editSupplierAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while updating the supplier.";
    return {
      success: false,
      message: `Failed to update supplier: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}


export async function addInventoryItemAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<InventoryItem>> {
  const timeLabel = "Action: addInventoryItemAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    const parsedData = {
      ...rawFormData,
      quantity: rawFormData.quantity ? Number(rawFormData.quantity) : undefined,
      expiryDate: rawFormData.expiryDate ? new Date(rawFormData.expiryDate as string) : undefined,
    };

    const validationResult = addInventoryItemSchema.safeParse(parsedData);

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for inventory item.",
        errors: validationResult.error.issues,
      };
    }
    const validatedItemData = validationResult.data;

    const productDetails = await getProductDetailsByBarcode(validatedItemData.barcode);

    if (!productDetails || !productDetails.productName) {
      return {
        success: false,
        message: `Product with barcode ${validatedItemData.barcode} not found in BAR DATA. Please add it via the Manage Products page first.`,
        errors: [{ path: ['barcode'], message: `Product with barcode ${validatedItemData.barcode} not found.`, code: z.ZodIssueCode.custom }]
      };
    }

    const itemToAdd = {
        staffName: validatedItemData.staffName,
        itemType: validatedItemData.itemType,
        barcode: validatedItemData.barcode,
        quantity: validatedItemData.quantity,
        expiryDate: validatedItemData.expiryDate,
        location: validatedItemData.location,
    };

    const newInventoryItem = await dbAddInventoryItem(
      userEmail,
      itemToAdd,
      { productName: productDetails.productName, supplierName: productDetails.supplierName || 'N/A' }
    );

    if (!newInventoryItem) {
        throw new Error("Failed to log inventory item. Check server logs.");
    }

    revalidateRelevantPaths();

    return {
      success: true,
      message: 'Inventory item logged successfully!',
      data: newInventoryItem,
    };
  } catch (error) {
    console.error("Error in addInventoryItemAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while logging the inventory item.";
    return {
      success: false,
      message: `Failed to log inventory item: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function returnInventoryItemAction(
  userEmail: string, 
  itemId: string, 
  quantityToReturn: number, 
  staffName: string
): Promise<ActionResponse> {
  const timeLabel = "Action: returnInventoryItemAction";
  console.time(timeLabel);
  try {
    if (!itemId) {
      return { success: false, message: 'Item ID is required.' };
    }
    if (quantityToReturn <= 0) {
      return { success: false, message: 'Quantity to return must be a positive number.' };
    }
    if (!staffName || staffName.trim() === '') {
      return { success: false, message: 'Staff name for processing the return is required.' };
    }

    const result = await dbProcessReturn(userEmail, itemId, quantityToReturn, staffName);
    if (result.success) {
      revalidateRelevantPaths();
      return { success: true, message: result.message || 'Item processed for return.' };
    } else {
      return { success: false, message: result.message || 'Failed to process return. Check server logs.' };
    }
  } catch (error) {
    console.error('Error in returnInventoryItemAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while processing the return.';
    return { success: false, message: `Failed to process return: ${errorMessage}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function editInventoryItemAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse<InventoryItem>> {
  const timeLabel = "Action: editInventoryItemAction";
  console.time(timeLabel);
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const userEmail = formData.get('userEmail') as string || 'Unknown User';

    const parsedData = {
      itemId: rawFormData.itemId as string,
      location: rawFormData.location as string,
      itemType: rawFormData.itemType as ItemType,
      expiryDate: rawFormData.expiryDate ? new Date(rawFormData.expiryDate as string) : null,
      quantity: rawFormData.quantity ? Number(rawFormData.quantity) : undefined,
    };

    const validationResult = editInventoryItemSchema.safeParse(parsedData);

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for editing inventory item.",
        errors: validationResult.error.issues,
      };
    }
    const { itemId, location, itemType, expiryDate, quantity } = validationResult.data;

    const updates: {
      location?: string;
      itemType?: ItemType;
      quantity?: number;
      expiryDate?: string | null;
    } = {
      location,
      itemType,
      quantity,
      expiryDate: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : null, // Keep yyyy-MM-dd for data.ts function
    };

    const updatedItem = await dbUpdateInventoryItemDetails(userEmail, itemId, updates);

    if (!updatedItem) {
      throw new Error("Failed to update inventory item details. Check server logs.");
    }

    revalidateRelevantPaths();

    return {
      success: true,
      message: 'Inventory item details updated successfully!',
      data: updatedItem,
    };
  } catch (error) {
    console.error("Error in editInventoryItemAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while updating the item.";
    return {
      success: false,
      message: `Failed to update item: ${errorMessage}`,
    };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function fetchInventoryLogEntriesByBarcodeAction(barcode: string): Promise<ActionResponse<InventoryItem[]>> {
  const timeLabel = `Action: fetchInventoryLogEntriesByBarcodeAction for ${barcode}`;
  console.time(timeLabel);
  try {
    if (!barcode || barcode.trim() === '') {
      return { success: false, message: "Barcode is required for search." };
    }
    const items = await getInventoryLogEntriesByBarcode(barcode.trim());
    if (items.length > 0) {
      return { success: true, data: items };
    } else {
      return { success: true, message: `No inventory log entries found for barcode ${barcode}.`, data: [] };
    }
  } catch (error) {
    console.error(`Error in fetchInventoryLogEntriesByBarcodeAction for ${barcode}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to fetch inventory log entries: ${errorMessage}`, data: [] };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function fetchDashboardMetricsAction(): Promise<ActionResponse<DashboardMetrics>> {
    const timeLabel = "Action: fetchDashboardMetricsAction";
    console.time(timeLabel);
    try {
        const metrics = await getDashboardMetrics();
        return { success: true, data: metrics };
    } catch (error) {
        console.error("Error in fetchDashboardMetricsAction:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching dashboard metrics.";
        return { success: false, message: `Failed to fetch dashboard metrics: ${errorMessage}`, data: undefined };
    } finally {
        console.timeEnd(timeLabel);
    }
}


export async function deleteInventoryItemAction(userEmail: string, itemId: string): Promise<ActionResponse> {
  const timeLabel = `Action: deleteInventoryItemAction for item ${itemId}`;
  console.time(timeLabel);
  try {
    if (!itemId) {
      return { success: false, message: 'Item ID is required for deletion.' };
    }

    const success = await dbDeleteInventoryItemById(userEmail, itemId);

    if (success) {
      revalidateRelevantPaths();
      return { success: true, message: 'Inventory log entry permanently deleted.' };
    } else {
      return { success: false, message: 'Failed to delete inventory log entry from the data source.' };
    }
  } catch (error) {
    console.error('Error in deleteInventoryItemAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during deletion.';
    return { success: false, message: `Failed to delete item: ${errorMessage}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}


// --- New Actions for Centralized Permissions ---

export async function getPermissionsAction(): Promise<ActionResponse<Permissions>> {
  try {
    const permissions = await loadPermissionsFromSheet();
    if (permissions) {
      return { success: true, data: permissions };
    }
    // If null, it could be that the sheet/entry doesn't exist yet, which is not a hard error.
    // The client-side context will handle creating default permissions.
    return { success: true, data: null, message: "No permissions configured in sheet yet. Defaults will be used." };
  } catch (error) {
    console.error('Error in getPermissionsAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to load permissions: ${errorMessage}` };
  }
}

export async function setPermissionsAction(permissions: Permissions): Promise<ActionResponse> {
  try {
    const success = await savePermissionsToSheet(permissions);
    if (success) {
      revalidatePath('/settings'); // Revalidate to ensure all clients get the new settings
      return { success: true, message: 'Permissions updated successfully.' };
    } else {
      return { success: false, message: 'Failed to save permissions to the data source.' };
    }
  } catch (error) {
    console.error('Error in setPermissionsAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to save permissions: ${errorMessage}` };
  }
}
    
// --- Bulk Actions ---

export async function bulkDeleteInventoryItemsAction(userEmail: string, itemIds: string[]): Promise<ActionResponse> {
  const timeLabel = `Action: bulkDeleteInventoryItemsAction for ${itemIds.length} items`;
  console.time(timeLabel);
  try {
    if (!itemIds || itemIds.length === 0) {
      return { success: false, message: 'No item IDs provided for deletion.' };
    }

    let successfulDeletions = 0;
    let failedDeletions = 0;
    
    // Process deletions sequentially to avoid rate-limiting issues.
    // For higher throughput, a batch-delete function in google-sheets-client.ts would be better.
    for (const itemId of itemIds) {
      const success = await dbDeleteInventoryItemById(userEmail, itemId);
      if (success) {
        successfulDeletions++;
      } else {
        failedDeletions++;
      }
    }

    if (failedDeletions > 0) {
      revalidateRelevantPaths();
      return {
        success: false,
        message: `Deleted ${successfulDeletions} items, but failed to delete ${failedDeletions} items. The list has been refreshed.`,
      };
    }

    revalidateRelevantPaths();
    return { success: true, message: `Successfully deleted all ${successfulDeletions} selected items.` };

  } catch (error) {
    console.error('Error in bulkDeleteInventoryItemsAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during bulk deletion.';
    return { success: false, message: `Failed to bulk delete items: ${errorMessage}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function bulkReturnInventoryItemsAction(
  userEmail: string,
  itemIds: string[], 
  staffName: string, 
  returnType: 'all' | 'specific',
  quantity?: number
): Promise<ActionResponse> {
  const timeLabel = `Action: bulkReturnInventoryItemsAction for ${itemIds.length} items`;
  console.time(timeLabel);
  try {
    if (!itemIds || itemIds.length === 0) {
      return { success: false, message: 'No item IDs provided for return.' };
    }
    if (!staffName) {
      return { success: false, message: 'Processing staff name is required.' };
    }
    if (returnType === 'specific' && (!quantity || quantity < 1)) {
        return { success: false, message: 'A specific quantity of at least 1 is required.' };
    }

    let successfulReturns = 0;
    let failedReturns = 0;

    // Process sequentially to be safe with the sheet API.
    for (const itemId of itemIds) {
        // For 'all', we pass a very large number; the backend logic will cap it at the available quantity.
        const quantityToReturn = returnType === 'all' ? Number.MAX_SAFE_INTEGER : quantity!;
        const result = await dbProcessReturn(userEmail, itemId, quantityToReturn, staffName);
      if (result.success) {
        successfulReturns++;
      } else {
        failedReturns++;
      }
    }

    if (failedReturns > 0) {
      revalidateRelevantPaths();
      return {
        success: false,
        message: `Processed ${successfulReturns} returns, but failed on ${failedReturns} items. The list has been refreshed.`,
      };
    }

    revalidateRelevantPaths();
    return { success: true, message: `Successfully processed return for all ${successfulReturns} selected items.` };

  } catch (error) {
    console.error('Error in bulkReturnInventoryItemsAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during bulk return.';
    return { success: false, message: `Failed to bulk return items: ${errorMessage}` };
  } finally {
    console.timeEnd(timeLabel);
  }
}

function revalidateRelevantPaths() {
    revalidatePath('/inventory');
    revalidatePath('/inventory/returns');
    revalidatePath('/products/by-supplier');
    revalidatePath('/dashboard');
    revalidatePath('/inventory/lookup');
    revalidatePath('/products');
    revalidatePath('/products/list');
    revalidatePath('/products/manage');
    revalidatePath('/suppliers');
}
    

    









