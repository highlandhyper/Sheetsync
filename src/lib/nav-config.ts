

import { Settings, ClipboardPlus, ClipboardList, Undo, History, UserCheck, Edit3 as ManageProductsIcon, SearchCode, LayoutDashboard, Building, Package } from 'lucide-react';

export const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/products/by-supplier', label: 'Return by Supplier', icon: Undo, roles: ['admin'] },
  { href: '/products', label: 'Return by Staff', icon: UserCheck, roles: ['admin', 'viewer'] },
  { href: '/inventory', label: 'View Inventory', icon: ClipboardList, roles: ['admin'] },
  { href: '/inventory/add', label: 'Log New Item', icon: ClipboardPlus, roles: ['admin'] },
  { href: '/inventory/lookup', label: 'Barcode Log Lookup', icon: SearchCode, roles: ['admin', 'viewer'] },
  { href: '/inventory/returns', label: 'Return Log', icon: History, roles: ['admin'] },
];

export const accountNavItems = [
   { href: '/products/list', label: 'Product Catalog', icon: Package, roles: ['admin'] },
   { href: '/suppliers', label: 'Manage Suppliers', icon: Building, roles: ['admin'] },
   { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'viewer'] },
];
