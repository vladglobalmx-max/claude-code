"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SingleImageField } from "@/components/orders/single-image-field";
import type { MediaDraft } from "@/components/orders/types";
import {
  BUSINESS_UNIT_LOGO_ACCEPT,
  BUSINESS_UNIT_LOGO_MAX_SIZE_MB,
  slugifyBusinessUnitCode,
  validateBusinessUnitLogoFile,
} from "@/lib/validations/business-unit";
import { createBusinessUnit } from "./actions";
import { uploadBusinessUnitLogo } from "../[id]/actions";

/**
 * Alta de Business Unit (THÖREN Business Units — Crear nuevas,
 * 0026_business_unit_creation.sql). El logo NUNCA se sube antes de que
 * exista businessUnitId (el path de Storage lo requiere, ver 0024): aquí
 * solo se "stagea" en memoria (File + preview vía URL.createObjectURL) y
 * se sube recién después de que createBusinessUnit devuelve el id real. Si
 * ese upload falla, la Business Unit ya quedó creada correctamente — se
 * avisa con un toast y se redirige igual a /unidades-negocio/[id], donde
 * puede reintentarse (mismo componente que ya existe, sin lógica nueva).
 *
 * `?created=1` en el redirect: la única función de este parámetro es que
 * /unidades-negocio/[id] pueda detectar, en vivo contra salesperson_quote_
 * sequences, si esta BU recién creada todavía no tiene ninguna secuencia
 * de folio activa — y solo entonces mostrar el aviso para configurar
 * folios (ver comentario en ese page.tsx). No es una bandera persistida:
 * una visita posterior sin este parámetro nunca muestra el aviso.
 */
export function BusinessUnitCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [active, setActive] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDraft, setLogoDraft] = useState<MediaDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNameChange(value: string) {
    setName(value);
    if (!codeTouched) {
      setCode(slugifyBusinessUnitCode(value));
    }
  }

  function handleCodeChange(value: string) {
    setCodeTouched(true);
    setCode(value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  }

  async function handleLogoStage(file: File) {
    const validation = validateBusinessUnitLogoFile(file);
    if ("error" in validation) throw new Error(validation.error);
    setLogoFile(file);
    setLogoDraft({
      key: crypto.randomUUID(),
      path: "staged",
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setLogoDraft(null);
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Indica el nombre de la unidad de negocio");
      return;
    }
    if (!code.trim()) {
      toast.error("Indica el código de la unidad de negocio");
      return;
    }

    startTransition(async () => {
      const result = await createBusinessUnit({ name, code, active });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (logoFile) {
        const fd = new FormData();
        fd.set("file", logoFile);
        const uploadResult = await uploadBusinessUnitLogo(result.businessUnitId, fd);
        if (uploadResult?.error) {
          toast.error(
            `Unidad de negocio creada, pero el logo no se pudo subir (${uploadResult.error}). Puedes intentarlo de nuevo desde el detalle.`
          );
        }
      }

      toast.success("Unidad de negocio creada");
      router.push(`/unidades-negocio/${result.businessUnitId}?created=1`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bu-name">Nombre</Label>
            <Input id="bu-name" value={name} onChange={(e) => handleNameChange(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="bu-code">Código</Label>
            <Input
              id="bu-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Se sugiere automáticamente a partir del nombre. Minúsculas, números y guion bajo. No se podrá cambiar
              después de crear la unidad.
            </p>
          </div>
          <div>
            <Label htmlFor="bu-active">Estado</Label>
            <label className="flex h-9 items-center gap-2 text-sm text-ink-soft">
              <input
                id="bu-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
              />
              Activo
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identidad visual</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Logo</Label>
          <SingleImageField
            value={logoDraft}
            onUpload={handleLogoStage}
            onRemove={handleLogoRemove}
            accept={BUSINESS_UNIT_LOGO_ACCEPT}
            label="Subir logo"
            maxSizeMB={BUSINESS_UNIT_LOGO_MAX_SIZE_MB}
          />
          <p className="mt-2 text-xs text-ink-faint">
            PNG, JPG o WebP. Máximo {BUSINESS_UNIT_LOGO_MAX_SIZE_MB} MB. Se recomienda fondo transparente.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          Crear unidad de negocio
        </Button>
      </div>
    </div>
  );
}
