# THÖREN — Sticker Builder como componente interno

**Fecha:** 2026-07-31
**Naturaleza de este documento:** fuente única de verdad técnica sobre el motor de creación/impresión de stickers que THÖREN reutiliza internamente. Nace de la consolidación documental (`THOREN_DOCUMENT_CONSOLIDATION.md`, ejecutada tras `THOREN_PRODUCT_DIRECTION.md`, escenario D): **Sticker Builder deja de existir como producto visible.** No se vende por separado, no tiene catálogo comercial, no tiene Beta Comercial propia. Todo el código y el conocimiento de ingeniería que produjo — editor de canvas, motor de impresión, kit de producción de plantillas — sigue existiendo y sigue siendo válido, pero exclusivamente como capacidad interna al servicio de la experiencia THÖREN 2.0 descrita en `THOREN_VISION_2.md` y `THOREN_EXPERIENCE_BLUEPRINT.md`.
**Qué reemplaza:** este documento fusiona el contenido técnico reutilizable de `THOREN_PRODUCTION_INFRASTRUCTURE.md`, `THOREN_PILOT_TEMPLATE_STANDARD.md`, `THOREN_VISUAL_ACCEPTANCE.md`, las decisiones de ingeniería reutilizables de `THOREN_DECISION_LOG.md`, las convenciones de producción de `THOREN_DESIGN_LANGUAGE_GUIDE.md`, la guía de exportación a impresión (`docs/guides/exportar-para-impresion.md`), el inventario de licencias (`docs/platform/THIRD_PARTY_LICENSE_INVENTORY.md`) y la documentación técnica de `apps/sticker-builder/README.md`. Los seis documentos originales quedan archivados íntegros en `docs/archive/` — este documento no repite cada detalle de cada uno; resume y apunta al original archivado para el detalle exhaustivo.
**Lo que este documento NO es:** no es una propuesta de producto, no reintroduce un catálogo comercial, no describe ninguna superficie de usuario visible en THÖREN 2.0. `THOREN_VISION_2.md` ya es explícito: el wizard de exportación de 7 pasos y la galería de plantillas como cuadrícula desaparecen como formato de cara al usuario. Lo que sobrevive es la **capacidad técnica subyacente** — el motor, no su antigua interfaz.

---

## 1. Qué es el componente, en una frase

El código bajo `apps/sticker-builder/` (editor de canvas) y `packages/print-engine/`, `packages/export-engine/`, `packages/renderer-konva/`, `packages/asset-library/`, `packages/document-schema/`, `packages/engine/` es el **motor de creación, composición y exportación a impresión real** que THÖREN 2.0 invoca por debajo del Motor Creativo (`THOREN_CREATIVE_ENGINE.md`) para producir cada propuesta y su archivo final — nunca como una herramienta que la persona usuaria abre, ve o configura directamente.

`THOREN_TECHNICAL_ARCHITECTURE.md` ya es, sin ambigüedad, el documento que describe cómo estos módulos encajan en los 6 módulos de THÖREN — este documento no compite con esa función; documenta el nivel de detalle de ingeniería por debajo de esa arquitectura (decisiones concretas, kit de producción, convenciones de calidad) que `THOREN_TECHNICAL_ARCHITECTURE.md` no necesita repetir.

## 2. Estructura técnica del editor (`apps/sticker-builder/`)

Árbol de módulos (detalle completo y decisiones 3.1–3.14 en el README original, archivado en `docs/archive/sticker-builder/platform-app-readme.md`):

```
apps/sticker-builder/
├── src/
│   ├── main.ts / app.ts / bootstrap.ts     # entry point, orquestador central, pipeline Document Schema → Engine → Renderer → Canvas
│   ├── persistence.ts / legacyMigration.ts  # guardar/cargar (localStorage), migración de formatos previos
│   ├── projectPresets.ts / newProjectDialog.ts
│   ├── assetResolution.ts / assetsPanel.ts  # puente AssetBinaryStore (async) <-> resolveAssetSource (sync)
│   ├── exportDialog.ts                      # exportación rápida PNG/SVG (@impulso/export-engine)
│   ├── tools.ts / zoom.ts / layersPanel.ts / inspector.ts / alignment.ts / assistedPlacement.ts
│   ├── workspace.ts / shell.ts / unsavedChangesDialog.ts
│   ├── keyboardShortcuts.ts
│   ├── productionPreview.ts / productionExportController.ts / productionExportDialog.ts   # motor de impresión real (wizard de 7 pasos, ver §6)
│   └── catalogTemplates/kit/                # kit de producción de plantillas reutilizable, ver §4
```

**Orquestación:** `app.ts` es el único módulo que conoce a todos los demás; cada módulo individual solo conoce al `Engine`. La arquitectura de cuatro capas (`Document Schema → Engine → Renderer → Konva`) es la misma que documenta `THOREN_TECHNICAL_ARCHITECTURE.md` y no cambia por pasar a ser un componente interno.

**Cómo se verificó (no solo tests unitarios):** 410 tests (jsdom + stub de canvas) más 51 escenarios Playwright en Chromium real cubriendo el flujo completo crear→diseñar→guardar→abrir→exportar (pantalla y producción), incluidos bugs reales encontrados solo en navegador real (doble-click de renombrado roto por reconciliación de DOM, foco atrapado escapable con `Shift+Tab`, wizard colgado por despacho incorrecto según perfil de impresión) — el detalle completo de cada bug y su fix vive en el README archivado.

## 3. Decisiones de ingeniería reutilizables (resumen de `THOREN_DECISION_LOG.md`, archivado íntegro en `docs/archive/sticker-builder/DECISION_LOG.md`)

El log original tiene 16 decisiones (DEC-001 a DEC-016). Las ligadas específicamente al checkpoint de Beta Comercial del catálogo (DEC-006, DEC-015, DEC-016) quedan sin objeto y no se repiten aquí — su registro histórico completo permanece en el archivo. Las de valor técnico reutilizable:

| Decisión | Resumen |
|---|---|
| DEC-001 | Preferir siempre una alternativa tipográfica de licencia libre ya propuesta, cuando la primaria es comercial (ej. Poppins en vez de Century Gothic). |
| DEC-002 | Un dato de dos colores en una sola línea visual se modela como dos `TextObject`s adyacentes, no uno — `Style.fill` es un color por objeto en `@impulso/document-schema`. Generalizado como `createSplitAccentLine`. |
| DEC-003 | El kit de producción de plantillas vive en `apps/sticker-builder/src/catalogTemplates/kit/` (nivel de app), no en un `packages/*` nuevo — sin un segundo consumidor real que justifique extraerlo. |
| DEC-005 / DEC-010 / DEC-012 | Leer siempre la especificación completa de una plantilla antes de confirmar su alcance — la entrada corta o el nombre pueden ocultar un requisito (textura, troquel no estándar, icono) que cambia por completo el trabajo necesario. |
| DEC-009 | Una "textura" puede aproximarse con un color sólido en el `fill` del die-line cuando el batch no exige un patrón/fibra real — no todo lo que se llama textura necesita una imagen tileable real vía `@impulso/asset-library`. |
| DEC-011 | Cualquier capacidad visual genuinamente nueva pasa por revisión humana con el checklist de `THOREN_VISUAL_ACCEPTANCE.md` (§5) antes de darse por terminada — ningún test automatizado puede confirmar que una aproximación visual "se ve bien". |
| DEC-013 | En anillos de texto cortos sobre sellos pequeños (~25-35mm) que necesitan más presencia, subir el peso tipográfico (`fontWeight`), no el tamaño (`fontSize`) — preserva la jerarquía del elemento central. |
| DEC-014 | Cualquier `TextObject` con ancho estimado (no medido contra la fuente real) requiere una verificación visual real en PNG exportado antes de darse por terminado — el word-wrap de `Konva.Text` puede recortar contenido de forma invisible para los tests unitarios (que solo verifican el `Project`, no el render). |

**Regla que se conserva:** antes de tomar una decisión de interpretación o arquitectura sobre este componente, revisar este resumen y, si hace falta el detalle completo (alternativas consideradas, justificación extendida), el log archivado — para no contradecir un precedente ya establecido.

## 4. Kit de producción de plantillas (`catalogTemplates/kit/`)

Código real, documentado originalmente en `THOREN_PRODUCTION_INFRASTRUCTURE.md` (archivado íntegro en `docs/archive/sticker-builder/PRODUCTION_INFRASTRUCTURE.md`), que automatiza ~55-65% del esfuerzo mecánico de producir un `Project` a partir de una especificación de diseño:

- `createIdFactory`, `buildElementMetadata` — identidad e ids consistentes.
- `createTextObject`, `createSplitAccentLine` (ver DEC-002), `stackVertically`/`textLineHeight` — construcción y layout de texto.
- `createRectangle`/`createEllipse`/`createDividerLine`, `createDieLineObjects` (con `fill`/`stroke`/`strokeWidth` opcionales desde DEC-009) — formas y die-lines.
- `styleSystem.ts` (`VisualFamily`, `TemplateStyle`, `FAMILY_SAFE_MARGIN_MM`) — sistema de estilo por familia visual, ver §6.
- `createCatalogProject`, `buildCatalogTemplateDescriptor` — ensamblaje de un `Project` completo.
- `validateCatalogProject`/`validateTemplateStyle` — validación estructural automatizada.
- `arrangeRingText` — aproximación de texto perimetral con fragmentos rectos rotados (validada como estándar de producción en DEC-015, con revisión visual documentada en DEC-013).

Este kit sigue existiendo y sigue siendo la forma correcta de generar geometría de sticker/etiqueta programáticamente — su valor no dependía de que existiera un catálogo comercial de 63 plantillas para venderse, sino de que resuelve un problema real de producción de `Project`s válidos y consistentes.

## 5. Proceso de conversión especificación → `Project` real

Resumen del método de 7 pasos documentado originalmente en `THOREN_PILOT_TEMPLATE_STANDARD.md` (archivado íntegro en `docs/archive/sticker-builder/PILOT_TEMPLATE_STANDARD.md`), validado con la conversión real del piloto (Serum Facial Premium):

1. Leer la especificación completa (no solo su entrada corta de catálogo) antes de comenzar — ver DEC-005/010/012.
2. Resolver tipografía: preferir siempre una alternativa de licencia libre ya sugerida cuando la primaria es comercial (DEC-001).
3. Modelar cada dato del contenido como uno o más `TextObject`s — partir en varios cuando un dato necesita más de un color (DEC-002).
4. Calcular el layout vertical de forma programática (`stackVertically`/`textLineHeight`), nunca con coordenadas fijas a mano.
5. Aplicar el die-line y el sistema de estilo de la familia visual correspondiente (§6).
6. Verificar visualmente cualquier `TextObject` de ancho estimado exportando un PNG real (DEC-014) — no basta con que el test unitario del `Project` pase.
7. Ejecutar `THOREN_VISUAL_ACCEPTANCE.md` (§5) si la plantilla introduce una capacidad visual genuinamente nueva.

Problemas reales encontrados y corregidos durante este proceso (detalle completo en el original archivado): un hang de `toBlob` en jsdom (stub de canvas para tests), orden de filas del panel de Capas, una fuente con licencia comercial no advertida a tiempo, y la partición de color de una línea en dos objetos (origen de DEC-002).

## 6. Convenciones de producción heredadas del Design Language Guide

`THOREN_DESIGN_LANGUAGE_GUIDE.md` (archivado íntegro en `docs/archive/sticker-builder/DESIGN_LANGUAGE_GUIDE.md`) documentaba la identidad visual de un catálogo comercial de 63 plantillas que ya no se produce — esa capa (6 familias de lenguaje visual, paleta/tipografía/mockup por familia, voz comercial) se archiva junto con el resto del Dominio B. Lo que sí es una convención técnica de producción, independiente de cualquier catálogo comercial, y por lo tanto se conserva aquí como parte del componente interno:

- **Sangrado:** 3mm en los 4 lados (`STANDARD_BLEED`, `packages/print-engine/src/profiles.ts`), sin excepción.
- **Área segura:** margen interno de 3mm (`STANDARD_SAFE_AREA`) — ningún elemento crítico la cruza, sin excepción.
- **5 niveles de reducción de iconografía** (línea fina editorial / color plano simplificado / gráfico de alto contraste / pictograma ultra-reducido / símbolo normado) — escala reutilizable para calibrar cuánto detalle visual lleva un ícono según el contexto, independiente de si existe un catálogo comercial detrás.
- **Regla de cantidad de íconos:** nunca más de un ícono/ilustración protagonista por diseño (excepto un set de variantes del mismo ícono, que cuenta como un solo sistema).
- **Regla de textura:** funcional, nunca decorativa por defecto; nunca se aplica sobre el propio texto; nunca se usa para "llenar espacio" — si un diseño se siente vacío, la solución es aumentar tipografía o aire, no agregar una textura de relleno.

## 7. Checklist de aceptación visual (`THOREN_VISUAL_ACCEPTANCE.md`, archivado íntegro en `docs/archive/sticker-builder/VISUAL_ACCEPTANCE.md`)

8 puntos de revisión humana — Legibilidad, Balance visual, Espaciado, Consistencia con Design Language, Calidad PNG, Calidad SVG, Escalabilidad, Fidelidad al batch/especificación. **Regla de activación:** se ejecuta únicamente cuando una plantilla o composición introduce una capacidad visual genuinamente nueva (ningún test automatizado puede confirmar que una aproximación visual "se ve bien", solo que es estructuralmente válida) — no se repite para capacidades ya validadas. Ejecución real registrada: `arrangeRingText` (Lote 3), veredicto "aprobado" tras corregir un bug real de recorte de texto por word-wrap.

**Relación con el filtro de calidad del Motor Creativo:** `THOREN_PRODUCT_BACKLOG_V2.md` §5 ya reserva, como expansión futura no autorizada todavía, una "Fase 5 — Calidad ampliada" del Motor Creativo con clasificación de 5 niveles. Este checklist de 8 puntos es el candidato directo a fusionarse con esa expansión futura cuando se autorice — no antes.

## 8. Exportación a impresión real (motor interno, sin superficie de usuario propia)

`docs/guides/exportar-para-impresion.md` (archivado íntegro en `docs/archive/sticker-builder/guide-exportar-para-impresion.md`) documentaba, para el editor de Sticker Builder como producto independiente, un wizard de usuario de 7 pasos (perfil → imposición → Production Preview → Preflight → advertencias → progreso → resultados) con 3 perfiles (Digital PNG / Print PDF / Sticker Sheet). **Ese wizard, como superficie de usuario, no existe en THÖREN 2.0** — `THOREN_VISION_2.md` es explícito en que desaparece por completo del flujo que la persona usuaria ve.

Lo que sí persiste como capacidad interna, invocable programáticamente por THÖREN 2.0 sin exponer ninguno de sus pasos:

- **Preflight:** validación real antes de exportar (die-line/cut-path presente, sangrado y área segura respetados, resolución suficiente) — los códigos de error/advertencia/información documentados en `docs/platform/PREFLIGHT_CODES.md` (que se mantiene, ver `THOREN_DOCUMENT_STRUCTURE_v1.0.md` para su clasificación) siguen aplicando tal cual a cualquier exportación real que THÖREN genere.
- **Imposición:** capacidad de repetir un diseño en una hoja de impresión (perfil "Sticker Sheet") — sigue existiendo en `@impulso/print-engine`, disponible si THÖREN necesita en el futuro una salida de este tipo, sin que la persona usuaria configure ningún parámetro de imposición manualmente.
- **Los 3 perfiles de exportación** (Digital PNG / Print PDF / Sticker Sheet) siguen siendo formatos de salida técnicamente válidos — la decisión de cuál usar, cuándo, es del sistema, nunca una pregunta al usuario (mismo principio que "el sistema decide, no pregunta" ya aplicado en el Motor Creativo para resolver contraste de color, `THOREN_CREATIVE_ENGINE.md`).

## 9. Licencias de terceros (vigente, `docs/platform/THIRD_PARTY_LICENSE_INVENTORY.md`, archivado íntegro en `docs/archive/sticker-builder/THIRD_PARTY_LICENSE_INVENTORY.md`)

Reutilizable sin cambios — la validez legal de estas licencias no depende de si Sticker Builder se vende por separado:

- **Fuentes autohospedadas** (`.woff2`, sin CDN): Familjen Grotesk, Schibsted Grotesk — ambas SIL Open Font License 1.1.
- **Dependencias de runtime empaquetadas:** `zod` (MIT), `konva` (MIT), `pdf-lib` (MIT).
- Dependencias de desarrollo no se empaquetan en el bundle final.

Si THÖREN reempaqueta o distribuye cualquiera de estos mismos recursos en el futuro, este inventario es el punto de partida — no repetir la investigación de licencias desde cero.

## 10. Limitaciones conocidas heredadas (siguen aplicando al componente interno)

Del README técnico original (detalle completo archivado, §7 de ese documento):

- Exportar SVG no detecta fuentes no disponibles en el visor de destino, ni reproduce el ajuste automático de línea de un `TextObject` con caja de wrap.
- Sin deduplicación ni compresión de Assets — subir la misma imagen dos veces crea dos entradas independientes.
- `preloadDocumentAssets` resuelve todos los Assets al abrir/remontar — sin carga perezosa (ver `docs/PERFORMANCE_BUDGET.md`).
- Solo el tipo de Asset `image` está implementado.
- Un `Group` siempre se edita como unidad completa — no existe "entrar" a un Group.
- El historial de undo/redo no sobrevive a guardar/salir/recargar.
- Cross-browser (Firefox/WebKit) sigue sin verificar — solo Chromium instalado en el entorno de desarrollo actual.

Ninguna de estas limitaciones bloquea el uso del componente como motor interno de THÖREN 2.0 hoy — se listan para que cualquier expansión futura del Motor Creativo las tenga en cuenta antes de asumir una capacidad que no existe todavía.

## 11. Gobernanza de este documento

- Este documento se actualiza cuando el componente interno cambia de forma real (nueva capacidad del kit, nueva decisión de ingeniería con valor reutilizable, nueva limitación encontrada) — no cuando cambia el catálogo comercial, porque ese catálogo ya no existe como línea de trabajo activa.
- Los 6 documentos originales fusionados aquí permanecen archivados íntegros en `docs/archive/sticker-builder/` — este resumen no los reemplaza como registro histórico detallado, solo como referencia técnica de trabajo diaria.
- `THOREN_TECHNICAL_ARCHITECTURE.md` sigue siendo la fuente de arquitectura de producto/módulos; `docs/ARCHITECTURE.md` la de arquitectura de código; este documento es un nivel de detalle por debajo de ambos, específico del motor de creación/impresión.
