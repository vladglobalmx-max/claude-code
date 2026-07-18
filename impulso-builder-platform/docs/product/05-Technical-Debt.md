# 05 — Technical Debt (deliberadamente pospuesto)

> Este documento no es una lista de errores ni de trabajo mal hecho. Es un registro deliberado de todo lo que Impulso **decide no construir todavía**, para que la decisión de posponerlo sea explícita y revisitable — no un olvido accidental que alguien redescubre meses después. "Pospuesto" no significa "descartado": cada ítem se incorpora cuando exista una necesidad real, no por anticipación especulativa (ver [`02-Product-Principles.md`](02-Product-Principles.md), "Simplicidad").

---

## Producto / Negocio

Estos son los que más directamente cambian qué tipo de producto es Impulso hoy — todos deliberadamente fuera de alcance hasta que exista una razón de negocio concreta para incorporarlos:

| Ítem | Por qué se pospone | Se incorpora cuando... |
|---|---|---|
| **Usuarios / cuentas** | El producto actual (Fase Alpha/Beta) es de uso individual, local al dispositivo — no hay necesidad de identificar a nadie entre sesiones todavía. | Exista una razón real para que un usuario necesite acceder a su trabajo desde más de un dispositivo, o el negocio requiera identificar usuarios (ej. planes pagos). |
| **Cloud Sync** | Depende de que exista Usuarios/cuentas primero — sincronizar el trabajo de "nadie" no tiene sentido. `StorageProvider` (ver `../ARCHITECTURE.md`) ya está diseñado como una interfaz para que esto se incorpore sin rediseñar cómo el Engine guarda/lee un documento. | Exista una necesidad real de continuidad entre dispositivos — no antes. |
| **Marketplace** | No existe todavía ni un segundo módulo real, ni una base de usuarios que justifique un mercado de plantillas/assets/plugins. Construir un marketplace antes de tener algo que vender en él es invertir en infraestructura sin demanda. | Exista un catálogo de contenido (plantillas, assets, plugins de terceros) suficientemente grande y una base de usuarios que lo justifique. |
| **Colaboración en tiempo real** | Requiere resolver primero cuentas + sincronización remota, y además introduce problemas de concurrencia (edición simultánea, resolución de conflictos) que no tienen relación con el objetivo actual (un editor individual, rápido, offline-first). | El módulo de negocio (B2B, equipos de diseño) lo justifique explícitamente — evaluado, no asumido, en v2.0 (ver [`04-Roadmap.md`](04-Roadmap.md)). |
| **Plugins públicos** | La arquitectura de plugins (ver `../ARCHITECTURE.md` §2.4) existe para que Impulso mismo crezca (módulos internos como Planner Builder), no para que terceros publiquen extensiones todavía — abrir esa superficie a terceros implica compromisos de API pública y seguridad que no se han diseñado. | Existan al menos dos-tres módulos internos reales validando el contrato de plugin, y una razón de negocio para abrirlo a terceros. |
| **APIs (públicas, de integración)** | No hay todavía ningún backend real (Fase 1 es 100% cliente) — no existe "una API" que exponer. | Exista un backend real (ver "Backend HTTP" abajo) y un caso de uso concreto de integración externa. |
| **Multiusuario / organizaciones** | Visión de producto de largo plazo (B2C y B2B, ver `../ARCHITECTURE.md` §0), explícitamente no implementada en la fase actual — no hay cuentas individuales todavía, mucho menos organizaciones. | Exista un caso de uso B2B real de colaboración entre varias personas de un mismo equipo/negocio. |
| **Facturación** | No hay ningún modelo de monetización implementado todavía — el producto actual no distingue "gratis" de "pago" en ningún lugar. | El producto tenga una propuesta de precios definida y validada — una decisión de negocio que precede a la implementación, no al revés. |

## Pilares de Impulso Platform aún no construidos (ver `03-Architecture-Map.md`)

La estructura conceptual de la plataforma (ver [`03-Architecture-Map.md`](03-Architecture-Map.md)) nombra pilares que hoy son solo eso — conceptos, no paquetes con código. Se registran aquí para que nombrarlos en el mapa de arquitectura no se confunda con haberlos construido:

| Pilar | Estado hoy | Se construye cuando... |
|---|---|---|
| **Shared Services** | No existe ningún servicio compartido real — la persistencia local de Sticker Builder (`apps/sticker-builder/src/persistence.ts`) es código de aplicación, no un servicio de plataforma. | Exista un segundo módulo que necesite el mismo servicio (persistencia, y eventualmente auth/sync), justificando extraerlo como pilar compartido (ver ADR-0009, "Compatibilidad futura"). |
| **Design System** | No existe `packages/ui` ni ningún componente compartido — la UI mínima de Milestone 1 (5 botones HTML sin estilo) es explícitamente provisional. | La etapa Beta construya una interfaz de edición real (Toolbar/Sidebar con diseño) — el primer caso de uso real que justifique un sistema compartido en vez de estilos ad-hoc por módulo. |
| **AI Engine** | No existe ninguna funcionalidad de IA en la plataforma todavía. | Se defina la primera capacidad de IA concreta a construir — y se construya desde el principio detrás de un contrato/adaptador propio (principio "AI Provider Agnostic", ver `02-Product-Principles.md`), nunca acoplada directamente a un proveedor. |
| **Asset Library** | Solo existe el punto de extensión ya preparado en el Renderer (`resolveAssetSource`) — sin ninguna forma real de subir/gestionar assets desde la UI. | La etapa Beta lo requiera explícitamente (ver `04-Roadmap.md`). |
| **Export Engine** | No existe ningún exportador implementado — ni PNG, ni SVG, ni PDF. Sticker Builder hoy no puede producir ningún archivo de salida. | La etapa Beta implemente la primera versión (PNG/SVG) y v1.0 la versión print-ready completa (PDF con línea de corte y sangrado) — ver `04-Roadmap.md`. |

## Infraestructura y backend (ya identificados en `../ARCHITECTURE.md` §9)

Estos ya estaban registrados como diferidos desde la fase de diseño original (Foundation 0) — se listan aquí también para que este documento sea el punto único de referencia de toda la deuda deliberada del proyecto:

| Ítem | Se incorpora cuando... |
|---|---|
| Auth (Clerk/Auth.js u equivalente) | Se necesite identificar usuarios entre sesiones/dispositivos (mismo disparador que "Usuarios/cuentas" arriba). |
| Backend HTTP | El `StorageProvider` remoto (Cloud Sync) necesite un servidor real detrás. |
| Base de datos relacional (PostgreSQL) | Exista almacenamiento server-side — viene junto con el backend HTTP. |
| Cola de jobs distribuida (Redis + BullMQ) | El procesamiento de exportación deje de poder resolverse en un Web Worker del navegador (ej. exportaciones en lote server-side). |
| Object storage remoto (S3/R2) | Los assets/exports necesiten vivir fuera del navegador del usuario (ej. para compartir/sincronizar). |
| Renderers adicionales (Pixi, SVG-only, headless) | Exista un caso de uso concreto (export headless en servidor, necesidad real de performance) — el contrato `RendererAdapter` ya lo permite sin rediseño, pero no se construye especulativamente. |
| Checkout, fulfillment, integración con proveedores de impresión, white-label | Fuera de alcance del producto tal como está definido hoy (ver [`01-Product-Vision.md`](01-Product-Vision.md), "Qué NO intenta resolver") — no es solo una postergación técnica, es una decisión de qué ES y qué NO ES Impulso. |

## Deuda técnica de rendimiento (ya registrada en `../PERFORMANCE_BUDGET.md`)

Estas son decisiones de implementación con impacto de rendimiento conocido, ya documentadas con su complejidad, cuello de botella y estrategia de optimización futura — enlazadas aquí para que no queden invisibles fuera de ese documento:

- Undo/redo por snapshot completo del `Project` (no por patches) — costo en memoria proporcional al tamaño del documento por cada entrada de historial.
- Búsqueda/actualización de un `SceneObject` por id reconstruyendo el árbol completo (O(n) en el total de objetos del documento).
- Rebuild completo del Renderer en cada cambio de contenido, sin reconciliación incremental por id.
- Guardado local (Milestone 1) serializa el `Project` completo en cada click de "Guardar", sin manejo de cuota de `localStorage` agotada.

Ver `../PERFORMANCE_BUDGET.md` para el registro completo, fila por fila, con la estrategia de optimización futura de cada una.

## Cómo se usa este documento

Antes de cerrar cualquier Milestone o etapa mayor del roadmap, revisar si algo nuevo se está posponiendo deliberadamente y agregarlo aquí. No es una lista de tareas pendientes con fecha — es un mapa de "qué decidimos no construir todavía, y por qué", para que la próxima vez que alguien pregunte "¿y esto no se supone que existiría?", la respuesta ya esté escrita.
