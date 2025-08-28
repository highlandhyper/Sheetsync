import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building } from 'lucide-react';
import type { Supplier } from '@/lib/types';

interface SupplierCardProps {
  supplier: Supplier;
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Image
            src={`https://placehold.co/80x80.png?text=${supplier.name.substring(0,1)}`}
            alt={supplier.name}
            width={50}
            height={50}
            className="rounded-full object-cover"
            data-ai-hint="office building"
          />
          <CardTitle className="text-lg">{supplier.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground flex items-center">
          <Building className="w-4 h-4 mr-2 text-primary" />
          <span>Supplier ID: {supplier.id}</span>
        </div>
        {/* Future: Could add number of products from this supplier, contact info, etc. */}
      </CardContent>
    </Card>
  );
}
