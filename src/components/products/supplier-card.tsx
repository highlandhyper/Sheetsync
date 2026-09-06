import { memo } from 'react';
import { Building2, Edit, Hash, ArrowUpRight } from 'lucide-react';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { Supplier } from '@/lib/types';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
}

const SupplierCardComponent = ({
  supplier,
  onEdit,
}: SupplierCardProps) => {
  const supplierInitial = supplier.name?.trim()?.charAt(0)?.toUpperCase() || 'S';

  return (
    <Card className="
      group relative flex h-full w-full flex-col
      overflow-hidden rounded-2xl
      border border-border/60
      bg-card/80
      shadow-sm
      transition-all duration-300
      hover:-translate-y-1
      hover:border-primary/20
      hover:shadow-xl hover:shadow-black/[0.05]
      dark:hover:shadow-black/20
    ">
      {/* Decorative background */}
      <div className="
        pointer-events-none absolute -right-16 -top-16
        h-40 w-40 rounded-full
        bg-primary/[0.08] blur-3xl
        transition-all duration-500
        group-hover:bg-primary/[0.14]
      " />

      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30" />

      <CardContent className="relative z-10 flex flex-1 flex-col p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="
            flex h-12 w-12 shrink-0
            items-center justify-center
            rounded-2xl
            border border-primary/15
            bg-primary/10
            text-lg font-bold text-primary
            shadow-sm
            transition-transform duration-300
            group-hover:scale-105
          ">
            {supplierInitial}
          </div>

          <Badge
            variant="outline"
            className="
              border-border/60
              bg-background/60
              px-2.5 py-1
              text-[9px] font-semibold
              uppercase tracking-[0.12em]
              text-muted-foreground
            "
          >
            Supplier
          </Badge>
        </div>

        {/* Supplier information */}
        <div className="mt-5 min-w-0">
          <h3 className="
            line-clamp-2
            text-lg font-bold
            leading-snug tracking-tight
            text-foreground
            sm:text-xl
          ">
            {supplier.name}
          </h3>

          <div className="
            mt-3 flex items-center gap-2
            text-xs text-muted-foreground
          ">
            <div className="
              flex h-7 w-7
              items-center justify-center
              rounded-lg
              bg-muted/60
            ">
              <Hash className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Supplier ID
              </p>

              <p className="truncate font-mono text-xs font-medium">
                {supplier.id}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom visual */}
        <div className="
          mt-5 flex items-center gap-3
          rounded-xl
          border border-border/50
          bg-muted/[0.22]
          p-3
        ">
          <div className="
            flex h-9 w-9 shrink-0
            items-center justify-center
            rounded-xl
            bg-primary/10 text-primary
          ">
            <Building2 className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vendor Registry
            </p>

            <p className="mt-0.5 text-xs font-medium text-foreground">
              Active supplier profile
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="
        relative z-10
        border-t border-border/50
        bg-muted/[0.12]
        p-4 sm:px-6
      ">
        <Button
          variant="outline"
          className="
            group/button h-10 w-full
            rounded-xl
            border-border/60
            bg-background/70
            font-semibold
            transition-all
            hover:border-primary/25
            hover:bg-primary/5
            hover:text-primary
          "
          onClick={() => onEdit(supplier)}
        >
          <Edit className="mr-2 h-4 w-4" />

          Edit Supplier

          <ArrowUpRight
            className="
              ml-auto h-4 w-4
              opacity-40
              transition-all
              group-hover/button:translate-x-0.5
              group-hover/button:-translate-y-0.5
              group-hover/button:opacity-100
            "
          />
        </Button>
      </CardFooter>
    </Card>
  );
};

export const SupplierCard = memo(SupplierCardComponent);