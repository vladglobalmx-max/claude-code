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
 * Punto de entrada unico para emitir un folio. Pensado para llamarse dentro
 * de la transaccion que crea la cotizacion/pedido (Modulo 6+); aqui se usa
 * `prisma.$transaction` solo cuando se invoca de forma independiente (p. ej.
 * el diagnostico de /admin/sequences).
 */
export async function issueFolio(input: {
  businessUnitId: string;
  documentType: DocumentType;
  sellerCode: string;
}): Promise<IssuedFolio> {
  return prisma.$transaction(async (tx) => {
    const businessUnit = await tx.businessUnit.findUniqueOrThrow({
      where: { id: input.businessUnitId },
    });

    const year = resolveSequenceYear(businessUnit.folioNumberingMode);
    const consecutive = await reserveNextConsecutive(tx, {
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
  });
}

export { appendVersion };
