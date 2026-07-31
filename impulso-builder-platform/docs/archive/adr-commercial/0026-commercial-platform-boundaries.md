> **ADR archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba la capa comercial de Sticker Builder como producto independiente — el problema que resuelve ya no existe en esa forma tras `../../product/THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de la decisión de arquitectura tomada en su momento. Ver [`../README.md`](../README.md) para el índice vigente de ADRs.

# ADR-0026 — Commercial Platform Boundaries (Fase 4.1)

## Problema
Epic 9 cerró el Print Engine y con él la ambición técnica del "Fase 3 — Print Production" del roadmap. La autorización de Fase 4.1 pide diseñar, **sin implementar todavía**, cómo Impulso deja de ser "un conjunto de Builders técnicamente funcionales" y se convierte en algo vendible: empaquetado de producto, control de acceso, licencias, distribución, clientes, actualizaciones, activación, canales externos — **sin mezclar ese mundo con el dominio creativo** que Épicas 1-9 construyeron y endurecieron. Este ADR responde la pregunta más fundacional de la fase: ¿qué límites (boundaries) separan lo comercial de lo creativo, y qué vocabulario usa cada uno?

## Contexto
- **Auditoría del monorepo (obligatoria antes de diseñar, Fase 4.1 sección 1)**: el sistema hoy es estrictamente un DAG de 9 paquetes convergiendo en `apps/sticker-builder` (`document-schema → engine → renderer-konva → export-engine → print-engine`, más `storage-kit → {asset,template,project}-library`), sin dependencias circulares (confirmado por inspección directa de cada `package.json`, no solo por la afirmación ya existente en `docs/ARCHITECTURE.md`). **Cero** SDKs de pago/comercio/auth existen hoy (grep exhaustivo de `stripe|gumroad|firebase|supabase|paypal|braintree|paddle|lemonsqueezy`: cero resultados). **Cero** feature flags o gating de capacidades existen hoy (grep de `featureflag|capability|isEnabled|canUse`: cero resultados) — todo lo que se compila está siempre activo para cualquier usuario. **Cero** variables de entorno (`import.meta.env`: cero matches; único `process.env` es de configuración de Playwright, no de runtime de app). **Cero** infraestructura de despliegue (sin Dockerfile/CI/CD/PWA/service worker). Persistencia 100% local: `localStorage` es hoy código legado read-only (`apps/sticker-builder/src/persistence.ts`, usado solo para una migración one-time), y toda escritura real vive en IndexedDB vía `packages/storage-kit` a través de `ProjectStore`/`AssetStore`/`TemplateStore`.
- **`docs/ARCHITECTURE.md` §5/§8** ya declara "sin backend, sin auth, sin infraestructura distribuida" como decisión de producto (Offline First), y lista cuentas/auth/sync/marketplace/plugins como diferidos hasta que exista necesidad de negocio concreta — este ADR es exactamente esa necesidad concreta, y no debe contradecir esa caracterización sin construir todavía lo que la resuelve.
- **`docs/platform/STATE_001.md` §1/§2/§10** marca la tesis "un núcleo, múltiples productos" como **teórica, no probada con un segundo consumidor real** — la Commercial Platform es, en los hechos, el primer consumidor cross-cutting genuino de los pilares de plataforma (Asset/Template/Project Library, Export/Print Engine) que no es "otro Builder", así que valida (o expone) esa tesis con evidencia real por primera vez.
- El "boceto de plugins" (`registerShapeTypes`/`registerExporters`/etc.) mencionado desde Fase 0 nunca se implementó — confirmado por grep, cero referencias en código real. No se reutiliza ni se revive en esta fase: la Commercial Platform no es esa arquitectura de plugins, es una capa ortogonal.
- Autorización explícita de Fase 4.1: solo arquitectura/modelo/prototipo mínimo — sin backend, sin auth productiva, sin pagos, sin panel admin, sin marketplace.

## Alternativas evaluadas

**¿Dónde vive la lógica comercial?**
1. *Dentro de cada Builder* (ej. `apps/sticker-builder` importa un SDK de Gumroad directamente) — descartada: acopla el dominio creativo a un proveedor comercial específico; un segundo Builder futuro repetiría el acoplamiento; viola el principio ya establecido para AI Provider Agnostic (`02-Product-Principles.md`), que este ADR extiende a "Commerce Provider Agnostic".
2. *Un único paquete monolítico `@impulso/commercial`* mezclando modelo de datos + lógica de evaluación + adaptadores de proveedor — descartada: repite el error que Epic 9 corrigió para PDF (`PdfBackend` aislado en un módulo, no esparcido) a una escala mayor; una capa comercial con demasiadas responsabilidades es más difícil de mantener "sin secretos en frontend" (sección 7) porque mezcla datos públicos (modelo de producto) con lógica sensible (validación de licencia).
3. **Capas separadas por responsabilidad, con dependencia unidireccional hacia el dominio creativo, nunca al revés** — **elegida**. Ver diagrama de capas abajo.

**¿Qué paquetes nuevos crear ahora?**
Evaluados los 6 propuestos en el enunciado (`@impulso/commercial-schema`, `capabilities`, `entitlements`, `licensing`, `product-manifest`, `commerce-adapters`) contra el principio explícito: *"un paquete solo se crea si tiene boundary real, API estable, consumidores identificados, tests propios, independencia útil."*
- `@impulso/commercial-schema` — **creado ahora**: boundary real (contratos de datos comerciales, análogo a `document-schema` para el dominio creativo), consumidor identificado (todos los paquetes comerciales futuros + el prototipo de validación de esta misma fase), independencia útil (cero I/O, cero proveedor, testeable en aislamiento). Contiene únicamente tipos + esquemas Zod + validadores puros — nunca lógica de negocio ni llamadas de red.
- `capabilities`, `entitlements`, `licensing`, `commerce-adapters` — **NO creados todavía**: hoy no tienen un consumidor real más allá de este mismo ADR (no existe un `ProductManifest` real cargado por ninguna app, no existe una evaluación de capability en ningún flujo). Crearlos ahora repetiría el error que `docs/platform/STATE_001.md` ya señala como riesgo (abstracciones sin segundo consumidor real). Quedan como paquetes **recomendados y diseñados** (ver §21 de este documento en `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`), a crear en Fase 4.2 (capabilities/product-manifest, cuando el wizard de Sticker Builder empiece a consultarlos de verdad) y 4.3-4.4 (entitlements/licensing/commerce-adapters, cuando exista una integración real con un canal).
- `@impulso/product-manifest` — el *formato* de manifest se diseña en este ADR (ver ADR-0027) pero su *esquema Zod* vive dentro de `commercial-schema` por ahora (mismo boundary de "contrato de datos puro"); se separaría a su propio paquete solo si Fase 4.2 demuestra que necesita lógica propia (ej. resolución de manifests en capas/herencia) que no es solo tipos.

## Decisión tomada

### Vocabulario (boundaries formales)
- **Module**: capacidad funcional principal y autocontenida, ej. `sticker-builder`. Un módulo es lo que hoy llamamos "un Builder" — corresponde 1:1 con una app en `apps/*` (hoy solo una).
- **Feature**: capacidad habilitable dentro de o a través de módulos, con un identificador de namespace punteado (`print.professional`, `export.pdf`, `imposition.grid`). Una Feature no es un paquete de código — es un nombre estable que el Capability Model evalúa; puede corresponder a un paquete entero (`print-engine` ≈ `print.professional`) o a una porción de uno.
- **Commercial Product**: paquete vendible que agrupa uno o varios Modules/Features bajo una identidad comercial propia (nombre, precio de referencia, edición). Ver `docs/platform/COMMERCIAL_PRODUCT_MODEL.md` para el modelo completo.
- **Entitlement**: derecho concedido a un sujeto (dispositivo/usuario) de usar un conjunto de Features, con estado y procedencia. Ver ADR-0028.
- **License**: el mecanismo técnico que demuestra o administra un Entitlement (clave, token firmado, sesión). Ver ADR-0028.
- **Channel**: origen comercial de una venta o concesión (`direct`, `gumroad`, `bookfluence`, `etsy`, `hotmart`, `internal`, `promotional`). Ver ADR-0029.

**Regla dura, sin excepción**: ningún `productId`/`channel`/nombre comercial se usa como feature flag directamente en código de Builder. El código de Builder solo pregunta `capabilities.has("print.professional")` — nunca `if (productId === "sticker-builder-pro")`. Esto es lo que permite que un mismo Builder participe en N productos comerciales futuros (bundles, ediciones white-label) sin bifurcar código.

### Arquitectura por capas (sección 20)

```
11. Support/Admin          ─┐
10. Telemetry               │  todas dependen únicamente de las
 9. Updates                 │  capas 1-4 (o de nada) — nunca al revés
 8. Identity                │
 7. Commerce Adapters       │  (Gumroad/Bookfluence/futuro Stripe...)
 6. Licensing                │  valida/administra Entitlements
 5. Entitlements             │  qué se concedió, a quién, desde dónde
 4. Capabilities             │  qué está permitido AHORA MISMO
 3. Commercial Product Manifest │ qué compone un producto vendible
 2. Project/Creative Domain  │  document-schema, engine, renderer-konva,
                              │  asset/template/project-library, export-engine
 1. Builder Runtime          │  apps/sticker-builder (y futuros Builders)
```

**Dependencias permitidas**: 1 depende de 2 (como hoy) y de 4 (consulta capabilities). 2 no depende de NADA por encima de sí misma — **regla dura**: `document-schema`/`engine`/`renderer-konva`/`asset-library`/`template-library`/`project-library`/`export-engine`/`print-engine` nunca importan de `commercial-schema` ni de ningún paquete de capas 3-11. 3 depende solo de 2 (para poder referenciar `ModuleId`/`FeatureId` reales) — nunca de 5-11. 4 depende de 3 y 5. 5 depende de 3. 6-11 dependen hacia abajo según necesiten, nunca hacia arriba.

Consecuencia directa y verificable: **los paquetes creativos no dependen de Gumroad, Stripe, Bookfluence, un proveedor de auth, ni un proveedor de analytics** — ninguno de esos nombres puede aparecer en un `import` dentro de `packages/document-schema|engine|renderer-konva|asset-library|template-library|project-library|export-engine|print-engine`. Esto se verifica hoy trivialmente (cero matches) y debe seguir siendo así en cada fase futura — es una regla de arquitectura, no una aspiración.

### Nuevo paquete: `@impulso/commercial-schema` (0.1.0, foundation)
Vive en la capa 3, **sin ninguna dependencia interna del monorepo** (solo `zod`) — mismo criterio de pureza que `@impulso/document-schema` (capa 2), que tampoco depende de ningún otro paquete. `ModuleId`/`CapabilityId`/`ChannelId` se tipan como `string` (abiertos, no un enum cerrado importado de otro paquete): un Module/Feature nuevo no debe requerir un cambio de tipo en `commercial-schema` para poder describirse — el catálogo real de valores válidos vive en documentación (`COMMERCIAL_PRODUCT_MODEL.md`/`CAPABILITY_MODEL.md`), no en el sistema de tipos, precisamente para no acoplar este paquete al ciclo de vida de `document-schema` o de un futuro segundo Builder. Contiene exclusivamente:
- Tipos + esquemas Zod: `CommercialProduct`, `ProductManifest`, `Capability`/`CapabilityId`, `Entitlement`/`EntitlementStatus`.
- Validadores puros (`parseCommercialProduct`, `parseProductManifest`, etc. — wrappers delgados sobre `.safeParse` de Zod, sin I/O).
- Fixtures de ejemplo (un `CommercialProduct` real para "Sticker Builder Professional", un `ProductManifest` real correspondiente).
- Cero lógica de evaluación de capabilities, cero llamadas de red, cero conocimiento de Gumroad/Bookfluence — eso vendrá en paquetes futuros que dependan de este.

Es explícitamente un **paquete de foundation**, análogo en espíritu a `document-schema`: un contrato de datos que packages y apps futuros consumirán, no un producto terminado. Ver ADR-0027 para el detalle del manifest y `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`/`CAPABILITY_MODEL.md` para el modelo completo.

## Consecuencias
- El dominio creativo (capas 1-2) permanece exactamente como Epic 1-9 lo dejaron — **cero cambios de comportamiento** en ningún paquete existente. La verificación final de esta fase debe confirmar 0 regresiones en los 1.740 tests + 51 E2E ya verdes al cierre de Epic 9.
- Cualquier Builder futuro (Fase 5, Multi Builder Platform) hereda gratis la separación: con solo declarar sus propios `ModuleId`/`FeatureId`, participa del mismo modelo comercial sin escribir lógica de licensing propia.
- La ausencia actual de gating (todo activo siempre) permanece **intacta** en 4.1 — no se apaga nada. La primera vez que algo se gatee de verdad es Fase 4.2 (Capabilities reales) o después, y con un `CapabilityProvider` por defecto que concede todo (ver `CAPABILITY_MODEL.md`) para garantizar que introducir el modelo no pueda, por sí solo, bloquear a un usuario existente.

## Riesgos
- **La tesis de reutilización de plataforma sigue sin un segundo Builder real** (riesgo ya documentado en `STATE_001.md`) — la Commercial Platform es un consumidor cross-cutting real de los pilares existentes, pero no reemplaza la validación que solo un segundo Builder puede dar. Este ADR no resuelve ese riesgo, solo evita agravarlo (no acopla la capa comercial a las particularidades de Sticker Builder).
- **Crear `commercial-schema` sin un segundo consumidor real todavía** es, en sí mismo, el mismo tipo de riesgo que motivó no crear los otros 5 paquetes — se acepta conscientemente aquí porque el enunciado de la fase permite explícitamente "schema inicial... tipos... validadores... fixtures... pruebas de serialización" como prototipo de validación arquitectónica, y porque el paquete es deliberadamente mínimo (sin lógica, solo contrato).
- **El nombre "Commercial Product" podría interpretarse erróneamente como el modelo de precios final** — se documenta explícitamente en `COMMERCIAL_PRODUCT_MODEL.md` que `priceReference` es solo referencia informativa, nunca la fuente de verdad de cobro (esa vive en el proveedor de pagos/canal).

## Compatibilidad futura
- Fase 4.2 (Product Manifest & Capabilities) construye el `CapabilityProvider` real y el primer `ProductManifest` cargado de verdad por `apps/sticker-builder`, usando los tipos ya definidos en `commercial-schema`.
- Fase 4.3 (Entitlements & Local Activation) introduce `@impulso/entitlements` (capa 5) y `@impulso/licensing` (capa 6), consumiendo los tipos de `Entitlement` ya definidos aquí.
- Fase 4.4 (Commerce Adapter / Gumroad) introduce `@impulso/commerce-adapters` (capa 7), con `GumroadAdapter` como primer adaptador — sin que capas 1-6 conozcan Gumroad por nombre.
- Fase 5 (Multi Builder Platform) es el momento correcto de revisar si esta capa comercial necesita generalizarse más allá de lo que un segundo Builder real exija — igual que el "boceto de plugins" original, no se anticipa sin evidencia.
