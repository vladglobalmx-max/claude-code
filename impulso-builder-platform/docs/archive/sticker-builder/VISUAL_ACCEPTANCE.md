> **Documento archivado y fusionado (Consolidación documental THÖREN, 2026-07-31).** Su checklist de aceptación visual ya está resumido en [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) §7 — este documento se conserva íntegro (incluida la ejecución real registrada sobre `arrangeRingText`) como el detalle exhaustivo original, no como fuente activa de trabajo diario.

# THÖREN Visual Acceptance Checklist v1.0

**Propósito.** Guía oficial para aprobar cualquier **capacidad visual nueva** del sistema — la validación humana que complementa, no reemplaza, la suite automatizada (`validateCatalogProject`, tests unitarios, e2e de Playwright). Los tests automatizados confirman que un `Project` es estructuralmente correcto y que el flujo (crear/editar/guardar/exportar) funciona; este checklist confirma que el resultado **se ve bien** — algo que ningún test automatizado puede evaluar por sí solo.

**Cuándo se usa — regla de activación.** Este checklist se ejecuta **únicamente** cuando un lote introduce una capacidad visual genuinamente nueva (una que ningún lote anterior ya validó), no en cada template producido. Ejemplos de qué activa el checklist: un nuevo generador de layout (`arrangeRingText`, Lote 3), la primera integración real de ilustración (Lote 4), un nuevo generador de troquel personalizado (Lotes 9-10), un patrón repetible (`tileMotif`, Lote 12). Ejemplos de qué **no** lo activa: producir un template más con componentes de `kit/` ya validados visualmente en un lote anterior (ej. el resto de los templates "cero ilustración" de los Lotes 1-2, una vez que el primero de cada patrón ya pasó este checklist). La responsabilidad de decidir si un lote activa el checklist es de quien produce el lote, documentada explícitamente en su reporte de producción (punto 5, "riesgos encontrados", o punto 9, "mejoras incorporadas").

**Quién lo aprueba.** Es una revisión humana — el usuario, o quien el usuario delegue explícitamente — no un paso que Claude pueda auto-aprobarse. Cuando un lote activa el checklist, el resultado (aprobado / aprobado con observaciones / rechazado) se registra en el reporte de producción del lote y, si la revisión revela una decisión permanente (ej. "esta aproximación de X siempre se hará así"), se agrega también a `THOREN_DECISION_LOG.md`.

---

## Cómo ejecutarlo

1. Producir al menos **un** template real que use la capacidad nueva (no hace falta esperar a que todo el lote esté terminado — de hecho, conviene ejecutar el checklist sobre el primer template antes de replicar el patrón al resto, mismo criterio ya usado en el mini-piloto del Lote 4 dentro de `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`).
2. Abrir el template real en el editor (Chromium, no una captura estática) y generar sus exportaciones PNG y SVG reales — nunca aprobar sobre una descripción o un mockup, siempre sobre el artefacto real que un comprador recibiría.
3. Revisar cada punto de la lista de verificación (sección siguiente) contra ese template real.
4. Registrar el resultado en el reporte de producción del lote correspondiente.

## Lista de verificación (mínimo obligatorio)

### 1. Legibilidad
- ¿El texto se lee con claridad al tamaño físico real de impresión (no solo ampliado en pantalla)?
- ¿El contraste entre texto y fondo es suficiente en cada color/variante sugerida del template?
- Si la capacidad nueva afecta la forma del texto (ej. texto curvo/en arco, texto partido en dos colores), ¿la legibilidad se mantiene igual de bien que con texto recto simple, o se sacrifica claridad por estilo?

### 2. Balance visual
- ¿La composición se siente intencional, no accidental — nada se ve "flotando" sin relación con el resto?
- ¿El elemento introducido por la capacidad nueva (ej. un anillo de texto, una ilustración, un troquel personalizado) tiene el peso visual correcto frente al resto de la jerarquía del template (ni domina de más, ni se pierde)?

### 3. Espaciado
- ¿Se respeta el sangrado (3mm) y el área segura documentados para el template?
- ¿El margen de aire alrededor del contenido es coherente con la familia de lenguaje visual del template (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.3 — Lujo Silencioso exige más aire que Audaz Gráfico, por ejemplo)?
- ¿Ningún elemento de la capacidad nueva invade el área segura o se recorta contra el borde del troquel?

### 4. Consistencia con el Design Language
- ¿El template resultante se siente de la misma familia de lenguaje visual (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) que otros templates ya aprobados de esa familia?
- ¿La capacidad nueva respeta las reglas ya congeladas del sistema (3 colores + 1 acento variable, máximo 1 tipografía "de carácter" + 1 "de apoyo", un ícono/ilustración protagonista como máximo)?
- ¿Se evitó el error más común señalado repetidamente en los batches ("agregar algo de más")?

### 5. Calidad de exportación PNG
- ¿El PNG exportado (real, generado por `@impulso/export-engine`, no una captura de pantalla del editor) reproduce fielmente lo que se ve en el editor?
- ¿La rasterización se ve nítida a la resolución de exportación estándar, sin artefactos, bordes dentados perceptibles a tamaño real, o pérdida de detalle en la capacidad nueva específicamente?

### 6. Calidad de exportación SVG
- ¿El SVG exportado (real, vía `buildSvgDocument`) contiene el contenido esperado y es válido (se abre correctamente en un visor/editor SVG estándar)?
- Si la capacidad nueva introduce geometría nueva (`PathObject`, texto rotado, patrones repetidos), ¿el SVG la representa correctamente como vectores editables, no como una aproximación rasterizada?

### 7. Escalabilidad
- ¿El template se ve igual de bien a su tamaño físico real (frecuentemente pequeño — 20-45mm en este catálogo) y ampliado (ej. a tamaño de thumbnail de card, o impreso a mayor escala si el producto lo permite)?
- ¿La capacidad nueva sigue funcionando en los tamaños límite del catálogo (el formato más pequeño y el más grande que la usen), no solo en el caso de prueba elegido?

### 8. Fidelidad respecto a la especificación del batch
- ¿El resultado cumple lo que el batch (`TEMPLATE_BATCH_XX.md`) describe en Dirección de Arte y Layout, incluyendo cualquier simplificación ya documentada explícitamente (ver `THOREN_DECISION_LOG.md`)?
- Si hubo una decisión de simplificación o aproximación (ej. DEC-004, DEC-009), ¿el resultado sigue siendo reconocible como "lo que el batch pedía", no una desviación no documentada?
- ¿Se validó contra el criterio de comparación que el propio batch sugiere cuando existe (ej. "debe sentirse de la misma familia que el Template X")?

---

## Registro de resultados

Cada ejecución de este checklist se registra en el reporte de producción del lote que la activó, con al menos:

- **Lote y capacidad nueva evaluada.**
- **Template(s) real(es) usado(s) para la revisión** (con sus exportaciones PNG/SVG reales generadas para la ocasión).
- **Resultado por punto** (1-8) — aprobado / aprobado con observaciones / rechazado, con una nota breve cuando no sea "aprobado" sin más.
- **Veredicto final**: aprobado (se puede replicar la capacidad al resto del lote) / aprobado con ajustes (se replica después de aplicar una corrección puntual) / rechazado (la capacidad requiere rediseño antes de continuar).

## Historial de ejecuciones

### Lote 3 — `arrangeRingText` (anillo de texto perimetral de 360°)

- **Template(s) real(es) usado(s)**: 3.1 Sello de Cita — Salón de Belleza (`TEMPLATE_BATCH_03.md`, Template 12), exportado en PNG y SVG reales desde Chromium (canvas del editor + exportaciones descargadas vía el diálogo de exportación).
- **Resultado por punto**:
  1. **Legibilidad** — aprobado con ajustes → la primera exportación reveló un defecto real (ancho de fragmento insuficiente causando word-wrap invisible: "SALÓN" se recortaba a "SALÓ", "MARINA" a "MARIN" en el PNG/canvas, aunque el SVG y el `Project` seguían siendo correctos); corregido en el estimado por defecto de `arrangeRingText` (ver `kit/ringText.ts`) y reverificado.
  2. **Balance visual** — aprobado con ajustes → la comparación de 4 variantes estéticas determinó que aumentar el peso tipográfico del anillo (`fontWeight` 400→700) da el balance correcto frente al monograma; ver DEC-013.
  3. **Espaciado** — aprobado → respeta sangrado y área segura (3mm); el radio del anillo no toca el troquel.
  4. **Consistencia con Design Language** — aprobado.
  5. **Calidad de exportación PNG** — aprobado (tras la corrección del punto 1).
  6. **Calidad de exportación SVG** — aprobado — el SVG fue correcto en todo momento, incluso durante el defecto del punto 1.
  7. **Escalabilidad** — aprobado.
  8. **Fidelidad respecto a la especificación del batch** — aprobado — monograma en su proporción ~40% del diámetro (sin reducir, ver DEC-013), anillo de 360° con el nombre completo del salón.
- **Veredicto final**: **aprobado** — la capacidad `arrangeRingText` queda aprobada como patrón base para el resto del Lote 3 (10.1 Sello Corporativo) y para futuros lotes con anillos de texto perimetral. Ver DEC-013 (decisión permanente de dirección de arte derivada de esta ejecución) y `THOREN_LOTE_03_REPORTE.md` para el detalle completo de la comparación de variantes.

## Estado

**Checklist aprobado, vigente a partir del Lote 3.** Se activa la primera vez en el Lote 3 (`arrangeRingText`) — ejecución completa y aprobada sobre 3.1, ver "Historial de ejecuciones" arriba — y en cada lote posterior que introduzca una capacidad visual genuinamente nueva.
