> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# THÖREN — Reporte de Producción: Lote 3

**Alcance.** `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` — 4 sellos circulares (3.1 · 6.3 · 10.1 · 12.1), tras la reasignación de 4.2 al Lote 8 (DEC-012). Sigue el formato de reporte de 10 puntos acordado en el Lote 2. Primer lote en activar `THOREN_VISUAL_ACCEPTANCE.md` (creado antes de iniciar este lote).

---

## Validación visual — `arrangeRingText` (aprobada)

Ejecución completa de `THOREN_VISUAL_ACCEPTANCE.md` sobre **3.1 Sello de Cita — Salón de Belleza** (`TEMPLATE_BATCH_03.md`, Template 12), primer template del catálogo en usar `arrangeRingText` (anillo de texto perimetral de 360°). Detalle completo del checklist de 8 puntos en `THOREN_VISUAL_ACCEPTANCE.md` § Historial de ejecuciones → Lote 3.

**Defecto real encontrado y corregido durante la propia verificación**: el ancho de fragmento estimado por defecto en `arrangeRingText` (`content.length * fontSize * 0.65`) era insuficiente — causaba word-wrap invisible en el PNG/canvas ("SALÓN" se recortaba visualmente a "SALÓ", "MARINA" a "MARIN"), aunque el SVG exportado y el `Project` en sí seguían siendo correctos. Corregido subiendo el estimado a `content.length * fontSize` en `kit/ringText.ts`, cubierto por el test unitario correspondiente y reverificado en Chromium.

**Comparación de variantes estéticas** (autorizada por el usuario antes de fijar el patrón definitivo, sin modificar la arquitectura de `arrangeRingText`, solo los parámetros con los que 3.1 la invoca):

| Variante | Cambio | Resultado |
|---|---|---|
| V0 — Base | `fontSize: 8`, `fontWeight: 400` | Punto de partida, aprobado técnicamente pero con margen de mejora estética |
| V1 — Tamaño | `fontSize: 8→11` | Descartada — el anillo se acerca demasiado al peso visual del monograma |
| V2 — Peso | `fontWeight: 400→700` | **Ganadora** — más presencia sin competir con la jerarquía del monograma |
| V3 — Separadores | Fragmentos `"•"` entre los bloques de texto | Descartada — casi imperceptibles a 30mm reales, sin beneficio claro |
| V4 — Espaciado | Monograma 40%→32% del diámetro | Descartada — se aleja de la fidelidad al batch (proporción ~40% especificada) |

**Veredicto final del usuario**: **aprobado** — V2 (peso 700, tamaño y monograma sin cambios, sin separadores) queda como versión definitiva de 3.1 y patrón base para el resto del Lote 3. Registrado como decisión permanente en `THOREN_DECISION_LOG.md` DEC-013: para anillos de texto cortos en sellos de ~30mm, priorizar peso tipográfico sobre tamaño cuando el monograma central deba conservar la jerarquía principal.

**Segundo defecto real, encontrado en 6.3** (no relacionado con `arrangeRingText`): el mismo patrón de word-wrap invisible apareció en un `TextObject` plano y ya validado en lotes anteriores — "Hecho en casa" se recortaba a "Hecho en" con el ancho de caja original (`diameterPx * 0.75`, fontSize 20). Corregido ajustando fontSize (20→16) y ancho (0.75→0.85) para ese template específico, verificado con captura real. Ver punto 5 (riesgos encontrados) — esto generaliza la lección de "verificar visualmente cualquier caja de texto de ancho estimado" más allá de `arrangeRingText`.

---

## 1. Tiempo invertido

Ejecutado en una sola sesión continua de trabajo, igual que los Lotes 1 y 2. El dato comparable real es que este lote requirió, además de la lectura previa de los 5 batches completos, una comparación visual de 4 variantes estéticas reales (renderizadas y exportadas en Chromium) antes de fijar el patrón definitivo de `arrangeRingText` — un paso que los Lotes 1-2 no tuvieron, al no introducir ninguna capacidad visual genuinamente nueva.

## 2. Templates producidos

Los 4 templates del lote ya ajustado (ver DEC-012: 4.2 salió hacia el Lote 8 antes de codear ningún template):

| Catálogo | Nombre | Forma | Objetos | Usa `arrangeRingText` |
|---|---|---|---|---|
| 3.1 | Sello de Cita — Salón de Belleza | Círculo 30mm | 4 (die-line, monograma, 2 fragmentos de anillo) | Sí — primera vez |
| 10.1 | Sello Corporativo | Círculo 30mm | 4 (die-line, monograma, 2 fragmentos de anillo) | Sí — réplica del patrón V2 |
| 6.3 | Sello "Hecho en Casa" | Círculo 35mm | 2 (die-line, texto principal) | No — sin anillo real (DEC-012) |
| 12.1 | Sello de Sobre de Invitación | Círculo 25mm | 2 (die-line, iniciales) | No — sin anillo real (DEC-012) |

**Corrección de caracterización confirmada al codear**: 6.3 y 12.1 resultaron ser sellos de un solo elemento central (texto script + textura de fondo; iniciales entrelazadas, respectivamente), sin ninguna zona perimetral — exactamente como se documentó en el plan antes de iniciar el lote. Se mantuvieron en el Lote 3 porque no introdujeron ningún riesgo nuevo: 6.3 reutiliza el patrón de `fill` de textura (DEC-009) y texto centrado ya validado; 12.1 reutiliza el patrón de texto único centrado (mismo que `closureSeal.ts`, Lote 1), con la única particularidad de que el batch recomienda una fuente itálica que `@impulso/document-schema` no soporta (resuelto usando Parisienne, un script nativo, en vez de simular itálica).

## 3. Componentes reutilizados

- `createCatalogProject` — las 4 veces.
- `createDieLineObjects` — las 4 veces, con `shape: "circle"` y `fill` distinto por template (rosa pálido, blanco, crema, blanco).
- `createTextObject` — 10 veces (2 en 3.1 + 1 monograma, 2 en 10.1 + 1 monograma vía `arrangeRingText` internamente, 1 en 6.3, 1 en 12.1 — más los 4 fragmentos de anillo construidos por `arrangeRingText`, que internamente llama a `createTextObject`).
- `arrangeRingText` — 2 veces (3.1, 10.1), la capacidad nueva de este lote.
- `textLineHeight` — 2 veces (6.3, 12.1), para los templates de texto único centrado.
- `buildCatalogTemplateDescriptor` — las 4 veces.

## 4. Componentes nuevos creados

- `kit/ringText.ts` (`arrangeRingText`, `RingTextFragment`, `ArrangeRingTextOptions`) — la capacidad visual genuinamente nueva del lote, aprobada vía `THOREN_VISUAL_ACCEPTANCE.md` (ver sección de validación visual arriba y DEC-013).
- `createTextObject` (`kit/textObjects.ts`) gana un parámetro opcional `rotation` (default 0, preserva todos los ~15 call sites previos) — extensión pequeña y compatible, mismo patrón que la extensión de `createDieLineObjects` en el Lote 2 (DEC-009).

## 5. Riesgos encontrados

- **Word-wrap invisible en cajas de texto con ancho estimado**: encontrado dos veces en este lote (una vez en `arrangeRingText`, ver arriba; una vez en un `TextObject` plano de 6.3). El síntoma es el mismo en ambos casos — el SVG exportado y el `Project` permanecen correctos, pero el PNG/canvas recorta visualmente el texto que no cupo en la línea, porque `Konva.Text` hace word-wrap dentro de su caja por defecto y el contenido sobrante en la segunda línea queda fuera del área visible esperada. **Esto generaliza más allá de este lote**: cualquier `TextObject` cuyo ancho se estime (en vez de medirse) corre este riesgo — ver recomendación en el punto 10.
- **Ambigüedad de si aplicar el peso 700 de DEC-013 a 10.1**: resuelta explícitamente antes de codear — 10.1 usa una sola familia tipográfica (Inter) para monograma y anillo (a diferencia de 3.1, que usa dos), así que subir el peso del anillo por encima del monograma habría invertido la jerarquía en vez de reforzarla. Se documentó en el propio archivo (`corporateSeal.ts`) por qué DEC-013 no aplica literalmente aquí.
- **Tentación de simular itálica para 12.1** (el batch recomienda "Parisienne o Playfair Display Italic"): resuelta usando Parisienne directamente, evitando depender de un campo de estilo itálico que `@impulso/document-schema` no tiene en `TextObject`.

## 6. Riesgos eliminados

- **Duda sobre si `arrangeRingText` se vería bien en producción real**: eliminada por la ejecución completa de `THOREN_VISUAL_ACCEPTANCE.md` sobre 3.1, con exportaciones PNG/SVG reales revisadas por el usuario, no solo por la suite automatizada.
- **Duda sobre si aplicar DEC-013 mecánicamente a cualquier anillo futuro**: eliminada al confirmar con 10.1 que el criterio depende del contexto (familias tipográficas compartidas vs. distintas), no es una regla ciega de "siempre sube el peso a 700".

## 7. Cobertura de pruebas

- `npx turbo run typecheck` — 23/23 tareas exitosas.
- `npx turbo run test` — 23/23 tareas exitosas; `apps/sticker-builder` pasó de 580 a 610 tests (+30: 32 tests de los 4 templates nuevos + 5 de `kit/ringText.test.ts`, neto tras ajustes de tests existentes por el crecimiento de `CATALOG_TEMPLATES`).
- `npx vitest run --coverage` (`apps/sticker-builder`) — 98.02% líneas / 89.86% branches / 93.45% funciones, sobre el umbral (90/85/90/90).
- `npm run test:e2e` (Playwright, Chromium real) — 70/70 escenarios, incluyendo los 4 nuevos de `template-catalog-lote3.spec.ts` (con captura de canvas real para la revisión de `THOREN_VISUAL_ACCEPTANCE.md`).

## 8. Regresiones detectadas

Ninguna. Los 70 escenarios e2e de toda la suite (no solo los nuevos) pasaron sin ajustes, incluyendo los de los Lotes 1 y 2, el piloto, y todos los flujos de exportación/impresión/multi-selección/autosave ya existentes.

## 9. Mejoras incorporadas a la infraestructura

- `kit/ringText.ts`: nuevo módulo, `arrangeRingText` (ver sección 4).
- `kit/textObjects.ts`: `rotation` opcional en `createTextObject`.
- `THOREN_VISUAL_ACCEPTANCE.md`: primera ejecución real registrada (§ Historial de ejecuciones).
- `THOREN_DECISION_LOG.md`: DEC-012 (reasignación de 4.2) y DEC-013 (peso sobre tamaño en anillos cortos).
- `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`: ya actualizado antes de codear (nota de alcance del Lote 3, corrección de caracterización de 6.3/12.1).

## 10. Recomendaciones para el Lote 4

- **Verificar visualmente (captura real en Chromium) cualquier `TextObject` cuyo ancho no se mida sino se estime** — el defecto de word-wrap invisible apareció dos veces en este lote de formas independientes (anillo y texto plano); vale la pena adoptarlo como paso rutinario antes de dar por bueno cualquier template nuevo, no solo los que activan `THOREN_VISUAL_ACCEPTANCE.md`.
- El Lote 4 introduce la primera integración real de ilustración (`@impulso/asset-library`) — activará `THOREN_VISUAL_ACCEPTANCE.md` de nuevo, esta vez con un riesgo visual distinto (calidad/escala de imágenes reales, no solo tipografía).
- Con el Lote 3 cerrado, se completan los Lotes 1-3 — corresponde definir el alcance detallado de la Beta Comercial (DEC-006) como su propio entregable antes de iniciar el Lote 4, según lo ya anotado en el plan maestro.

---

## Estado

**Lote 3 terminado, probado y listo para aprobación.** No se inicia el Lote 4 hasta recibir esa aprobación — y, según DEC-006, el Lote 4 además queda condicionado a definir y ejecutar el punto de control de Beta Comercial primero.
