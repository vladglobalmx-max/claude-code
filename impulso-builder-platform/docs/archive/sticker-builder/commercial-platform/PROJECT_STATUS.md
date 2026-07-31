> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del lanzamiento comercial independiente de Sticker Builder v1.0.0 (RC1/Gumroad) — ese lanzamiento no ocurrirá bajo esta forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como evidencia de un proceso de release real, disciplinado y verificado — reutilizable como referencia si THÖREN necesita empaquetarse comercialmente en el futuro, pero no es una fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# Project Status — THÖREN Sticker Builder v1.0.0

## Estado del proyecto

**Cerrado.** La versión comercial 1.0 está congelada, verificada y lista para publicación. No hay trabajo de desarrollo pendiente para v1.0 — cualquier cambio adicional pertenece a la v1.1 (ver "Recomendaciones" abajo).

## Fecha de cierre

2026-07-27

## Versión final

**1.0.0** (edición Professional, pago único, canal Gumroad, `licensingMode: "delivery-only"`)

## Commit SHA

`938bfe2ef83f7d9968bfe0d8960ed26006549b3f`

(Commit del código de aplicación tal como está empaquetado en el ZIP comercial vigente. Los commits posteriores en la rama son exclusivamente documentación de cierre — ver `HANDOFF.md` y este mismo documento — sin ningún cambio de código fuente.)

## SHA-256 del ZIP comercial

```
cbb49f65cf615b265f9059b1b0cce80836a5eacb4f92a8b6b88851dcdeccee19  thoren-sticker-builder-v1.0.0.zip
```

Archivo: `apps/sticker-builder/dist-commercial/thoren-sticker-builder-v1.0.0.zip` (413,480 bytes / ~0.39 MB). Ver `FINAL_RELEASE_CHECKLIST.md` para el detalle completo de verificación del paquete (extracción limpia, escaneo de higiene, launchers, manifest).

---

## Resumen ejecutivo

THÖREN Sticker Builder es la primera versión comercial de un editor de stickers profesional que corre 100% en el navegador del comprador, sin backend, sin cuentas y sin telemetría. El proyecto se construyó como el primer módulo real sobre una plataforma multi-producto (Impulso Platform): un núcleo reutilizable (Document Schema → Engine → Renderer) pensado desde el día uno para soportar un segundo "Builder" futuro sin reescritura, aunque ese segundo módulo todavía no existe (ver "Pendientes intencionalmente NO implementados").

El desarrollo avanzó en fases de producto verificables — Foundation, Professional Editor, Print Production, Commercial Platform — cada una cerrada con verificación real (typecheck, tests unitarios, E2E en Chromium real, nunca solo revisión de código) antes de autorizar la siguiente. La v1.0 incluye un editor completo de creación de stickers y un motor de impresión profesional propio (PDF con sangrado, marcas de corte, imposición en hoja y validación de Preflight), algo inusual en herramientas de este segmento de precio. El hito final antes del cierre fue **Brand Integration — THÖREN**: la aplicación pasó de un nombre de desarrollo interno ("Impulso Sticker Builder Professional") a su identidad comercial definitiva, con un sistema visual propio (símbolo, paleta, tipografía) diseñado específicamente para transmitir una herramienta profesional de pago — sin tocar una sola línea del motor de impresión ni de la arquitectura.

## Funcionalidades principales

- **Editor de stickers completo**: texto, imágenes (PNG/SVG), formas, capas, agrupar/desagrupar, alineación y distribución, Grid/Rulers/Smart Guides con snapping asistido, deshacer/rehacer.
- **Biblioteca de assets y de plantillas**: reutilización de imágenes entre proyectos, galería de plantillas + plantillas propias del comprador ("Guardar como plantilla").
- **"Mis proyectos" (Workspace)**: biblioteca local de proyectos con miniaturas, renombrar/duplicar/eliminar, sin límite artificial de un solo proyecto.
- **Guardado automático + recuperación**: indicador de estado siempre visible, recuperación de cambios sin guardar tras un cierre inesperado, salida segura con confirmación si hay cambios pendientes.
- **Exportación rápida**: PNG (transparente/sólido, 1x-4x) y SVG.
- **Exportación profesional para impresión**: wizard de 7 pasos con 3 perfiles reales (Digital PNG, Print PDF, Sticker Sheet/imposición), sangrado, marcas de corte, líneas de troquelado (die-cut), imposición en hoja con reutilización real de raster, y Preflight con validación explicada en texto (44 códigos, nunca solo color).
- **Respaldo y restauración de proyectos**: exportar/importar un archivo `.json` portable autocontenido (incluye binarios de imágenes), sin sobrescribir nunca un proyecto existente.
- **100% offline**: launchers de un clic (Windows/macOS/Linux) que sirven la app desde la propia máquina del comprador, sin conexión a internet requerida tras la descarga.
- **Identidad comercial THÖREN**: nombre, símbolo (Þ), paleta y tipografía propios, integrados en la interfaz real (no solo mockups).

## Tecnologías utilizadas

- **TypeScript** en todo el monorepo (11 packages + 1 app), sin `any` implícito.
- **Zod** — validación y tipos en Document Schema y Commercial Schema.
- **Konva** — único motor de render de canvas (`@impulso/renderer-konva`).
- **pdf-lib** — generación de PDF en el motor de impresión, encapsulado detrás de un `PdfBackend` propio (aísla el radio de impacto de cualquier cambio de API futuro).
- **Vite** — build de la aplicación (dev y comercial, con configuración separada `vite.commercial.config.ts` que excluye harnesses de desarrollo).
- **Vitest** — tests unitarios/integración (jsdom).
- **Playwright** — tests E2E/visuales sobre Chromium real (comparación de píxeles reales del canvas contra exportaciones).
- **Turborepo + pnpm workspaces** — orquestación del monorepo.
- **IndexedDB** — única persistencia (proyectos, assets, plantillas, recovery) — sin backend, sin servidor propio.
- **Familjen Grotesk + Schibsted Grotesk** (SIL Open Font License 1.1, autoalojadas) — tipografía de marca, agregadas en Brand Integration.

## Métricas finales

Verificado en esta misma sesión de cierre, sobre el commit `938bfe2` (sin cambios de código desde entonces):

| Métrica | Resultado |
|---|---|
| Typecheck (monorepo, `turbo run typecheck`) | ✅ 23/23 tareas |
| Tests unitarios (monorepo, `turbo run test`) | ✅ 1,851 tests, 100% verdes, en 12 paquetes con suite propia (document-schema 102, storage-kit 8, commercial-schema 40, capabilities 10, asset-library 22, engine 327, renderer-konva 229, template-library 28, project-library 79, export-engine 66, print-engine 497, sticker-builder 443) |
| Cobertura (`apps/sticker-builder`, `vitest run --coverage`) | ✅ 97.43% statements/lines, 92.66% functions, 89.92% branches — todos por encima del umbral configurado y exigido (≥90/90/90 líneas/statements/funciones, ≥85% branches) |
| E2E (Playwright, Chromium real) | ✅ 54/54 escenarios — incluye regresión de contraste del botón de impresión y del foco del diálogo de bienvenida, ambas confirmadas intactas tras Brand Integration |
| Validación manual de comprador en vivo | ✅ Completada sobre el ZIP de distribución real, en la máquina real del propietario del producto (ver `BUYER_VALIDATION_REPORT.md`) — no repetida tras Brand Integration por ser un cambio puramente visual, verificado por el resto de la matriz |
| ADRs (decisiones de arquitectura documentadas) | 29 |

## Arquitectura general

Monorepo (pnpm workspaces + Turborepo), 11 paquetes + 1 aplicación, dependencia unidireccional verificada (sin ciclos):

```
Document Schema  →  Engine  →  Renderer (Konva)
       ↓               ↓             ↓
Asset Library    Alignment/     Print Engine
Template Library  Snapping      (raster + PDF)
Project Library
       ↓
Storage Kit (IndexedDB, compartido)
       ↓
Commercial Schema + Capabilities  →  apps/sticker-builder
```

- **`@impulso/document-schema`** — el modelo de datos puro (Project/Page/SceneObject), validado con Zod, sin dependencias de UI ni de render.
- **`@impulso/engine`** — comandos puros sobre el Document Schema (dispatch con patrón Result, sin excepciones para casos esperados), geometría de alineación/transformación de grupo.
- **`@impulso/renderer-konva`** — único adaptador de render real; expone un contrato `RendererAdapter` pensado para admitir otros renderers (Pixi, SVG-only, headless) sin rediseño, aunque hoy solo existe esta implementación.
- **`@impulso/asset-library`**, **`@impulso/template-library`**, **`@impulso/project-library`** — los tres pilares de contenido del usuario, cada uno sobre **`@impulso/storage-kit`** (abstracción compartida de IndexedDB).
- **`@impulso/export-engine`** — PNG/SVG para pantalla.
- **`@impulso/print-engine`** — PDF/PNG print-ready: boxes físicos, marcas de corte vectoriales, safe area, cut paths (kiss-cut/die-cut), imposición en hoja con reutilización de raster, 44 códigos de Preflight. `pdf-lib` queda encapsulado detrás de un único módulo (`PdfBackend`) para contener el impacto de cambios de API de terceros.
- **`@impulso/commercial-schema`** + **`@impulso/capabilities`** — el modelo de producto comercial (manifest, capabilities, entitlements conceptuales) que hace posible el empaquetado y el gating futuro, sin backend.
- **`apps/sticker-builder`** — la única aplicación real hoy: UI del editor, Workspace ("Mis proyectos"), wizard de exportación para impresión, identidad THÖREN, script de build comercial reproducible (`build:commercial`).

Ver `docs/ARCHITECTURE.md` para el diagrama y razonamiento completo, y `docs/adr/` (29 ADRs) para cada decisión individual con sus alternativas evaluadas.

## Riesgos conocidos

- **Sin coordinación entre pestañas**: dos pestañas editando el mismo proyecto a la vez no se avisan entre sí — el último guardado gana, sin advertencia.
- **`pdf-lib` como dependencia crítica de producción**: tres comportamientos por-defecto sorprendentes ya documentados y encapsulados (page en blanco si el documento tiene 0 páginas, sobrescritura de metadata al recargar, matriz `cm` interna en `drawSvgPath`) — el riesgo de mantenimiento ante un cambio de API mayor de esta librería es real, mitigado (no eliminado) por el aislamiento detrás de `PdfBackend`.
- **`document.fonts.check()` es una señal débil**: confirmado empíricamente que devuelve `true` incluso para una fuente inventada nunca declarada — el preview visual sigue siendo la verificación práctica más confiable de disponibilidad de fuente.
- **Cross-browser sin verificar**: el entorno de desarrollo solo tiene Chromium instalado; Firefox/Safari no están en la matriz de verificación de esta versión (límite de entorno, no de producto).
- **Presupuesto de memoria del wizard de impresión**: modelo teórico (256MB, factor 2.5x) validado con medición real pero a escala menor (200 copias) que los límites de producto declarados (200 hojas/2000 piezas) — sin evidencia a esa escala mayor todavía.
- **Tag `v1.0.0` y remoto**: el push de tags a `origin` falla de forma persistente (`HTTP 403`) en este entorno de sesión — ver informe ejecutivo de esta misma tarea de cierre para el estado exacto tras el intento de mover el tag.
- **Metadato `producer: "Impulso Print Engine"`** embebido en los PDF exportados (invisible en uso normal): queda así por decisión explícita de este cierre — no forma parte del alcance de Brand Integration ni de esta versión.

## Pendientes intencionalmente NO implementados

Decisiones deliberadas de no construir todavía (no son bugs ni trabajo olvidado — ver `docs/product/05-Technical-Debt.md` para el registro completo y el razonamiento de cada una):

- **Segundo módulo/Builder real** — la tesis de "plataforma reutilizable" sigue sin una segunda prueba real; Design System compartido, Shared Services y AI Engine siguen siendo solo conceptos arquitectónicos hasta que exista ese segundo consumidor.
- **Cuentas, cloud sync, colaboración en tiempo real, Marketplace, plugins públicos, DRM, backend propio** — evaluados y explícitamente diferidos (criterio Fase 4.2: "¿esto ayuda a vender/entregar/usar la primera copia?"); ninguno bloquea la v1.0.
- **Entitlements/licensing técnico y commerce-adapters (integración real con la API de Gumroad)** — Gumroad cubre checkout/entrega en V1 vía `licensingMode: "delivery-only"`, sin backend propio.
- **Design gaps menores del editor**: navegación por teclado para mover un object seleccionado, pan por scroll nativo, herramienta de creación de Rectangle/Ellipse desde el toolbar (los presets sí las incluyen; no hay botón dedicado).
- **Nesting irregular / optimización de desperdicio en la imposición** — el grid es siempre rectangular uniforme (decisión V1 explícita).
- **Firma de código de los launchers** (`.command`/`.bat` no firmados) — macOS muestra advertencia de "desarrollador no identificado"; documentado en la guía de soporte del comprador.
- **Escaneo automatizado de vulnerabilidades de dependencias** en `build:commercial` — auditoría manual suficiente hoy (3 dependencias runtime: zod/Konva/pdf-lib).

## Recomendaciones para la futura versión 1.1

1. **Resolver la divergencia del tag `v1.0.0` en el remoto** — investigar la causa del `HTTP 403` persistente al empujar tags (posible restricción de proxy/permiso específica de este entorno) antes de depender de tags remotos para cualquier automatización de release.
2. **Cerrar los gaps de UI menores de Fase 2** (navegación por teclado de objects, herramienta de Rectangle/Ellipse en el toolbar) — bajo esfuerzo, alto valor de pulido percibido.
3. **Medir el editor general con miles de objects** — la meta de rendimiento declarada del proyecto ("miles de objetos sin degradar la experiencia") sigue sin medirse a esa escala; solo el wizard de impresión tiene medición empírica real.
4. **Evaluar feedback real de comprador post-lanzamiento** antes de invertir en cualquier ítem del `PRODUCT_BACKLOG.md` — ninguna capacidad de negocio futura (cuentas, cloud sync, marketplace) tiene todavía evidencia de demanda real, solo evaluación conceptual.
5. **Considerar automatizar el escaneo de higiene del paquete comercial** (`scanForbidden` hoy es una lista fija de nombres) si el catálogo de dependencias crece.
6. **Revisar si el símbolo Þ y la paleta THÖREN necesitan variantes adicionales** (p. ej. modo alto contraste, versión monocromática para impresión de merchandising) solo si surge una necesidad real de producción — no anticipar.

---

*Este documento es un snapshot de cierre — no se actualiza incrementalmente. Para el estado vivo de la plataforma, ver `docs/platform/STATE_001.md`; para el roadmap continuo, `docs/product/04-Roadmap.md`.*
