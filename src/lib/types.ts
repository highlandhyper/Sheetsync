

// Firebase uses string IDs for documents/nodes
export interface Product {
  id: string; 
  barcode: string;
  productName: string;
  supplierId?: string; 
  supplierName?: string; // Denormalized for convenience
  costPrice?: number;
  createdAt?: string; // ISO string or number (timestamp)
}

export interface Supplier {
  id: string; 
  name: string;
  createdAt?: string; // ISO string or number (timestamp)
}

export type ItemType = 'Expiry' | 'Damage';

export interface InventoryItem {
  id: string; 
  productId?: string; // Optional if direct entry without linking to a cataloged product
  productName: string; 
  barcode: string; 
  supplierId?: string;
  supplierName?: string; 
  quantity: number;
  expiryDate?: string; // Store as YYYY-MM-DD string or ISO string
  location: string;
  staffName: string;
  itemType: ItemType;
  timestamp?: string; // ISO string or Firebase ServerValue.TIMESTAMP
}

export interface ReturnedItem {
  id: string; 
  originalInventoryItemId?: string;
  productId?: string;
  productName: string;
  barcode: string;
  supplierId?: string;
  supplierName?: string;
  returnedQuantity: number;
  expiryDate?: string;
  location: string; // Original location
  staffName: string; // Staff who originally logged the item
  itemType: ItemType; // Original item type
  processedBy: string; // Staff who processed the return
  returnTimestamp?: string; // ISO string or Firebase ServerValue.TIMESTAMP
}

export interface AddInventoryItemFormValues {
  staffName: string;
  itemType: ItemType;
  barcode: string;
  quantity: number; // Will be parsed from string
  expiryDate?: Date; // From form, convert to string for Sheets/DB
  location: string;
}

export interface EditInventoryItemFormValues {
  itemId: string;
  location: string;
  itemType: ItemType;
  quantity: number;
  expiryDate?: Date | null; // Date from form picker, can be nullified
  authUsername?: string;
  authPassword?: string;
}

export interface StockBySupplier {
  name: string; // Supplier Name
  totalStock: number;
}

export interface StockTrendData {
  date: string;
  totalStock: number;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalStockQuantity: number;
  itemsExpiringSoon: number;
  damagedItemsCount: number;
  stockBySupplier: StockBySupplier[];
  totalSuppliers: number;
  dailyStockChangePercent?: number;
  dailyStockChangeDirection?: 'increase' | 'decrease' | 'none';
  netItemsAddedToday?: number; // To display "+N items (New)" if stock started at 0
  stockTrend?: StockTrendData[];
}

export type Role = 'admin' | 'viewer';

export type Permissions = {
  [key in Role]: string[];
};

export interface AuditLogEntry {
    id: string;
    timestamp: string; // ISO 8601 format
    user: string; // User's email or ID
    action: string; // e.g., "CREATE_PRODUCT", "UPDATE_INVENTORY", "PROCESS_RETURN"
    target: string; // The primary identifier of the item affected (e.g., barcode, item ID, supplier name)
    details: string; // A human-readable description of the change
}
