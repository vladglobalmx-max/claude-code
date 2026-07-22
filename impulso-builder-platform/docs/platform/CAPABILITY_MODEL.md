# Capability Model — Fase 4.1

> Complementa [ADR-0026](../adr/0026-commercial-platform-boundaries.md). Define cómo un Builder consulta "¿puedo usar esto?" sin conocer precio, canal, ni producto comercial. El tipo vive en `packages/commercial-schema/src/capability.ts` (contrato de datos únicamente — la evaluación real, `CapabilityProvider`, es diseño para Fase 4.2, no implementación de esta fase).

## Principio rector
La UI y el código de dominio **consultan capabilities, nunca precio ni canal**. Un componente del wizard de exportación pregunta `capabilities.has("print.professional")` — nunca `if (userPlan === "pro")` ni `if (channel === "gumroad")`. Esto es lo que permite que capas 1-2 (dominio creativo) nunca importen nada de las capas comerciales salvo esta interfaz mínima.

## `CapabilityId` — namespace punteado
Ejemplos ya identificados en el código existente (Epic 1-9), usados como catálogo de referencia para el primer `ProductManifest` real (ADR-0027):

| CapabilityId | Corresponde hoy a |
|---|---|
| `sticker.core` | Editor base de Sticker Builder (Epic 1-8) |
| `sticker.templates` | Templates (Epic 4) |
| `export.svg` | `packages/export-engine`, salida SVG |
| `export.png` | `packages/export-engine`, salida PNG |
| `export.pdf` | `packages/print-engine`, exportación PDF de página única |
| `print.professional` | Wizard completo de exportación de producción (Epic 9), incluyendo imposición/Preflight |
| `imposition.grid` | Sub-capacidad de `print.professional`: hojas de imposición |
| `asset-library.premium` | Reservado — sin contraparte real hoy (ningún asset premium existe) |
| `cloud-sync` | Reservado — sin contraparte real (Fase 4/5 futura) |
| `commercial-use` | Reservado — término de licencia de uso, no una capacidad técnica; se modela igual por consistencia de API |

Ningún `CapabilityId` de la tabla está gateado hoy — **todos están disponibles siempre**, sin excepción, hasta que Fase 4.2 introduzca el primer `CapabilityProvider` real.

## `CapabilityProvider` — interfaz (diseño, Fase 4.2 implementa)

```ts
interface CapabilityCheckResult {
  granted: boolean;
  reason: "included" | "not-entitled" | "expired" | "unknown";
}

interface CapabilityProvider {
  has(capabilityId: string): CapabilityCheckResult;
}
```

### Default seguro — regla dura para el lanzamiento de esta capa
La primera implementación real (Fase 4.2) **debe** incluir un `OpenCapabilityProvider` que devuelve `{ granted: true, reason: "included" }` para cualquier `capabilityId` — reproduciendo exactamente el comportamiento actual (todo siempre activo). Introducir el modelo de capabilities **no puede, por sí solo, bloquear a un usuario existente o nuevo** mientras exista un solo producto/edición real. Un `CapabilityProvider` más restrictivo (leyendo de un `Entitlement` real) solo se activa cuando exista una segunda edición que lo justifique.

## Requisitos no negociables (sección 11)
- **Defaults seguros**: ver arriba — `OpenCapabilityProvider` por defecto.
- **Comportamiento determinista**: la misma combinación de manifest+entitlements produce siempre el mismo resultado — sin dependencia de temporización, orden de carga, o estado de red no capturado explícitamente en el resultado (`"unknown"` es un estado explícito, no un `undefined` implícito).
- **No romper proyectos existentes**: un proyecto ya guardado con contenido de una capability que luego se desactiva **nunca se borra ni se degrada silenciosamente** — ver `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`/futura política de compatibilidad de Fase 4.2 (reutiliza el principio ya establecido en Document Schema de preservar campos desconocidos).
- **No borrar datos si una capability deja de estar activa**: el dato permanece en el `Project`; solo la *acción* (ej. re-exportar con esa feature) se bloquea, nunca el contenido ya creado.
- **Mostrar estado bloqueado de forma comprensible**: ver wireflows de UX comercial en `V1_COMMERCIAL_RECOMMENDATION.md` §4 — nombre/beneficio visible, mensaje claro, nunca oculto sin explicación.
- **Permitir upgrade futuro**: el modelo no fija de antemano cuántas ediciones existen — agregar una nueva es agregar una fila a un catálogo de `CommercialProduct`, no un cambio de arquitectura.

## Explícitamente fuera de alcance de 4.1
No se implementan paywalls visuales masivos en esta fase — ni un solo punto de la UI existente cambia su comportamiento. El `CapabilityProvider` real, su wiring a `apps/sticker-builder`, y la primera pantalla de "feature bloqueada" son trabajo de Fase 4.2.
