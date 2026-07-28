# THÖREN Decision Log

**Propósito.** Memoria técnica oficial y acumulativa del proyecto — registra toda decisión permanente de arquitectura, interpretación del catálogo o cambio de criterio que pueda afectar la producción futura. Se actualiza en cada lote, a partir del Lote 2 (aprobado junto con esta práctica), con entradas retroactivas para las decisiones ya tomadas durante el Piloto, la Infraestructura de Producción, el Plan Maestro y el Lote 1 — de modo que este documento sea la fuente única desde el inicio del proyecto, no solo desde el momento en que se creó.

**Cómo usarlo**: antes de tomar una decisión de interpretación o de arquitectura en cualquier lote, revisar este log para no contradecir un precedente ya establecido. Cada entrada nueva se agrega al final, nunca se reescribe una entrada pasada — si una decisión posterior cambia una anterior, se registra como una entrada nueva que referencia a la que reemplaza.

## Índice

| ID | Fecha | Lote/Template | Decisión (resumen) |
|---|---|---|---|
| DEC-001 | 2026-07-28 | Piloto (2.1) | Poppins en vez de Century Gothic (licencia libre) |
| DEC-002 | 2026-07-28 | Piloto (2.1) | Partición de dato de dos colores en dos `TextObject`s |
| DEC-003 | 2026-07-28 | Infraestructura | El kit vive en `catalogTemplates/kit/` (app-level), no en un paquete nuevo |
| DEC-004 | 2026-07-28 | Lote 1 (2.5) | Wordmark "en arco" simplificado a texto recto apilado |
| DEC-005 | 2026-07-28 | Lote 1 → Lote 2 (13.3) | Reasignación por textura kraft no visible en la entrada corta del catálogo |
| DEC-006 | 2026-07-28 | Plan maestro | Punto de control de Beta Comercial tras los Lotes 1-3 |
| DEC-007 | 2026-07-28 | Plan maestro | Reporte de producción obligatorio de 10 puntos por lote |
| DEC-008 | 2026-07-28 | Plan maestro | Creación de este Decision Log como práctica permanente |
| DEC-009 | 2026-07-28 | Lote 2 (7.2, 13.3, 14.1) | Textura kraft aproximada como `fill` del die-line, no como imagen tileable real |
| DEC-010 | 2026-07-28 | Lote 2 → Lote 10 (12.4) | Reasignación por pestaña de plegado (troquel no estándar) |

---

## DEC-001 — Poppins en vez de Century Gothic en el Template Piloto

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Piloto Oficial — Serum Facial Premium (catálogo 2.1, `TEMPLATE_BATCH_02.md`)
- **Decisión tomada**: Usar Poppins (Google Fonts, licencia libre) en vez de Century Gothic (comercial, Monotype) como tipografía del template.
- **Justificación**: Century Gothic requiere licencia comercial para distribución; el propio batch ya proponía Poppins como alternativa libre equivalente en disciplina tipográfica ("si se requiere licencia libre, Poppins").
- **Alternativas consideradas**: (a) Usar Century Gothic y adquirir licencia — rechazada por costo/complejidad de licenciamiento en un producto digital distribuido; (b) usar otra geométrica libre no listada en el batch — rechazada porque el batch ya resolvía esta decisión explícitamente.
- **Impacto**: Establece el criterio de "preferir siempre la alternativa libre ya propuesta en el batch cuando la tipografía primaria es comercial", aplicable sin volver a pedir aprobación.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — `THOREN_PILOT_TEMPLATE_STANDARD.md` §6.
- **¿Aplica a futuros templates?**: Sí — cualquier template cuyo batch recomiende una tipografía comercial con alternativa libre explícita se resuelve igual.

## DEC-002 — Partición de un dato de dos colores en dos `TextObject`s independientes

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Piloto Oficial — Serum Facial Premium (catálogo 2.1)
- **Decisión tomada**: Representar "15%/30ml" (una sola línea visual, dos colores) como dos `TextObject`s adyacentes (`textAlign` opuestos, alineados al centro), no como un solo objeto.
- **Justificación**: `Style.fill` es un color por objeto en `@impulso/document-schema` — no existe forma de colorear parte de un string distinta a otra dentro del mismo `TextObject`.
- **Alternativas consideradas**: (a) Forzar un solo color de compromiso para toda la línea — rechazada, pierde el acento cobre exigido por el batch; (b) extender `Style` para soportar rangos de color dentro de un texto — rechazada, cambio de schema desproporcionado para resolver un solo template.
- **Impacto**: Se generalizó como `createSplitAccentLine` en `catalogTemplates/kit/textObjects.ts` — cualquier template futuro con un dato de dos colores en una línea lo reutiliza directamente, sin rederivar la geometría.
- **¿Modifica infraestructura?**: Sí — `kit/textObjects.ts` (`createSplitAccentLine`).
- **¿Modifica documentación?**: Sí — `THOREN_PRODUCTION_INFRASTRUCTURE.md`.
- **¿Aplica a futuros templates?**: Sí.

## DEC-003 — La infraestructura de producción vive en `catalogTemplates/kit/`, no en un paquete nuevo del monorepo

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Infraestructura de Producción (post-piloto, previo al Lote 1)
- **Decisión tomada**: Toda la lógica reutilizable de producción de templates de catálogo vive en `apps/sticker-builder/src/catalogTemplates/kit/`, no en un `packages/*` nuevo.
- **Justificación**: Es tooling específico de cómo Sticker Builder construye templates de su propio catálogo de contenido (troqueles, layouts de sticker) — del mismo nivel que `projectPresets.ts`, ya existente en la app — no una capacidad de plataforma que otro módulo futuro (ej. un hipotético Planner Builder) fuera a reusar tal cual.
- **Alternativas consideradas**: Extraer un `packages/template-production-kit` — rechazada por prematura, sin un segundo consumidor real que la justifique.
- **Impacto**: Evita una abstracción de paquete prematura. Si en el futuro otro módulo necesita la misma infraestructura, se evaluará extraerla entonces, con evidencia real de reuso cross-módulo — no antes.
- **¿Modifica infraestructura?**: N/A — es la decisión fundacional de dónde vive.
- **¿Modifica documentación?**: Sí — `THOREN_PRODUCTION_INFRASTRUCTURE.md`.
- **¿Aplica a futuros templates?**: Sí — todo componente nuevo de cualquier lote futuro se agrega a este mismo `kit/`, nunca a un paquete paralelo.

## DEC-004 — Wordmark "en arco pequeño" simplificado a texto recto apilado (Bálsamo Labial Natural)

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 1 — 2.5 Bálsamo Labial Natural (`TEMPLATE_BATCH_03.md`)
- **Decisión tomada**: Renderizar el wordmark de marca como texto recto centrado, apilado debajo del sabor — no como el "arco pequeño sobre el borde inferior" que describe el batch.
- **Justificación**: El texto curvo (`arrangeRingText`) es una capacidad reservada explícitamente para el Lote 3 (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`), todavía no construida en el momento de producir este template.
- **Alternativas consideradas**: (a) Adelantar la construcción de `arrangeRingText` dentro del Lote 1 — rechazada, viola la regla de "una capacidad nueva se construye una sola vez, en su lote asignado"; (b) aproximar el arco con un `PathObject` a mano solo para este template — rechazada, duplicaría lógica ya planeada como componente reutilizable del Lote 3.
- **Impacto**: Cuando el Lote 3 construya `arrangeRingText`, este template es candidato a una revisión opcional para adoptarlo — no bloquea su aprobación actual como está.
- **¿Modifica infraestructura?**: No (por ahora).
- **¿Modifica documentación?**: Sí — `THOREN_LOTE_01_REPORTE.md`.
- **¿Aplica a futuros templates?**: Sí — cualquier template cuyo batch describa texto curvo/en arco antes de que el Lote 3 esté terminado recibe el mismo tratamiento (simplificación documentada, nunca anticipación de la capacidad).

## DEC-005 — Reasignación de 13.3 Sello de Regalo Hecho a Mano del Lote 1 al Lote 2

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 1 → Lote 2 — 13.3 Sello de Regalo Hecho a Mano (`TEMPLATE_BATCH_09.md`)
- **Decisión tomada**: Mover 13.3 del Lote 1 (cero ilustración) al Lote 2 (cero ilustración, con marco/textura/logo).
- **Justificación**: Su especificación completa exige una textura de papel kraft (sección 5, "Assets necesarios") — no visible en la entrada corta de `TEMPLATE_CATALOG_v1.md` usada originalmente para armar el plan. Rompe la premisa de "cero textura" del Lote 1 y encaja exactamente en el perfil ya definido del Lote 2.
- **Alternativas consideradas**: (a) Producir 13.3 sin la textura kraft, contradiciendo su propio batch — rechazada, viola la regla de "sin excepciones al estándar ya establecido"; (b) mantenerlo en el Lote 1 y tratar la textura como excepción puntual — rechazada, crearía una implementación paralela e inconsistente.
- **Impacto**: Establece el criterio permanente de leer siempre la especificación completa del batch antes de confirmar el lote de un template, no solo su entrada corta del catálogo.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (Lotes 1 y 2).
- **¿Aplica a futuros templates?**: Sí — criterio de verificación aplicable a todos los lotes restantes.

## DEC-006 — Punto de control de Beta Comercial tras los Lotes 1-3

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Plan Maestro de Producción (aplica al cierre del Lote 3)
- **Decisión tomada**: Pausar la producción del catálogo tras completar y aprobar los Lotes 1, 2 y 3 (16 templates) para ejecutar una Beta Comercial antes de continuar con el Lote 4.
- **Justificación**: Validar con usuarios reales — publicar los primeros templates, medir uso y fricción, detectar qué familias generan más interés — antes de invertir en las capacidades más costosas del plan (ilustración, troqueles personalizados).
- **Alternativas consideradas**: Producir los 63 templates completos antes de cualquier validación de mercado — rechazada explícitamente por el usuario al aprobar el plan maestro.
- **Impacto**: La Beta Comercial puede reordenar la **prioridad** de los Lotes 4-12 según señal de mercado real; no puede alterar la arquitectura ni la infraestructura ya aprobadas.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`.
- **¿Aplica a futuros templates?**: Sí — es un punto de control del plan completo, no de un template individual.

## DEC-007 — Reporte de producción obligatorio de 10 puntos por lote

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Plan Maestro de Producción (aplica a los 12 lotes)
- **Decisión tomada**: Cada uno de los 12 lotes entrega un reporte de 10 puntos (tiempo invertido, templates producidos, componentes reutilizados/nuevos, riesgos encontrados/eliminados, cobertura de pruebas, regresiones, mejoras de infraestructura, recomendaciones) antes de que se apruebe el siguiente lote.
- **Justificación**: Mantener trazabilidad real de avance, riesgo y aprendizaje entre lotes — no solo la entrega de código.
- **Alternativas consideradas**: Reporte informal solo en la conversación, sin documento persistente — rechazada por el usuario, que pidió explícitamente un artefacto por lote.
- **Impacto**: Costo fijo de documentación por lote, a cambio de trazabilidad histórica completa y comparable entre lotes.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — un `THOREN_LOTE_NN_REPORTE.md` nuevo por cada lote.
- **¿Aplica a futuros templates?**: Sí — aplica a los 12 lotes, sin excepción.

## DEC-008 — Creación de este Decision Log como práctica permanente

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Plan Maestro de Producción (vigente a partir del Lote 2)
- **Decisión tomada**: Mantener `THOREN_DECISION_LOG.md` como registro acumulativo de toda decisión permanente de arquitectura, interpretación del catálogo o cambio de criterio.
- **Justificación**: Ninguno de los documentos existentes (estándar del piloto, infraestructura, plan maestro, reportes de lote) consolida las decisiones en un solo lugar cronológico y buscable — se necesita una sola memoria técnica oficial para no perder ni contradecir precedentes al producir los 62 templates restantes.
- **Alternativas consideradas**: Dejar las decisiones dispersas en cada documento de lote/reporte — rechazada por el usuario, dificulta encontrar precedentes al producir templates futuros.
- **Impacto**: Antes de tomar una decisión de interpretación en un lote futuro, se debe consultar este log para no contradecir un precedente ya establecido.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — crea este documento.
- **¿Aplica a futuros templates?**: Sí — se actualiza en cada lote a partir de ahora.

## DEC-009 — Textura kraft aproximada como `fill` del die-line, no como imagen tileable real

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 2 — 7.2 Etiqueta Kraft Genérica, 13.3 Sello de Regalo Hecho a Mano, 14.1 Kraft Hecho a Mano (los 3 templates que especifican "textura de papel kraft" en su sección 5, Assets necesarios)
- **Decisión tomada**: Extender `createDieLineObjects` (`catalogTemplates/kit/dieLine.ts`) con parámetros opcionales `fill`/`stroke`/`strokeWidth` (default preservado: `"#ffffff"`/`"#cccccc"`/0.5, igual que antes) y usar un `fill` color sólido en tono kraft crema (`#F5EFE3`) para estos 3 templates, en vez de una imagen de textura tileable real vía `@impulso/asset-library`.
- **Justificación**: El die-line circular de un sticker plano ES su superficie visible — tintar su relleno resuelve la sensación de "fondo kraft" sin necesitar todavía una imagen real. La integración real de assets vía `@impulso/asset-library` está deliberadamente aislada al Lote 4, con su propio mini-piloto de validación (primera vez que un template de catálogo tocaría esa integración) — introducirla aquí, en un lote que se planeó explícitamente como "sin ilustración real", violaría la regla de "una capacidad nueva se construye una sola vez, en su lote asignado" (mismo principio que DEC-004).
- **Alternativas consideradas**: (a) Adelantar la integración real de textura tileable vía asset-library — rechazada, adelanta sin su propia validación dedicada la capacidad de mayor riesgo nuevo del plan (Lote 4); (b) dejar el die-line en blanco/blanco puro y describir la calidez solo en el mockup — rechazada, pierde la señal visual "kraft" dentro del propio editor, que sí es razonable transmitir con un simple color.
- **Impacto**: Establece que "textura" en la fase actual del catálogo puede resolverse, cuando el batch lo permite, como una aproximación de color sólido — no todo lo que el batch llama "textura" requiere una imagen real; se evalúa caso por caso si el batch exige detalle visual (patrón, fibra visible) que un color plano no puede aproximar razonablemente.
- **¿Modifica infraestructura?**: Sí — `kit/dieLine.ts` (`createDieLineObjects` acepta `fill`/`stroke`/`strokeWidth` opcionales).
- **¿Modifica documentación?**: Sí — `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (Lote 2), `THOREN_PRODUCTION_INFRASTRUCTURE.md` (pendiente de actualizar en el reporte del Lote 2).
- **¿Aplica a futuros templates?**: Sí — cualquier template futuro con "textura" en su batch debe evaluarse contra este mismo criterio (aproximación de color vs. necesidad real de imagen) antes de asumir que requiere `@impulso/asset-library`.

## DEC-010 — Reasignación de 12.4 Mesa de Dulces del Lote 2 al Lote 10

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 2 → Lote 10 — 12.4 Mesa de Dulces (`TEMPLATE_BATCH_08.md`, Template 39)
- **Decisión tomada**: Mover 12.4 del Lote 2 (cero ilustración, con marco/textura/logo) al Lote 10 (troqueles personalizados irregulares/compuestos).
- **Justificación**: Su especificación completa exige una pestaña de plegado en la base para que la tarjeta se sostenga de pie — un troquel que ya no es un rectángulo estándar (requiere una línea de doblez además de la línea de corte), exactamente la misma clase de problema ya reservada para 2.3 Jabón Artesanal en Barra en el Lote 10, no visible en la entrada corta del catálogo usada para armar el plan original (mismo patrón que DEC-005).
- **Alternativas consideradas**: (a) Producir 12.4 como un rectángulo estándar sin la pestaña de plegado, contradiciendo su propio batch — rechazada, viola "sin excepciones al estándar ya establecido"; (b) resolver la pestaña de plegado de forma aislada dentro del Lote 2 sin esperar a la convención de "línea de plegado" que el Lote 10 ya iba a diseñar — rechazada, crearía una implementación paralela de la misma capacidad.
- **Impacto**: Le da a la futura convención de "línea de plegado" (`metadata.role`, ej. `"fold-line"`) dos casos reales contra los cuales validarse (jabón y mesa de dulces) en vez de uno solo, reduciendo el riesgo de diseñar la convención mirando un solo caso de uso.
- **¿Modifica infraestructura?**: No todavía — la convención de línea de plegado sigue pendiente de decidirse en el Lote 10.
- **¿Modifica documentación?**: Sí — `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (Lotes 2 y 10).
- **¿Aplica a futuros templates?**: Sí — refuerza el criterio de DEC-005: leer siempre la especificación completa del batch antes de confirmar el lote de un template.
