# Handoff — THÖREN Sticker Builder v1.0.0

Para el "yo del futuro" (o cualquiera que retome este proyecto): esto no es un tour de features, es lo que necesitas saber antes de tocar código para no romper algo que ya se decidió con evidencia real.

## Cómo está organizado el proyecto

Monorepo `pnpm` + `Turborepo`, dependencia unidireccional entre paquetes (verificada, sin ciclos):

```
apps/
  sticker-builder/          la única aplicación real hoy
    src/                    UI (TS + DOM directo, sin framework)
    commercial-product.json manifest comercial (fuente de verdad de branding/capabilities)
    commercial-assets/      contenido que se copia TAL CUAL dentro del ZIP (docs comprador, legal, launchers)
    scripts/build-commercial.mjs   build reproducible del paquete de venta
    public/fonts/           tipografía de marca autoalojada (Familjen Grotesk, Schibsted Grotesk)
    e2e/                    Playwright, contra un build real servido por vite preview
packages/
  document-schema/    el modelo de datos puro (Project/Page/SceneObject) — Zod, sin UI
  engine/             comandos puros sobre el Document Schema (patrón Result)
  renderer-konva/     único RendererAdapter real (Konva)
  asset-library/ template-library/ project-library/   los 3 pilares de contenido del usuario
  storage-kit/        abstracción compartida de IndexedDB, debajo de los 3 pilares de arriba
  export-engine/      PNG/SVG para pantalla
  print-engine/       PDF/PNG print-ready (el módulo más complejo del monorepo)
  commercial-schema/ capabilities/   modelo de producto comercial + gating
docs/
  adr/                29 ADRs — la razón de CADA decisión no obvia
  product/            visión, roadmap, backlog, deuda técnica (léelos en ese orden)
  platform/           estado operativo: builds, seguridad, checklists, ESTE documento
```

Cada paquete tiene su propio `README.md` y `CHANGELOG.md` — son la fuente de verdad de detalle técnico, no los repitas de memoria.

## Qué decisiones arquitectónicas NO deben romperse

1. **Dependencia unidireccional entre paquetes.** `document-schema` no importa nada de `engine`; `engine` no importa nada de `renderer-konva`; ningún pilar de contenido (Asset/Template/Project Library) depende de `export-engine` ni de `print-engine`. Si sientes la tentación de que un paquete "de abajo" importe algo de "arriba" para ahorrarte una capa, es una señal de que el cambio pertenece en otro lado.

2. **`RendererAdapter` es un contrato, no un acoplamiento a Konva.** Solo existe una implementación real hoy, pero el contrato se diseñó para admitir otra (Pixi, SVG-only, headless) sin rediseñar `engine` ni `document-schema`. No agregues nada Konva-específico fuera de `renderer-konva`.

3. **`pdf-lib` vive encapsulado detrás de `PdfBackend`** (`packages/print-engine/src/pdf/pdfLibBackend.ts`). Nunca importes `pdf-lib` directamente desde otro archivo del motor o de la app — el único punto de contacto con esa librería debe seguir siendo ese módulo. Ya demostró tener comportamientos por-defecto sorprendentes (ver sección de deuda técnica abajo); el aislamiento es lo que contiene el radio de impacto si algún día hay que cambiar de librería.

4. **`engine`'s `dispatch` nunca lanza para casos esperados** (patrón Result). Si agregas un comando nuevo, sigue ese mismo patrón — no introduzcas una excepción para un caso de validación esperado solo porque es más rápido de escribir.

5. **El manifest comercial (`commercial-product.json`) es la ÚNICA fuente de branding en runtime.** `branding.displayName`/`shortName` se leen en exactamente 3 lugares (`welcomeDialog.ts`, `workspace.ts`, `main.ts`) — si necesitas cambiar el nombre comercial otra vez, cambia el manifest, no busques strings hardcodeados por el código (ya no debería haber ninguno tras Brand Integration).

6. **El build comercial es reproducible por diseño.** `commercial-product.json` se compila TAL CUAL está en el repo (con `buildMetadata` en `null`) — nunca se estampa antes de `vite build`. El `commit`/`buildId`/`builtAt` reales se agregan DESPUÉS del build, en archivos sueltos que van en la raíz del paquete (`commercial-product.json` estampado, `version.json`), nunca dentro del bundle de JS. Si rompes esto, pierdes la propiedad de que el mismo commit siempre produce bytes idénticos en el JS compilado.

7. **`licensingMode: "delivery-only"`** es la decisión V1 explícita — no hay activación técnica, no hay backend de licencias. No agregues gating de capabilities en la UI sin que exista una segunda edición real que lo justifique (hoy solo existe `"professional"`, así que cualquier chequeo sería un no-op).

## Qué partes son críticas (tocar con máximo cuidado)

- **`packages/print-engine`** — es, con diferencia, el módulo más complejo y con más deuda documentada del monorepo (ver `docs/product/05-Technical-Debt.md`, sección Print Engine). Cualquier cambio aquí necesita, como mínimo: los golden fixtures existentes pasando, verificación en Chromium real (no solo jsdom), y revisar si toca alguno de los 3 comportamientos sorprendentes ya documentados de `pdf-lib`.
- **`toPixels`/conversión de unidades física↔canónica** (`document-schema`). Esta fue la causa raíz de al menos 2 bugs críticos reales encontrados en producción (imágenes desbordando el sticker, presets circulares mal dimensionados) — cualquier código nuevo que combine `Page.size` (unidad física) con `size`/`transform` de un object (siempre píxeles canónicos) debe convertir explícitamente. Hay un bug conocido y NO corregido de esta misma familia todavía abierto: `computeInsertPosition` en `tools.ts` (ver Technical Debt, sección 1.bis) — no asumas que ya está resuelto en todo el código solo porque se corrigió en `insertText`/`insertImageObject`.
- **`build-commercial.mjs`** — el script que arma el ZIP de venta. Tiene un escaneo de higiene (`scanForbidden`) que es una lista fija de nombres (`.env`, `.git`, `node_modules`, `.DS_Store`) — no es exhaustivo, es una red de seguridad mínima. Antes de cualquier release real, sigue haciendo el escaneo manual completo (grep de "claude"/"anthropic"/rutas del repo/secretos) que se hizo en cada cierre de este proyecto — no confíes solo en el script.
- **`commercial-assets/`** — todo lo que hay aquí se copia LITERAL dentro del ZIP que recibe el comprador. Un error aquí es un error que ve el cliente, no un error de desarrollo.

## Qué componentes pueden evolucionar con libertad

- **La UI de `apps/sticker-builder/src`** (fuera de `tools.ts`/tipos de unidades) — es CSS/DOM directo sin framework, deliberadamente simple; no hay contrato externo que dependa de su estructura interna.
- **El sistema visual THÖREN** (paleta, tipografía, `.brand-mark`) — es la capa más superficial y más reciente; iterar aquí no arriesga nada del núcleo. Eso sí: si cambias el símbolo o la paleta, hazlo con la misma disciplina de propuesta-antes-de-código que se siguió en Brand Integration (ver ADR conceptual de esa fase en el historial de commits), no lo hagas sobre la marcha.
- **Templates/presets built-in** (`builtInTemplates.ts`, `projectPresets.ts`) — agregar uno nuevo es mecánico y de bajo riesgo.
- **Documentación del comprador** (`commercial-assets/docs/*.md`) — se puede mejorar el copy libremente sin ningún riesgo técnico.

## Qué deuda técnica quedó pendiente

La lista completa y honesta vive en `docs/product/05-Technical-Debt.md` — no la dupliques de memoria, léela ahí. Los puntos que más probablemente te muerdan primero:

- **Sin coordinación multi-pestaña** — dos pestañas con el mismo proyecto abierto, el último guardado gana en silencio.
- **`document.fonts.check()` da falsos positivos** — confirmado empíricamente en Chromium real, devuelve `true` para fuentes que ni siquiera existen. No confíes en esa API para nada crítico; el preview visual real sigue siendo la única verificación confiable.
- **Cross-browser sin verificar** — solo Chromium tiene binario instalado en este entorno de desarrollo. Firefox/Safari son un límite de entorno, no una garantía de que funcionen.
- **Bug conocido sin corregir**: `computeInsertPosition` (`tools.ts`) no convierte `page.size` a píxeles antes de calcular la posición central de inserción — mismo bug de unidades que ya se corrigió en otros dos lugares, pero no aquí. No se corrigió porque estaba fuera del alcance explícitamente autorizado de la fase que lo encontró.
- **`e2e/export-visual.spec.ts` roto desde que la app se volvió Workspace-first** — nadie lo actualizó cuando cambió la navegación inicial. No cuenta en el "54/54" de este cierre porque no forma parte de la suite activa — verifícalo tú mismo antes de asumir que ya se arregló.
- **Metadato PDF `producer: "Impulso Print Engine"`** — deliberadamente sin cambiar, fuera de alcance de Brand Integration por instrucción explícita del propietario del producto.

## Qué prácticas se siguieron durante el desarrollo

- **Nunca se avanzó con un bug conocido sin documentar.** Si algo se encontró y no se corrigió, quedó registrado en `05-Technical-Debt.md` con la fase donde se encontró y por qué se pospuso — nunca un silencio accidental.
- **Verificación real, no solo revisión de código.** Cada fase cerró con typecheck + tests unitarios + E2E en Chromium real (nunca solo jsdom para lo que toca canvas/PDF/CSS real) antes de reportarse como completa. La validación manual de comprador en vivo (v1.0) se hizo sobre el ZIP de distribución real, en una máquina real, no en el sandbox de desarrollo.
- **Autorización explícita por fase/hito**, nunca alcance implícito. Cada épica se acotó con reglas explícitas (qué no tocar, qué no construir) antes de empezar, y se cerró con un reporte ejecutivo verificable.
- **YAGNI con criterio explícito, no por pereza.** Cada decisión de "no construir esto todavía" (Fase 4.2 en adelante) se evaluó contra una pregunta concreta ("¿esto ayuda a vender/entregar/usar la primera copia?"), documentada, no asumida.
- **Los ADRs se escriben ANTES o DURANTE la decisión, no como documentación retroactiva de relleno** — cada uno incluye alternativas evaluadas y por qué se descartaron, no solo la decisión final.
- **Ningún cambio "cosmético" se coló como cambio funcional, y viceversa.** Brand Integration —el hito más reciente— se ejecutó explícitamente como cambio puramente visual: verificado con la misma suite completa (typecheck/unit/E2E) para confirmar cero regresión funcional, sin tocar el motor de impresión ni la arquitectura.

---

*Si en el futuro agregas un segundo módulo/Builder real: es el evento que más va a poner a prueba todo lo de arriba. Cuando eso pase, revisa primero si algo de esta lista "no debe romperse" necesita revisarse con la evidencia nueva de un segundo consumidor real — varias decisiones aquí se tomaron explícitamente "hasta que exista un segundo caso real".*
