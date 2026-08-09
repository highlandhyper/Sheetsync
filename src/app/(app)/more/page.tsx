'use client';

import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Card, CardContent } from '@/components/ui/card';
import { 
    ShieldCheck, 
    Undo, 
    UserCheck, 
    ClipboardList, 
    FileText, 
    Settings, 
    Edit3, 
    ChevronRight,
    LayoutDashboard,
    LucideIcon,
    ClipboardPlus,
    SearchCode
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HubItem {
    href: string;
    label: string;
    icon: LucideIcon;
    description: string;
    role: 'admin' | 'viewer' | 'both';
}

const HUB_SECTIONS: { title: string; items: HubItem[] }[] = [
    {
        title: "Operations",
        items: [
            { href: '/dashboard', label: 'Mission Control', icon: LayoutDashboard, description: 'Real-time dashboard metrics.', role: 'admin' },
            { href: '/approvals', label: 'Approval Center', icon: ShieldCheck, description: 'Verify staff requests.', role: 'admin' },
            { href: '/inventory', label: 'Global Inventory', icon: ClipboardList, description: 'Master log of all units.', role: 'admin' },
            { href: '/inventory/add', label: 'Log New Item', icon: ClipboardPlus, description: 'Standard SKU logging tool.', role: 'both' },
            { href: '/inventory/lookup', label: 'Barcode Lookup', icon: SearchCode, description: 'Trace specific log history.', role: 'both' },
            { href: '/products', label: 'Return by Staff', icon: UserCheck, description: 'Individual return tracking.', role: 'both' },
            { href: '/products/by-supplier', label: 'Return by Supplier', icon: Undo, description: 'Bulk vendor processing.', role: 'admin' },
        ]
    },
    {
        title: "Management",
        items: [
            { href: '/products/manage', label: 'Manage Products', icon: Edit3, description: 'Update registry definitions.', role: 'admin' },
            { href: '/audit-log', label: 'Security Audit', icon: FileText, description: 'Complete action history.', role: 'admin' },
        ]
    },
    {
        title: "System",
        items: [
            { href: '/settings', label: 'Settings', icon: Settings, description: 'Interface & account.', role: 'both' },
        ]
    }
];

function HubCard({ item }: { item: HubItem }) {
    return (
        <Link href={item.href} className="block group">
            <Card className="border-white/10 bg-card/40 hover:bg-primary/[0.03] hover:border-primary/20 transition-all duration-300 rounded-2xl overflow-hidden shadow-none active:scale-[0.98]">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-1">
                            {item.label}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60 truncate">
                            {item.description}
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </CardContent>
            </Card>
        </Link>
    );
}

export default function SystemHubPage() {
    const { role } = useAuth();
    const { isAllowed } = useAccessControl();

    if (!role) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-1">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none mb-2">
                    System <span className="text-primary">Hub</span>
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">
                    Operational Access Terminal
                </p>
            </div>

            {HUB_SECTIONS.map((section) => {
                const visibleItems = section.items.filter(item => {
                    const roleMatch = item.role === 'both' || item.role === role;
                    // Standard check but always allow settings and operations for Viewers if roleMatch is true
                    const accessMatch = isAllowed(role, item.href);
                    return roleMatch && accessMatch;
                });

                if (visibleItems.length === 0) return null;

                return (
                    <div key={section.title} className="space-y-4">
                        <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 flex items-center gap-3">
                            {section.title}
                            <div className="h-px flex-1 bg-gradient-to-right from-primary/10 to-transparent" />
                        </h2>
                        <div className="grid grid-cols-1 gap-3">
                            {visibleItems.map((item) => (
                                <HubCard key={item.href} item={item} />
                            ))}
                        </div>
                    </div>
                );
            })}

            <div className="pt-10 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">
                    Registry Interface • Industrial Core
                </p>
            </div>
        </div>
    );
}
