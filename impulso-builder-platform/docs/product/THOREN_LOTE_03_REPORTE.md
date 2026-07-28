# THÖREN — Reporte de Producción: Lote 3

**Alcance.** `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` — 4 sellos circulares (3.1 · 6.3 · 10.1 · 12.1), tras la reasignación de 4.2 al Lote 8 (DEC-012). Sigue el formato de reporte de 10 puntos acordado en el Lote 2.

**Estado actual: EN PROGRESO.** Este documento se abre ahora porque el usuario solicitó registrar la aprobación de la capacidad visual `arrangeRingText` (primera capacidad genuinamente nueva desde el piloto) tan pronto como ocurrió, en vez de esperar al cierre del lote. Las 10 secciones completas se llenan cuando el lote termine (3.1, 6.3, 10.1 y 12.1 producidos, probados y verificados).

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

**Templates producidos hasta ahora**: 3.1 Sello de Cita — Salón de Belleza (die-line + monograma + anillo de 2 fragmentos, peso 700), con test unitario propio (7 tests) y cubierto por `template-catalog-lote3.spec.ts` (Chromium real, galería → crear → Capas → guardar → exportar PNG y SVG).

---

*Las secciones 1-10 (tiempo invertido, templates producidos, componentes reutilizados/nuevos, riesgos, cobertura de pruebas, regresiones, mejoras a infraestructura, recomendaciones) se completan al cerrar el Lote 3, junto con 6.3, 10.1 y 12.1.*
