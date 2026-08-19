"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ProductTypeItem } from "@/types/domain";
import { convertQuoteToOrder } from "../../actions";

export function ConvertQuoteForm({ quoteId, productTypes }: { quoteId: string; productTypes: ProductTypeItem[] }) {
  const [productType, setProductType] = useState(productTypes[0]?.code ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!productType) {
      toast.error("Selecciona un tipo de producto.");
      return;
    }
    startTransition(async () => {
      const result = await convertQuoteToOrder(quoteId, productType);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <Label htmlFor="product_type">Tipo de producto</Label>
        <Select id="product_type" value={productType} onChange={(e) => setProductType(e.target.value)}>
          {productTypes.map((t) => (
            <option key={t.id} value={t.code}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit} className="w-full">
        Crear pedido
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
