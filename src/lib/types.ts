
export interface Product {
  id: string; // This will now map to the Unique ID in Column H (or fallback to barcode)
  barcode: string;
  productName: string;
  supplierId?: string; 
  supplierName?: string;
  costPrice?: number;
  createdAt?: string;
  uniqueId?: string; // Explicit field for the Column H ID
}

export interface Supplier {
  id: string; 
  name: string;
  createdAt?: string;
}

export type ItemType = 'Expiry' | 'Damage';

export interface InventoryItem {
  id: string; 
  productId?: string;
  productName: string; 
  barcode: string; 
  supplierId?: string;
  supplierName?: string; 
  quantity: number;
  expiryDate?: string;
  location: string;
  staffName: string;
  itemType: ItemType;
  timestamp?: string;
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
  location: string;
  staffName: string;
  itemType: ItemType;
  processedBy: string;
  returnTimestamp?: string;
}

export interface AddInventoryItemFormValues {
  staffName: string;
  itemType: ItemType;
  barcode: string;
  quantity: number;
  expiryDate?: Date;
  location: string;
  disableNotification?: boolean;
}

export interface EditInventoryItemFormValues {
  itemId: string;
  location: string;
  itemType: ItemType;
  quantity: number;
  expiryDate?: Date | null;
  authUsername?: string;
  authPassword?: string;
}

export interface StockBySupplier {
  name: string;
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
  totalStockValue: number;
  dailyStockChangePercent?: number;
  dailyStockChangeDirection?: 'increase' | 'decrease' | 'none';
  netItemsAddedToday?: number;
  stockTrend?: StockTrendData[];
}

export type Role = 'admin' | 'viewer';

export type ViewerFeature = 'EXPORT_PDF' | 'PRINT_RECORDS' | 'PROCESS_RETURN' | 'EDIT_INVENTORY' | 'DELETE_INVENTORY';

export type Permissions = {
  admin: string[];
  viewer: string[];
  viewerFeatures?: ViewerFeature[];
  viewerDefaultPath?: string;
};

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    target: string;
    details: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'request';
  isRead: boolean;
  openedAt?: string;
  link?: string;
  metadata?: {
    barcode?: string;
    requestId?: string;
    otp?: string;
    type?: 'add_product_request' | 'authorization' | 'edit_request';
  };
}

export interface SpecialEntryRequest {
  id: string;
  userEmail: string;
  staffName: string;
  reason?: string;
  suggestedProductName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  type: 'single' | 'timed' | 'product_add' | 'inventory_edit';
  durationMinutes?: number;
  requestedAt: string;
  approvedAt?: string;
  expiresAt?: string;
  grantedByAdmin?: boolean;
  otp?: string;
  isDismissedByAdmin?: boolean;
  isReadByUser?: boolean;
  originalDetails?: {
    location: string;
    itemType: ItemType;
    quantity: number;
    expiryDate?: string;
  };
  editDetails?: {
    itemId: string;
    productName: string;
    location: string;
    itemType: ItemType;
    quantity: number;
    expiryDate?: string;
  };
}

export interface OfflineAction {
  id: string;
  type: 'LOG_INVENTORY' | 'PROCESS_RETURN';
  data: any;
  timestamp: string;
  retryCount?: number;
}
