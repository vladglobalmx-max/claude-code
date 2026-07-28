# THÖREN — Reporte de Producción: Lote 2

**Alcance.** Cierra el Lote 2 (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`) — 5 templates "cero ilustración, con marco/textura/logo". Sigue el formato de reporte de 10 puntos acordado, y es el primer lote que también actualiza `THOREN_DECISION_LOG.md`, práctica agregada al aprobar este lote.

## 1. Tiempo invertido

Ejecutado en una sola sesión continua de trabajo, igual que el Lote 1 — no comparable en jornadas de calendario contra la estimación de 2.5-5 días del plan. El dato comparable real es que este lote requirió más lectura previa que el Lote 1 (6 batches completos leídos antes de codear cualquier template, incluyendo dos que resultaron mal ubicados) antes de tocar código.

## 2. Templates producidos

Los 5 templates del lote ya ajustado (ver punto de partida: DEC-005 sacó 13.3 del Lote 1 hacia aquí; DEC-010, tomado al iniciar este lote, sacó 12.4 de aquí hacia el Lote 10):

| Catálogo | Nombre | Forma | Objetos |
|---|---|---|---|
| 7.2 | Etiqueta Kraft Genérica | Círculo 45mm (fill kraft) | 4 (die-line, wordmark, subtítulo, sello decorativo) |
| 7.3 | Etiqueta Corporativa Simple | Cuadrado 40mm | 2 (nombre de empresa, datos de contacto) |
| 13.3 | Sello de Regalo Hecho a Mano | Círculo 35mm (fill kraft) | 3 (die-line, texto fijo, campo de nombre) |
| 14.1 | Kraft Hecho a Mano | Círculo 45mm (fill kraft) | 2 (die-line, nombre de tienda) |
| 14.3 | Empaque Artesanal Etsy | Cuadrado 40mm | 2 (placeholder de logo, línea de agradecimiento) |

**Segundo cambio de alcance real, detectado antes de codear (DEC-010)**: 12.4 Mesa de Dulces, que este plan ya había asignado a este lote, se reasignó al Lote 10 al leer su especificación completa (`TEMPLATE_BATCH_08.md`, Template 39) — requiere una pestaña de plegado en la base (troquel no estándar + línea de doblez), la misma clase de problema ya reservada para 2.3 Jabón Artesanal en Barra. Se corrigió en el plan antes de producir ningún template del lote, no después.

## 3. Componentes reutilizados

- `createCatalogProject` — las 5 veces.
- `createDieLineObjects` — 3 veces con `shape: "circle"` y `fill` kraft (7.2, 13.3, 14.1), y con el `fill`/`stroke` por defecto sin usar en ningún template de este lote (los 2 cuadrados no llaman a la función con efecto, ya que `shape: "square"` siempre devuelve `[]`).
- `createTextObject` — 9 veces.
- `createRectangle` — 1 vez, para el placeholder de logo de 14.3 (uso directo, sin relleno).
- `createEllipse` — 1 vez, para el sello decorativo de 7.2 (mismo patrón que el borde de `closureSeal.ts` del Lote 1).
- `stackVertically`/`textLineHeight` — 2 veces (7.2, 13.3); los 2 templates de retícula fija 66/34 (7.3, 14.3) se posicionan con aritmética directa, no con `stackVertically` (ver punto 9).
- `buildCatalogTemplateDescriptor` — las 5 veces.

## 4. Componentes nuevos creados

Uno solo, y es una extensión, no una pieza nueva: `createDieLineObjects` gana parámetros opcionales `fill`/`stroke`/`strokeWidth` (default preservado) — ver DEC-009 en `THOREN_DECISION_LOG.md`. Ningún otro archivo de `kit/` cambió.

## 5. Riesgos encontrados

- **Segunda sorpresa de "entrada corta del catálogo vs. batch completo"** (12.4, DEC-010) — confirma que el riesgo detectado en el Lote 1 (DEC-005) no era un caso aislado; refuerza que **todo** lote debe leer sus batches completos antes de confirmarse, no solo el primero de la serie.
- **Tentación de resolver la textura kraft con una imagen real** — el batch de 7.2 literalmente incluye un prompt de IA para generar la textura, lo que podría leerse como "hazlo ahora". Se resistió deliberadamente (DEC-009) para no adelantar la integración de `@impulso/asset-library` fuera de su lote asignado (Lote 4).
- **Ambigüedad de a qué elemento aplicar el acento** en templates con un solo acento de color pero sin una jerarquía de datos tan clara como el Serum (13.3, 14.3) — resuelta caso por caso, documentada en cada archivo de template (comentario) en vez de dejarla implícita.

## 6. Riesgos eliminados

- **Duda sobre si el patrón de reasignación de templates (DEC-005) era un caso único**: con una segunda reasignación real (DEC-010) detectada con el mismo método (leer el batch completo antes de codear), el proceso de verificación queda confirmado como práctica repetible, no como una corrección puntual.
- **Riesgo de romper consumidores existentes al extender `createDieLineObjects`**: mitigado por diseño (parámetros opcionales con default idéntico al comportamiento anterior) y confirmado por los 6 tests existentes de `dieLine.test.ts` pasando sin modificación, más 2 tests nuevos para el caso explícito con override.

## 7. Cobertura de pruebas

- `npx turbo run typecheck` — 23/23 tareas exitosas.
- `npx turbo run test` — 23/23 tareas exitosas; `apps/sticker-builder` pasó de 48 a 53 archivos de test (580 tests, +34: 32 de los 5 templates nuevos + 2 de la extensión de `createDieLineObjects`).
- `npx vitest run --coverage` (`apps/sticker-builder`) — umbrales cumplidos (90/85/90/90), sin ninguna caída frente al Lote 1.
- `npm run test:e2e` (Playwright, Chromium real) — 66/66 escenarios, incluyendo los 5 nuevos de `template-catalog-lote2.spec.ts`.

## 8. Regresiones detectadas

Ninguna. Los tests preexistentes de `builtInTemplates.test.ts`/`catalogTemplates/index.test.ts` (ya generalizados en el Lote 1 para derivar el conteo de `CATALOG_TEMPLATES.length`) pasaron sin ningún ajuste adicional al crecer de 6 a 11 entradas — confirma que la recomendación del reporte del Lote 1 (mantener ese patrón) ya rindió su beneficio esperado.

## 9. Mejoras incorporadas a la infraestructura

- `kit/dieLine.ts`: `fill`/`stroke`/`strokeWidth` opcionales en `createDieLineObjects` (documentado en `THOREN_PRODUCTION_INFRASTRUCTURE.md`, sección "Actualización — Lote 2").
- `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`: reasignación de 12.4 (Lote 2 → Lote 10), con nota de alcance en ambos lotes.
- `THOREN_DECISION_LOG.md`: dos entradas nuevas, DEC-009 y DEC-010.

## 10. Recomendaciones para el Lote 3

- Antes de iniciar el Lote 3 (sellos con anillo de texto), revisar si algún patrón de retícula fija (como el 66/34 de 7.3/14.3, resuelto con aritmética directa en vez de `stackVertically`) se repite lo suficiente en lotes futuros como para justificar un helper de "retícula de franjas fijas" — todavía no se promovió a `kit/` porque solo 2 templates lo usan hasta ahora (regla de "una capacidad nueva se agrega solo cuando resuelve una necesidad real del sistema").
- El Lote 3 introduce `arrangeRingText`, la primera capacidad genuinamente nueva desde el piloto — dado que 2.5 (Lote 1) ya quedó documentado como candidato a revisión opcional una vez que exista, vale la pena decidir explícitamente, al aprobar el Lote 3, si esa revisión se hace de inmediato o se pospone a una pasada de consolidación posterior.
- Seguir leyendo la especificación completa de cada template antes de confirmar su lote — el patrón de detección temprana (DEC-005, DEC-010) sigue funcionando y debe mantenerse para los 10 lotes restantes.

---

## Estado

**Lote 2 terminado, probado y listo para aprobación.** No se inicia el Lote 3 hasta recibir esa aprobación.
