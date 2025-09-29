
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
  getDashboardMetrics as dbGetDashboardMetrics,
  deleteInventoryItemById as dbDeleteInventoryItemById,
  loadPermissions,
  savePermissions,
  getInventoryItems
} from '@/lib/data';
import type { Product, InventoryItem, Supplier, ItemType, DashboardMetrics, Permissions } from '@/lib/types';
import { format } from 'date-fns';


export interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: z.ZodIssue[];
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

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for product.",
        errors: validationResult.error.issues,
      };
    }

    const { barcode, productName, supplierName } = validationResult.data;

    // Using the more comprehensive dbAddProduct which handles BAR DATA and SUP DATA
    const newProduct = await dbAddProduct({
      barcode,
      productName,
      supplierName,
    });

    if (!newProduct) {
        throw new Error("Failed to create product. Check server logs (Google Sheets API or other data source).");
    }

    revalidatePath('/products/manage');
    revalidatePath('/products');
    revalidatePath('/products/by-supplier');
    revalidatePath('/inventory');
    revalidatePath('/inventory/lookup'); 
    revalidatePath('/dashboard'); 
    revalidatePath('/suppliers'); // Revalidate new supplier list page

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

    const validationResult = addProductSchema.safeParse(rawFormData); // Using addProductSchema for now

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for product details.",
        errors: validationResult.error.issues,
      };
    }

    const { barcode, productName, supplierName } = validationResult.data;
    let savedProduct: Product | null = null;

    if (editMode === 'create') {
      savedProduct = await dbAddProduct({ barcode, productName, supplierName });
      if (!savedProduct) {
        throw new Error("Failed to create new product. Check server logs.");
      }
    } else if (editMode === 'edit') {
      const success = await dbUpdateProductAndSupplierLinks(barcode, productName, supplierName);
      if (!success) {
        throw new Error("Failed to update existing product. Check server logs.");
      }
      savedProduct = { id: barcode, barcode, productName, supplierName, createdAt: new Date().toISOString() }; // Construct a representative Product object
    } else {
      throw new Error("Invalid edit mode specified.");
    }

    // Revalidate paths that display product or supplier information
    revalidatePath('/products/manage'); 
    revalidatePath('/products'); 
    revalidatePath('/products/by-supplier'); 
    revalidatePath('/inventory'); 
    revalidatePath('/inventory/returns'); 
    revalidatePath('/inventory/lookup'); 
    revalidatePath('/dashboard'); 
    revalidatePath('/suppliers'); // Revalidate new supplier list page

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

    if (!validationResult.success) {
      return {
        success: false,
        message: "Validation failed for supplier name.",
        errors: validationResult.error.issues,
      };
    }

    const { supplierName } = validationResult.data;

    const result = await dbAddSupplier({ name: supplierName });

    if (result.error || !result.supplier) {
      return {
        success: false,
        message: result.error || 'Failed to add supplier for an unknown reason. Check server logs.',
        errors: result.error ? [{ path: ['supplierName'], message: result.error, code: z.ZodIssueCode.custom }] : []
      };
    }

    revalidatePath('/products/manage'); 
    revalidatePath('/suppliers'); 
    revalidatePath('/products/by-supplier');
    revalidatePath('/inventory');
    revalidatePath('/inventory/lookup'); 
    revalidatePath('/dashboard'); 

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

    const success = await dbUpdateSupplierName(currentSupplierName, newSupplierName);

    if (!success) {
      // dbUpdateSupplierName logs specific errors, but we can generalize here
      throw new Error(`Failed to update supplier name in the data source. Check server logs. It's possible no supplier named "${currentSupplierName}" was found or an API error occurred.`);
    }
    
    // Revalidate paths where supplier names might appear
    revalidatePath('/suppliers'); // The supplier list page itself
    revalidatePath('/products/manage'); // Products might be linked to this supplier
    revalidatePath('/products/by-supplier'); // Filtering by supplier
    revalidatePath('/inventory'); // Inventory items show supplier names
    revalidatePath('/inventory/returns'); // Return log shows supplier names
    revalidatePath('/inventory/lookup');
    revalidatePath('/dashboard'); // Dashboard might use supplier counts or names

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
      itemToAdd,
      { productName: productDetails.productName, supplierName: productDetails.supplierName || 'N/A' }
    );

    if (!newInventoryItem) {
        throw new Error("Failed to log inventory item. Check server logs.");
    }

    revalidatePath('/inventory');
    revalidatePath('/inventory/add');
    revalidatePath('/products/by-supplier');
    revalidatePath('/products');
    revalidatePath('/inventory/returns');
    revalidatePath('/inventory/lookup'); 
    revalidatePath('/dashboard'); 
    revalidatePath('/suppliers');

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

export async function returnInventoryItemAction(itemId: string, quantityToReturn: number, staffName: string): Promise<ActionResponse> {
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

    const result = await dbProcessReturn(itemId, quantityToReturn, staffName);
    if (result.success) {
      revalidatePath('/products/by-supplier');
      revalidatePath('/products');
      revalidatePath('/inventory');
      revalidatePath('/inventory/returns');
      revalidatePath('/inventory/lookup'); 
      revalidatePath('/dashboard'); 
      revalidatePath('/suppliers');
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
      expiryDate?: Date | null;
    } = {
      location,
      itemType,
      quantity,
      expiryDate: expiryDate, // Pass Date object directly
    };

    const success = await dbUpdateInventoryItemDetails(itemId, updates);

    if (!success) {
      throw new Error("Failed to update inventory item details. Check server logs.");
    }

    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/products/by-supplier');
    revalidatePath('/inventory/lookup'); 
    revalidatePath('/dashboard'); 
    revalidatePath('/suppliers');

    return {
      success: true,
      message: 'Inventory item details updated successfully!',
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
    const metrics = await dbGetDashboardMetrics();
    return { success: true, data: metrics };
  } catch (error) {
    console.error("Error in fetchDashboardMetricsAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching dashboard metrics.";
    return { success: false, message: `Failed to fetch dashboard metrics: ${errorMessage}`, data: undefined };
  } finally {
    console.timeEnd(timeLabel);
  }
}

export async function deleteInventoryItemAction(itemId: string): Promise<ActionResponse> {
  const timeLabel = `Action: deleteInventoryItemAction for item ${itemId}`;
  console.time(timeLabel);
  try {
    if (!itemId) {
      return { success: false, message: 'Item ID is required for deletion.' };
    }

    const success = await dbDeleteInventoryItemById(itemId);

    if (success) {
      revalidatePath('/inventory/lookup');
      revalidatePath('/inventory');
      revalidatePath('/dashboard');
      revalidatePath('/products/by-supplier');
      revalidatePath('/products');
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
    const permissions = await loadPermissions();
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
    const success = await savePermissions(permissions);
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

export async function bulkDeleteInventoryItemsAction(itemIds: string[]): Promise<ActionResponse> {
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
      const success = await dbDeleteInventoryItemById(itemId);
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
        const result = await dbProcessReturn(itemId, quantityToReturn, staffName);
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
}

    