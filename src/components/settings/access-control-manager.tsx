'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import { Separator } from '../ui/separator';
import { Layout, ShieldCheck, FileText, Printer, Undo2, Edit, Trash2, Globe } from 'lucide-react';
import type { ViewerFeature } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AccessControlManager() {
  const { permissions, setPermission, setFeaturePermission, setViewerDefaultPath } = useAccessControl();

  const mainNavItems = allNavItems.filter(item => item.href !== '/settings');
  const managementItems = accountNavItems.filter(item => item.href !== '/settings');

  const enabledViewerPaths = permissions.viewer || [];
  const enabledViewerFeatures = permissions.viewerFeatures || [];

  const availableLandingPages = [...allNavItems, ...accountNavItems].filter(item => 
    enabledViewerPaths.includes(item.href)
  );

  const viewerFeaturesList: { id: ViewerFeature; label: string; icon: any; description: string }[] = [
    { id: 'EXPORT_PDF', label: 'Export PDF Reports', icon: FileText, description: 'Allows viewers to generate and download inventory PDFs.' },
    { id: 'PRINT_RECORDS', label: 'Print Records', icon: Printer, description: 'Allows viewers to use the print dialogue for lists.' },
    { id: 'PROCESS_RETURN', label: 'Process Returns', icon: Undo2, description: 'Allows viewers to return stock items to inventory.' },
    { id: 'EDIT_INVENTORY', label: 'Edit Logs', icon: Edit, description: 'Allows viewers to modify existing inventory log entries.' },
    { id: 'DELETE_INVENTORY', label: 'Delete Records', icon: Trash2, description: 'Allows viewers to permanently remove logs (Not Recommended).' },
  ];

  const handlePermissionChange = (path: string, isEnabled: boolean) => {
    setPermission('viewer', path, isEnabled);
  };

  const handleFeatureToggle = (feature: ViewerFeature, isEnabled: boolean) => {
    setFeaturePermission(feature, isEnabled);
  };

  const renderToggle = (item: typeof allNavItems[0]) => (
    <div key={item.href} className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/5 rounded-lg">
                <item.icon className="h-5 w-5 text-primary" />
             </div>
            <Label htmlFor={`perm-${item.href}`} className="cursor-pointer font-bold pr-2 text-sm">
                {item.label}
            </Label>
        </div>
        <Switch
            id={`perm-${item.href}`}
            checked={enabledViewerPaths.includes(item.href)}
            onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
            className="flex-shrink-0"
        />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* GLOBAL VIEWER HEADER */}
      <div className="rounded-2xl border bg-primary/5 p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
                <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
                <h4 className="font-black text-lg text-primary uppercase tracking-tighter">Default Entry Point</h4>
                <p className="text-xs text-muted-foreground font-medium">Where Viewers land after a successful login.</p>
            </div>
        </div>
        <Select 
            value={permissions.viewerDefaultPath} 
            onValueChange={setViewerDefaultPath}
            disabled={availableLandingPages.length === 0}
        >
            <SelectTrigger className="w-full bg-background h-12 text-sm font-bold border-primary/20">
                <SelectValue placeholder={availableLandingPages.length === 0 ? "Enable pages below first" : "Select landing page"} />
            </SelectTrigger>
            <SelectContent>
                {availableLandingPages.map(item => (
                    <SelectItem key={item.href} value={item.href}>
                        <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 mb-6">
          <TabsTrigger value="pages" className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:text-primary">
            <Layout className="h-3.5 w-3.5" />
            Page Visibility
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Feature Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="space-y-4 animate-in fade-in-50 duration-300 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mainNavItems.map(renderToggle)}
                {managementItems.map(renderToggle)}
            </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4 animate-in fade-in-50 duration-300 outline-none">
            <div className="grid grid-cols-1 gap-3">
                {viewerFeaturesList.map((feature) => (
                    <div key={feature.id} className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors group">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors">
                                <feature.icon className="h-6 w-6 text-accent-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor={`feature-${feature.id}`} className="cursor-pointer font-black text-base block">
                                    {feature.label}
                                </Label>
                                <p className="text-xs text-muted-foreground font-medium">{feature.description}</p>
                            </div>
                        </div>
                        <Switch
                            id={`feature-${feature.id}`}
                            checked={enabledViewerFeatures.includes(feature.id)}
                            onCheckedChange={(checked) => handleFeatureToggle(feature.id, checked)}
                            className="flex-shrink-0"
                        />
                    </div>
                ))}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}