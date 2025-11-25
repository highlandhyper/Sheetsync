import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Edit } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import { memo } from 'react';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
}

const SupplierCardComponent = ({ supplier, onEdit }: SupplierCardProps) => {
  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="pb-3">
         <Image
            src={`https://picsum.photos/seed/${supplier.id}/400/200`}
            alt={supplier.name}
            width={400}
            height={200}
            className="rounded-t-lg aspect-[2/1] object-cover -mt-6 -mx-6 mb-4"
            data-ai-hint="office building"
          />
        <CardTitle className="text-lg leading-tight">{supplier.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-xs text-muted-foreground flex items-center">
          <Building className="w-3 h-3 mr-1.5" />
          <span>ID: {supplier.id}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
          <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(supplier)}>
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit Supplier
          </Button>
      </CardFooter>
    </Card>
  );
}

export const SupplierCard = memo(SupplierCardComponent);
