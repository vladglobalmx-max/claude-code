import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma/client";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { DocumentType, FolioNumberingMode } from "@/generated/prisma/enums";
import {
  appendVersion,
  formatLongFolio,
  formatOrderFolio,
  formatShortFolio,
} from "@/lib/folio/format";

type Executor = PrismaClient | Prisma.TransactionClient;

/** `year = 0` es el bucket "continuo" — ver comentario en schema.prisma. */
export function resolveSequenceYear(folioNumberingMode: FolioNumberingMode, now = new Date()): number {
  return folioNumberingMode === "CONTINUOUS" ? 0 : now.getFullYear();
}

/**
 * Incrementa el consecutivo de (linea, tipo de documento, año) de forma
 * atomica con un solo UPSERT — Postgres serializa las escrituras
 * concurrentes sobre la misma fila, así que dos llamadas simultáneas nunca
 * obtienen el mismo consecutivo (docs/ARCHITECTURE.md §7.2).
 *
 * Debe llamarse dentro de la MISMA transaccion que crea el documento
 * (cotizacion/pedido): si esa transaccion hace rollback, este incremento
 * se revierte con ella y el consecutivo no se "quema" en falso.
 */
export async function reserveNextConsecutive(
  executor: Executor,
  input: { businessUnitId: string; documentType: DocumentType; year: number },
): Promise<number> {
  const id = randomUUID();
  const rows = await executor.$queryRaw<{ last_consecutive: number }[]>`
    INSERT INTO sequence_settings (id, business_unit_id, document_type, year, last_consecutive, created_at, updated_at)
    VALUES (${id}::uuid, ${input.businessUnitId}::uuid, ${input.documentType}::"DocumentType", ${input.year}, 1, now(), now())
    ON CONFLICT (business_unit_id, document_type, year)
    DO UPDATE SET last_consecutive = sequence_settings.last_consecutive + 1, updated_at = now()
    RETURNING last_consecutive
  `;
  return rows[0].last_consecutive;
}

export type IssuedFolio = {
  folio: string;
  shortFolio: string;
  consecutive: number;
  year: number;
  month: number;
};

/**
 * Logica compartida de emision, sin decidir la frontera de transaccion —
 * la decide quien llama (ver `issueFolio` vs `issueFolioInTransaction`).
 */
async function issueFolioCore(
  executor: Executor,
  input: { businessUnitId: string; documentType: DocumentType; sellerCode: string },
): Promise<IssuedFolio> {
  const businessUnit = await executor.businessUnit.findUniqueOrThrow({
    where: { id: input.businessUnitId },
  });

  const year = resolveSequenceYear(businessUnit.folioNumberingMode);
  const consecutive = await reserveNextConsecutive(executor, {
    businessUnitId: input.businessUnitId,
    documentType: input.documentType,
    year,
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const calendarYear = now.getFullYear();

  const folio =
    input.documentType === "ORDER"
      ? formatOrderFolio({ lineCode: businessUnit.code, year: calendarYear, consecutive })
      : formatLongFolio({
          lineCode: businessUnit.code,
          year: calendarYear,
          month,
          consecutive,
          sellerCode: input.sellerCode,
        });

  const shortFolio = formatShortFolio({
    lineCode: businessUnit.code,
    year: calendarYear,
    month,
    consecutive,
  });

  return { folio, shortFolio, consecutive, year: calendarYear, month };
}

/**
 * Punto de entrada para emitir un folio de forma independiente (p. ej. el
 * diagnostico de /admin/sequences): abre su propia transaccion.
 */
export async function issueFolio(input: {
  businessUnitId: string;
  documentType: DocumentType;
  sellerCode: string;
}): Promise<IssuedFolio> {
  return prisma.$transaction((tx) => issueFolioCore(tx, input));
}

/**
 * Punto de entrada para emitir un folio como parte de una transaccion mas
 * grande (crear la cotizacion junto con su folio, Modulo 6+): si el resto de
 * la transaccion falla, este incremento se revierte con ella y el
 * consecutivo no se "quema" en falso (docs/ARCHITECTURE.md §7.2).
 */
export async function issueFolioInTransaction(
  tx: Prisma.TransactionClient,
  input: { businessUnitId: string; documentType: DocumentType; sellerCode: string },
): Promise<IssuedFolio> {
  return issueFolioCore(tx, input);
}

export { appendVersion };
