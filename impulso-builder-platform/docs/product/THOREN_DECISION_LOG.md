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
| DEC-011 | 2026-07-28 | Plan maestro (vigente desde el Lote 3) | Creación de `THOREN_VISUAL_ACCEPTANCE.md` como checklist de aprobación humana para capacidades visuales nuevas |
| DEC-012 | 2026-07-28 | Lote 3 → Lote 8 (4.2) | Reasignación por ícono de check (iconografía Nivel 3, no anillo de texto) |
| DEC-013 | 2026-07-28 | Lote 3 (3.1) | En anillos de texto cortos de sellos ~30mm, priorizar peso tipográfico sobre tamaño cuando el monograma debe conservar la jerarquía principal |
| DEC-014 | 2026-07-28 | Lote 3 (3.1, 6.3) | Verificación visual obligatoria de cualquier `TextObject` con ancho estimado, antes de dar por terminado un template |
| DEC-015 | 2026-07-28 | Cierre de Lotes 1-3 / Plan maestro | `arrangeRingText` validado como parte del estándar oficial de producción; producción pausada — checkpoint de Beta Comercial (DEC-006) antes del Lote 4 |

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

## DEC-011 — Creación de `THOREN_VISUAL_ACCEPTANCE.md` como checklist de aprobación humana

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Plan Maestro de Producción (vigente a partir del Lote 3, con `arrangeRingText` como primera capacidad evaluada)
- **Decisión tomada**: Mantener un checklist de 8 puntos (legibilidad, balance visual, espaciado, consistencia con Design Language, calidad PNG, calidad SVG, escalabilidad, fidelidad al batch) que se ejecuta —con revisión humana, no automatizable— cada vez que un lote introduce una capacidad visual genuinamente nueva.
- **Justificación**: Después de dos lotes cuya validación fue enteramente automatizada (estructura, roles, paleta, tipografía), el Lote 3 introduce la primera capacidad con riesgo real de calidad puramente visual (`arrangeRingText`, una aproximación de texto curvo con fragmentos rectos rotados, ver DEC-004) — ningún test automatizado puede confirmar que esa aproximación "se ve bien", solo que es estructuralmente válida.
- **Alternativas consideradas**: (a) Confiar solo en la suite automatizada y la revisión ad hoc ya mencionada en el plan maestro (Lote 3, "revisión visual manual") sin un checklist formal — rechazada por el usuario, que quiere un criterio explícito y repetible, no una revisión informal distinta cada vez; (b) aplicar el checklist a todos los templates de todos los lotes, sin importar si repiten una capacidad ya validada — rechazada, sería trabajo redundante sin beneficio real una vez que una capacidad ya fue aprobada visualmente.
- **Impacto**: Cada lote que introduce una capacidad visual nueva debe decidir explícitamente si la activa, y documentar el resultado en su propio reporte de producción — no es opcional una vez que la capacidad calza en la regla de activación.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — crea `THOREN_VISUAL_ACCEPTANCE.md`.
- **¿Aplica a futuros templates?**: Sí — a cualquier lote futuro (4, 6, 9, 10, 12 y cualquier otro) que introduzca una capacidad visual genuinamente nueva.

## DEC-012 — Reasignación de 4.2 Sello de Calidad Industrial del Lote 3 al Lote 8

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 3 → Lote 8 — 4.2 Sello de Calidad Industrial (`TEMPLATE_BATCH_04.md`, Template 16)
- **Decisión tomada**: Mover 4.2 del Lote 3 (sellos con anillo de texto) al Lote 8 (Técnico Funcional / Normado).
- **Justificación**: Su especificación completa exige un ícono de check ("1 ícono SVG de check, trazo grueso sólido") — iconografía Nivel 3 ("gráfico de alto contraste") según `THOREN_DESIGN_LANGUAGE_GUIDE.md` §4.1, no la capacidad de texto perimetral (`arrangeRingText`) que define el Lote 3. Al leer los 5 batches completos del Lote 3 antes de codear (práctica ya obligatoria desde DEC-005/DEC-010), se confirmó además que solo 3.1 y 10.1 usan realmente un anillo de 360°; 6.3 y 12.1 son sellos de un solo elemento central sin ninguna zona perimetral, pero no requieren reasignación porque no introducen ningún riesgo nuevo (a diferencia de 4.2, que sí introduce una necesidad de icono real).
- **Alternativas consideradas**: (a) Producir el ícono de check como parte del Lote 3, adelantando la primera integración de ilustración fuera de su lote asignado (Lote 4) — rechazada, mismo principio que DEC-009 y DEC-010; (b) omitir el ícono y dejar el sello solo con anillo de texto, contradiciendo el batch (que declara el check como "elemento más reconocible a distancia") — rechazada, viola el estándar sin excepciones.
- **Impacto**: El Lote 8 ya agrupaba símbolos normados (Advertencia General, Frágil Técnico) que reutilizan el pipeline de ilustración del Lote 4 — el ícono de check de 4.2 encaja en el mismo patrón sin necesitar una capacidad nueva adicional en ese lote.
- **¿Modifica infraestructura?**: No todavía — el pipeline de ilustración se construye en el Lote 4, no aquí.
- **¿Modifica documentación?**: Sí — `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (Lotes 3 y 8).

## DEC-013 — Peso tipográfico sobre tamaño en anillos de texto cortos (sellos ~30mm)

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 3 (3.1 Sello de Cita — Salón de Belleza), primer template en usar `arrangeRingText` — decisión tomada durante su revisión con `THOREN_VISUAL_ACCEPTANCE.md`.
- **Decisión tomada**: Cuando un anillo de texto perimetral corto (2 palabras o menos) necesita más presencia visual en un sello de ~30mm de diámetro, se aumenta el **peso tipográfico** (`fontWeight`) del anillo, no su **tamaño** (`fontSize`), siempre que el monograma o elemento central del sello deba conservar la jerarquía visual principal. Para 3.1, esto significó `fontWeight: 700` (en vez de 400) manteniendo `fontSize: 8` sin cambios.
- **Justificación**: Se compararon 4 variantes reales (exportadas en Chromium) contra la base: (a) tamaño +3 (`fontSize` 8→11), (b) peso +300 (`fontWeight` 400→700), (c) separadores decorativos (`•`) entre los fragmentos del anillo, (d) monograma reducido de ~40% a ~32% del diámetro para dar más aire. Aumentar el tamaño acerca el peso visual del anillo al del monograma más de lo que la jerarquía del batch sugiere ("el monograma es el elemento dominante"); aumentar el peso da la misma sensación de mayor presencia sin ocupar más espacio ni competir con el monograma. Los separadores resultaron casi imperceptibles a 30mm reales y no aportaron un beneficio claro. Reducir el monograma creó más aire pero se alejó de la proporción ~40% que especifica `TEMPLATE_BATCH_03.md` (fidelidad al batch, punto 8 de `THOREN_VISUAL_ACCEPTANCE.md`).
- **Alternativas consideradas**: (a) Tamaño +3 — rechazada, compite con la jerarquía del monograma; (b) separadores decorativos — rechazada, beneficio no perceptible a esta escala física; (c) monograma más pequeño (más aire) — rechazada, se aleja de la fidelidad al batch; (d) mantener la base sin cambios — descartada porque el peso 700 sí ofrece un beneficio claro y medible (mejor legibilidad/presencia) sin ningún costo en los otros puntos del checklist.
- **Impacto**: Se establece como criterio de dirección de arte reutilizable para el resto del Lote 3 (10.1 Sello Corporativo) y para cualquier lote futuro con anillos de texto cortos en sellos de escala similar (~25-35mm) — no es exclusivo de 3.1.
- **¿Modifica infraestructura?**: No — `arrangeRingText` no cambió; solo los parámetros (`fontWeight`) con los que los templates la invocan.
- **¿Modifica documentación?**: Sí — `THOREN_VISUAL_ACCEPTANCE.md` (registro de la ejecución del checklist sobre 3.1) y `THOREN_LOTE_03_REPORTE.md`.
- **¿Aplica a futuros templates?**: Sí — cualquier sello de ~25-35mm con anillo de texto corto y un elemento central que deba conservar la jerarquía principal.

## DEC-014 — Verificación visual obligatoria de `TextObject`s con ancho estimado

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Lote 3 — encontrado primero en 3.1 (fragmentos de `arrangeRingText`) y de forma independiente en 6.3 Sello "Hecho en Casa" (un `TextObject` plano, sin relación con `arrangeRingText`).
- **Decisión tomada**: Antes de dar por terminado cualquier template que incluya un `TextObject` cuyo ancho (`size.width`) se haya estimado en vez de medido contra la fuente real, se genera una exportación PNG real en Chromium y se revisa visualmente que el contenido completo se vea, sin recorte por word-wrap invisible. Esta verificación es independiente de `THOREN_VISUAL_ACCEPTANCE.md` (que solo se activa por capacidad visual nueva) — aplica a **cualquier** template con esta característica, sea o no la primera vez que se usa el patrón.
- **Justificación**: El mismo defecto (`Konva.Text` hace word-wrap dentro de su caja por defecto; si el ancho estimado es insuficiente, el contenido sobrante en la segunda línea queda invisible en el PNG/canvas, aunque el SVG y el `Project` sigan siendo correctos) apareció dos veces en el Lote 3 de forma independiente — una vez en `arrangeRingText` (3.1: "SALÓN"→"SALÓ"), una vez en un `TextObject` plano ya validado en lotes anteriores (6.3: "Hecho en casa"→"Hecho en"). Dos ocurrencias independientes confirman que no es un caso aislado de una capacidad nueva, sino un riesgo sistémico de cualquier caja de texto con ancho estimado — mismo criterio de "patrón confirmado tras dos ocurrencias" ya usado para DEC-005/DEC-010 (revisar el batch completo) y ahora para este.
- **Alternativas consideradas**: (a) Confiar en que los tests unitarios (que solo verifican `size.width`/contenido del `Project`, no el render) ya cubren esto — rechazada, ambos defectos pasaron sus tests unitarios sin problema, ya que el `Project` era correcto; el defecto solo es visible en el render real. (b) Limitar la verificación solo a templates que activan `THOREN_VISUAL_ACCEPTANCE.md` — rechazada, el defecto de 6.3 ocurrió en un patrón ya aprobado (texto plano centrado), fuera del alcance de ese checklist.
- **Impacto**: Se agrega un paso de verificación ligero (captura de PNG real) a cualquier template con `TextObject`s de ancho estimado, sin necesitar el checklist completo de 8 puntos de `THOREN_VISUAL_ACCEPTANCE.md` — más barato de ejecutar, aplicable a todos los lotes restantes.
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — este documento; recomendado también anotarlo en `THOREN_PRODUCTION_INFRASTRUCTURE.md` cuando se actualice para el Lote 4.
- **¿Aplica a futuros templates?**: Sí — cualquier template futuro con al menos un `TextObject` de ancho estimado (no medido), sin importar si introduce o no una capacidad visual nueva.

## DEC-015 — Cierre de Lotes 1-3, validación de `arrangeRingText`, checkpoint de Beta Comercial

- **Fecha**: 2026-07-28
- **Template/Lote relacionado**: Cierre de Etapa 2 (Lotes 1-3 del catálogo de contenido) / Plan Maestro.
- **Decisión tomada**: (1) `arrangeRingText` queda validada como parte del estándar oficial de producción del catálogo — su implementación, validación técnica (`THOREN_VISUAL_ACCEPTANCE.md`) y revisión visual (comparación de variantes, DEC-013) demostraron que cumple el nivel de calidad requerido. (2) La producción de templates se pausa — no se inicia el Lote 4. (3) Se entra oficialmente al punto de control de Beta Comercial ya definido en `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (DEC-006): validar el catálogo actual (14 templates de los Lotes 1-3) con usuarios reales antes de invertir en la integración de ilustración (Lote 4).
- **Justificación**: Con los Lotes 1-3 completos (15 templates incluido el piloto), el catálogo ya cubre 8 categorías comerciales distintas sin necesitar ninguna capacidad todavía no validada (ilustración, troqueles personalizados) — es la base más amplia posible para una validación de mercado real antes de comprometer las capacidades más costosas del plan.
- **Alternativas consideradas**: (a) Continuar directo al Lote 4 sin pausa, confiando en el diseño ya aprobado — rechazada por el usuario; el plan maestro ya reservaba este punto de control explícitamente (DEC-006), y validar con usuarios reales antes de invertir en ilustración reduce el riesgo de construir capacidades caras sobre supuestos no confirmados. (b) Publicar una beta sin definir de antemano objetivos/métricas/criterios de reanudación — rechazada, generaría una validación no accionable (sin criterio claro de qué hacer con el resultado).
- **Impacto**: Bloquea el inicio del Lote 4 hasta que la Beta Comercial se ejecute y sus resultados se evalúen contra los criterios que `THOREN_BETA_COMMERCIAL_PLAN.md` defina. No afecta la arquitectura ni la infraestructura ya aprobadas (regla ya establecida en el plan maestro: la beta puede reordenar prioridad de lotes, nunca alterar el estándar).
- **¿Modifica infraestructura?**: No.
- **¿Modifica documentación?**: Sí — crea `THOREN_BETA_COMMERCIAL_PLAN.md`.
- **¿Aplica a futuros templates?**: No aplica (decisión de secuencia de proyecto, no de producción de templates).
- **¿Aplica a futuros templates?**: Sí — tercera confirmación consecutiva (tras DEC-005 y DEC-010) de que la especificación completa del batch, no la entrada corta del catálogo ni el nombre del template ("Sello..."), determina en qué lote encaja.
