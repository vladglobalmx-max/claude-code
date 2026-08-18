"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Upload, FileWarning, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  parseImportRow,
  groupImportRows,
  findCustomerDuplicate,
  findContactDuplicateSignal,
  type ParsedImportRow,
  type ImportGroup,
  type ImportRowError,
  type CustomerCandidate,
  type ContactCandidate,
  type CustomerDuplicateMatch,
  type ContactDuplicateSignal,
} from "@/lib/customers/import-parsing";
import { getCustomerImportCandidates, commitCustomerImport, type ImportCommitGroup, type ImportCommitResult } from "./actions";

type Resolution = "skip" | "add_contacts" | "create_anyway";

interface PreviewGroup {
  group: ImportGroup;
  match: CustomerDuplicateMatch | null;
  contactSignals: ContactDuplicateSignal[];
  resolution: Resolution;
}

const SIGNAL_LABEL: Record<Exclude<ContactDuplicateSignal, null>, string> = {
  strong: "Posible duplicado (mismo email)",
  possible: "Posible duplicado (mismo teléfono)",
  warning: "Mismo nombre — verifica antes de agregar",
};

const SIGNAL_VARIANT: Record<Exclude<ContactDuplicateSignal, null>, "danger" | "warning" | "neutral"> = {
  strong: "danger",
  possible: "warning",
  warning: "neutral",
};

export function ImportWizard() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [previewGroups, setPreviewGroups] = useState<PreviewGroup[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  async function handleFile(file: File) {
    setIsLoading(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const rows = await readSheet(file);
      const [, ...dataRows] = rows; // primera fila = encabezado, se descarta

      const parsedRows: ParsedImportRow[] = [];
      const errors: ImportRowError[] = [];
      dataRows.forEach((cells, index) => {
        const isBlankRow = cells.every((c) => c === null || c === undefined || String(c).trim() === "");
        if (isBlankRow) return;
        const { row, error } = parseImportRow(index + 1, cells);
        if (error) errors.push(error);
        if (row) parsedRows.push(row);
      });

      const candidatesResult = await getCustomerImportCandidates();
      if ("error" in candidatesResult) {
        toast.error(candidatesResult.error);
        return;
      }

      const groups = groupImportRows(parsedRows);
      const preview = buildPreview(groups, candidatesResult.customers, candidatesResult.contacts);

      setTotalRows(parsedRows.length + errors.length);
      setRowErrors(errors);
      setPreviewGroups(preview);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo. Verifica que sea un .xlsx válido.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateResolution(index: number, resolution: Resolution) {
    setPreviewGroups((prev) => prev.map((g, i) => (i === index ? { ...g, resolution } : g)));
  }

  async function handleConfirm() {
    setIsCommitting(true);
    try {
      const payload: ImportCommitGroup[] = previewGroups.map(({ group, match, resolution }) => ({
        customerName: group.customerName,
        legalName: group.legalName,
        taxId: group.taxId,
        customerEmail: group.customerEmail,
        customerPhone: group.customerPhone,
        contacts: group.contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
        resolution: match ? resolution : "create",
        existingCustomerId: match ? match.customer.id : null,
      }));

      const commitResult = await commitCustomerImport(payload);
      setResult(commitResult);
      setStep("done");
    } finally {
      setIsCommitting(false);
    }
  }

  const newCustomers = previewGroups.filter((g) => !g.match).length;
  const totalContacts = previewGroups.reduce((sum, g) => sum + g.group.contacts.length, 0);
  const possibleDuplicates = previewGroups.filter((g) => g.match).length;

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Sube el archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Usa la plantilla descargada arriba, sin cambiar el orden ni los nombres de las columnas.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-accent">
            <Upload className="h-6 w-6 text-ink-faint" />
            <span className="text-sm font-medium text-ink">
              {isLoading ? "Leyendo archivo…" : "Selecciona un archivo .xlsx"}
            </span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={isLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>2. Revisa antes de importar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total filas" value={totalRows} />
              <Stat label="Clientes nuevos" value={newCustomers} />
              <Stat label="Contactos" value={totalContacts} />
              <Stat label="Posibles duplicados" value={possibleDuplicates} />
              <Stat label="Errores" value={rowErrors.length} />
            </div>
          </CardContent>
        </Card>

        {rowErrors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-danger">
                <FileWarning className="h-4 w-4" />
                Filas con error (no se importarán)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-danger">
                {rowErrors.map((e) => (
                  <li key={e.rowNumber}>{e.message}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {previewGroups.map((pg, index) => (
            <PreviewGroupCard key={`${pg.group.groupKeyType}:${pg.group.groupKey}`} pg={pg} onResolutionChange={(r) => updateResolution(index, r)} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={isCommitting} disabled={isCommitting || previewGroups.length === 0} onClick={handleConfirm}>
            Confirmar importación
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("upload")}>
            <ArrowLeft className="h-4 w-4" />
            Elegir otro archivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importación completada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Clientes creados" value={result?.customersCreated ?? 0} />
          <Stat label="Contactos creados" value={result?.contactsCreated ?? 0} />
          <Stat label="Omitidos" value={result?.omitted ?? 0} />
          <Stat label="Errores" value={result?.errors.length ?? 0} />
        </div>
        {result && result.errors.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-danger">Errores</p>
            <ul className="space-y-1 text-sm text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.group}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <Link href="/clientes">
            <Button type="button">Ir a Clientes</Button>
          </Link>
          <Button type="button" variant="outline" onClick={() => setStep("upload")}>
            Importar otro archivo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function PreviewGroupCard({ pg, onResolutionChange }: { pg: PreviewGroup; onResolutionChange: (r: Resolution) => void }) {
  const { group, match, contactSignals, resolution } = pg;

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{group.customerName}</p>
            <p className="text-xs text-ink-faint">
              {group.groupKeyType === "tax_id" ? `RFC: ${group.taxId}` : "Agrupado por nombre (sin RFC)"}
              {group.legalName ? ` · ${group.legalName}` : ""}
            </p>
          </div>
          {match ? (
            <Badge variant="warning">
              Posible duplicado ({match.matchType === "tax_id" ? "mismo RFC" : "mismo nombre"}: {match.customer.name})
            </Badge>
          ) : (
            <Badge variant="success">Cliente nuevo</Badge>
          )}
        </div>

        {(group.customerEmail || group.customerPhone) && (
          <p className="text-xs text-ink-faint">
            Datos del cliente: {group.customerEmail ?? "—"} · {group.customerPhone ?? "—"}
          </p>
        )}

        {group.contacts.length > 0 && (
          <div className="space-y-1 rounded-lg bg-surface-2 p-2">
            {group.contacts.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-ink">
                  {c.name} — {c.email ?? "sin email"} · {c.phone ?? "sin teléfono"}
                </span>
                {contactSignals[i] && <Badge variant={SIGNAL_VARIANT[contactSignals[i]!]}>{SIGNAL_LABEL[contactSignals[i]!]}</Badge>}
              </div>
            ))}
          </div>
        )}

        {match && (
          <div>
            <label className="text-xs font-medium text-ink-soft">Qué hacer con este grupo</label>
            <Select value={resolution} onChange={(e) => onResolutionChange(e.target.value as Resolution)}>
              <option value="skip">Omitir (no hacer nada)</option>
              <option value="add_contacts">Agregar contacto(s) al cliente existente</option>
              <option value="create_anyway">Crear cliente nuevo de todos modos</option>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildPreview(groups: ImportGroup[], customers: CustomerCandidate[], contacts: ContactCandidate[]): PreviewGroup[] {
  return groups.map((group) => {
    const match = findCustomerDuplicate(group, customers);
    const relevantContacts = match ? contacts.filter((c) => c.customer_id === match.customer.id) : contacts;
    const contactSignals = group.contacts.map((c) => findContactDuplicateSignal(c, relevantContacts));
    return { group, match, contactSignals, resolution: "skip" };
  });
}
