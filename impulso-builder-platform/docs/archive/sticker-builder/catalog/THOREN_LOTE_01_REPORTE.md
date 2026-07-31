> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# THÖREN — Reporte de Producción: Lote 1

**Alcance.** Cierra el Lote 1 (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`) — 5 templates "cero ilustración, layout puro" construidos enteramente sobre `catalogTemplates/kit/`. Sigue el formato de reporte de 10 puntos acordado al aprobar el plan maestro.

## 1. Tiempo invertido

Ejecutado en una sola sesión continua de trabajo (no medido en jornadas de calendario, a diferencia del marco de "días-persona" del plan, pensado para producción humana por lotes). En términos procedimentales, la hipótesis central del lote se cumplió exactamente como se planeó: cero infraestructura nueva, 5 templates completos con tests + e2e + verificación monorepo en el mismo ciclo. No hay una cifra de "días reales" comparable de forma directa a la estimación de 2.5-5 días del plan; el dato comparable real es el de la sección 3 (reutilización) y 5-6 (riesgos), no el tiempo de reloj.

## 2. Templates producidos

Los 5 templates planeados, sin ningún recorte de alcance de diseño — **con un ajuste real al agrupamiento del plan, no a los templates en sí**:

| Catálogo | Nombre | Forma | Objetos |
|---|---|---|---|
| 2.5 | Bálsamo Labial Natural | Círculo 20mm | 3 (die-line, sabor, wordmark) |
| 3.2 | Spa & Bienestar | Rectángulo 100×50mm | 3 (nombre, divisoria, subtítulo) |
| 7.1 | Etiqueta Neutral Minimalista | Rectángulo 75×30mm | 3 (wordmark, divisoria, subtítulo) |
| 8.1 | Sello de Cierre | Círculo 25mm | 3 (die-line, borde decorativo, wordmark) |
| 10.3 | Gracias por tu Preferencia | Círculo 35mm | 2 (die-line, texto) |

**Cambio de alcance real**: 13.3 Sello de Regalo Hecho a Mano, incluido originalmente en este lote, se reasignó al Lote 2 al leer su especificación completa (`TEMPLATE_BATCH_09.md`, Template 43) — la entrada corta de `TEMPLATE_CATALOG_v1.md` no mencionaba que el batch completo exige una textura de papel kraft (sección 5, "Assets necesarios"), lo cual rompe la premisa de "cero ilustración/textura" de este lote y encaja exactamente en el perfil ya definido para el Lote 2. Se documenta aquí y se corrigió en `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (Lotes 1 y 2 actualizados) en vez de forzar el template al lote equivocado.

**Otra decisión de traducción documentada**: el batch de Bálsamo Labial (2.5) describe el wordmark de marca "en arco pequeño" sobre el borde inferior — se simplificó a texto recto centrado apilado debajo del sabor, porque el texto curvo (`arrangeRingText`) es una capacidad reservada para el Lote 3, todavía no construida. Es la misma clase de decisión que la partición de color del piloto: documentada, no oculta.

## 3. Componentes reutilizados

Los 5 templates se construyeron exclusivamente con piezas ya existentes de `catalogTemplates/kit/` — **cero líneas de infraestructura nueva**:

- `createCatalogProject` — scaffold completo de Project, las 5 veces.
- `createDieLineObjects` — 3 veces con `shape: "circle"` (2.5, 8.1, 10.3), 2 veces con `shape: "rectangle"` (3.2, 7.1, sin generar ningún objeto, como se espera).
- `createTextObject` — 11 veces en total across los 5 templates.
- `createDividerLine` — 2 veces (3.2, 7.1).
- `createEllipse` — 1 vez, para el borde decorativo concéntrico de 8.1 (uso directo, no a través de `createDieLineObjects`).
- `stackVertically` / `textLineHeight` — 3 veces (2.5, 3.2, 7.1 — los templates con más de un elemento vertical).
- `buildCatalogTemplateDescriptor` — las 5 veces, vía el loop ya genérico de `seedCatalogTemplates`.
- `validateProject` (schema real, no un mock) — en cada test.

## 4. Componentes nuevos creados

**Ninguno.** Confirma la hipótesis central del Lote 1: la infraestructura aprobada en `THOREN_PRODUCTION_INFRASTRUCTURE.md` cubre esta clase de template (cero ilustración, formas estándar) sin fricción, con una muestra 5 veces mayor que el piloto original.

## 5. Riesgos encontrados

- **La entrada corta del catálogo no siempre coincide con el batch completo** (13.3, ver punto 2) — un riesgo real de planeación, no de código: agrupar lotes solo por la entrada de 10 campos de `TEMPLATE_CATALOG_v1.md` puede ubicar mal un template hasta leer su especificación completa de 12 secciones. Mitigación aplicada: leer el batch completo de cada template *antes* de escribir su builder, no solo al momento de diseñar el lote.
- **Tentación de anticipar `arrangeRingText`** al toparse con la descripción "en arco pequeño" de 2.5 — resuelto sin construir la capacidad de forma prematura ni fuera de su lote asignado (regla 2 del plan: ninguna capacidad nueva se construye dos veces, y tampoco antes de que su propio lote la necesite de forma genuina).

## 6. Riesgos eliminados

- **Duda sobre si el kit escala más allá de un solo template**: con 5 templates adicionales construidos sin tocar `kit/`, queda descartado que la extracción de infraestructura del piloto fuera un caso aislado — es reutilizable en producción real, repetidamente.
- **Riesgo de recuento de siembra hardcodeado**: los tests de `builtInTemplates.test.ts`/`catalogTemplates/index.test.ts` que antes fijaban "4" o "1" como conteo esperado se corrigieron para derivar el conteo de `CATALOG_TEMPLATES.length`/`BUILT_IN_STICKER_TEMPLATES.length` — cualquier lote futuro que agregue templates ya no requiere tocar estas aserciones a mano.

## 7. Cobertura de pruebas

- `npx turbo run typecheck` — 23/23 tareas exitosas.
- `npx turbo run test` — 23/23 tareas exitosas; `apps/sticker-builder` pasó de 43 a 48 archivos de test (546 tests, +33 nuevos: 6-8 tests por template).
- `npx vitest run --coverage` (`apps/sticker-builder`) — 4 métricas por encima de los umbrales configurados (90/85/90/90); los 5 archivos nuevos en 100% líneas/statements/funciones.
- `npm run test:e2e` (Playwright, Chromium real, tras `vite build`) — 61/61 escenarios, incluyendo los 5 nuevos del spec parametrizado `template-catalog-lote1.spec.ts` (galería → crear → Capas → guardar → exportar PNG real con firma binaria verificada → exportar SVG real).

## 8. Regresiones detectadas

Ninguna en código de producción. Dos tests preexistentes tenían conteos de siembra hardcodeados (`toHaveLength(1)`, `toHaveLength(4)`) que dejaron de reflejar la realidad al crecer `CATALOG_TEMPLATES` — no son regresiones funcionales, son aserciones de test que necesitaban generalizarse; se corrigieron para derivar el conteo dinámicamente en vez de hardcodearlo de nuevo (ver punto 6).

## 9. Mejoras incorporadas a la infraestructura

Ninguna a `catalogTemplates/kit/` en sí (por diseño, ver punto 4). Sí se corrigió `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`: la reasignación de 13.3 del Lote 1 al Lote 2, con nota de alcance explícita en ambos lotes, para que el plan siga siendo la única fuente de verdad de qué template va en qué lote.

## 10. Recomendaciones para el Lote 2

- Leer la especificación completa (`TEMPLATE_BATCH_XX.md`) de **cada** template antes de confirmar su lote, no solo la entrada corta del catálogo — aplica en particular a 13.3 (ya reasignado) y a cualquier otro template del Lote 2 que pudiera tener una sorpresa similar en su sección 5 (Assets necesarios).
- El Lote 2 introduce el primer "placeholder de logo del comprador" y la primera textura kraft compartida (7.2, 13.3, 14.1) — vale la pena decidir explícitamente, antes de codear el primero, la convención de `metadata.role` para distinguir "placeholder, no es contenido de THÖREN" de un asset real embebido, para que los 3 templates que la usan sean consistentes entre sí desde el primer template, no ajustados después.
- Mantener el mismo patrón de e2e parametrizado (un solo spec, un caso por template) usado aquí — escaló bien a 5 templates sin duplicar cobertura.

---

## Estado

**Lote 1 terminado, probado y listo para aprobación.** No se inicia el Lote 2 hasta recibir esa aprobación.
