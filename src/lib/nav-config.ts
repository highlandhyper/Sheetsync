import { Settings, ClipboardPlus, ClipboardList, Undo, History, UserCheck, Edit3 as ManageProductsIcon, SearchCode, LayoutDashboard, Building, FileText, BellDot } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Array<'admin' | 'viewer'>;
  mobileOnly?: boolean;
  exact?: boolean;
}

export const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], exact: true },
  { href: '/products/by-supplier', label: 'Return by Supplier', icon: Undo, roles: ['admin'] },
  { href: '/products', label: 'Return by Staff', icon: UserCheck, roles: ['admin', 'viewer'], exact: true },
  { href: '/inventory', label: 'View Inventory', icon: ClipboardList, roles: ['admin'], exact: true },
  { href: '/inventory/add', label: 'Log New Item', icon: ClipboardPlus, roles: ['admin'] },
  { href: '/inventory/returns', label: 'Return Log', icon: History, roles: ['admin'] },
  { href: '/inventory/lookup', label: 'Barcode Log Lookup', icon: SearchCode, roles: ['admin', 'viewer'], mobileOnly: true },
  { href: '/audit-log', label: 'Audit Log', icon: FileText, roles: ['admin'], exact: true },
];

export const accountNavItems: NavItem[] = [
   { href: '/products/manage', label: 'Manage Products', icon: ManageProductsIcon, roles: ['admin'] },
   { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'viewer'], exact: true },
];
