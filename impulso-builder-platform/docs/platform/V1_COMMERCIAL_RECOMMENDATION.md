# V1 Commercial Recommendation — Fase 4.1

> Recomendación concreta y accionable para la primera venta real de Impulso, complementando ADR-0026 a 0029. Cubre identidad/cuentas, offline/activación, soporte/recuperación, UX comercial, y responde explícitamente las 14 decisiones obligatorias de la fase. No deja ninguna decisión abierta sin recomendación.

## 1. Identidad y cuentas (sección 10)

Comparadas las 3 rutas:
- **A. Sin cuenta** (clave/enlace, menor fricción, menor control) — buena para el primer comprador pero sin recuperación si pierde el enlace y Gumroad no lo cubre.
- **B. Cuenta opcional** (compra primero; cuenta solo para recuperación/updates) — balance correcto para V1.
- **C. Cuenta obligatoria** (mayor control, mayor fricción, dependencia online) — prematuro sin evidencia de que los compradores lo toleren para una "mini app".

**Recomendación**: **Ruta B, con una implementación aún más mínima en 4.1-4.3: ninguna cuenta técnica existe todavía.** La "cuenta" en V1 es, de hecho, la cuenta de Gumroad del comprador (Gumroad ya guarda su historial de compras y permite re-descargar). Impulso no construye autenticación productiva en esta fase (prohibido explícitamente). Los contratos de dominio (`Entitlement.subjectId`) se diseñan ya independientes de cualquier proveedor de identidad específico, para que una cuenta propia futura (Fase 4.5) solo tenga que rellenar `subjectId` con un `userId` real en vez de un `deviceId` — sin romper el modelo.

## 2. Estrategia offline y activación (sección 15)

- **Qué funciona offline**: todo. La app ya es 100% funcional sin red (confirmado por auditoría — cero llamadas de red en runtime hoy). La capa comercial V1 no introduce ninguna dependencia de red: `licensingMode: "delivery-only"` no valida nada en ningún momento.
- **Cuánto tiempo puede operar sin validación**: indefinidamente, en V1, porque no hay validación que expire.
- **Cómo se recupera una licencia**: en V1, re-descargando desde el historial de compras de Gumroad — no es responsabilidad de Impulso.
- **Qué ocurre si el servicio comercial está caído**: no aplica en V1 (no hay servicio comercial del que depender en runtime).
- **Qué ocurre si un usuario cambia de equipo**: puede volver a descargar/usar el mismo enlace sin restricción técnica.
- **Qué se guarda localmente**: nada relacionado con licensing en V1 (no hay licensing técnico). Los proyectos del usuario siguen guardándose exactamente como hoy (IndexedDB, sin cambios).
- **Qué nunca se guarda en texto plano**: no aplica todavía (nada sensible se guarda); la regla se mantiene como principio para cuando exista algo que proteger (ver `LICENSING_THREAT_MODEL.md`, principio 2).
- **Pérdida de conectividad no elimina acceso a proyectos existentes**: garantizado por diseño en V1 — no hay ningún mecanismo que pueda hacerlo.

## 3. Soporte y recuperación (sección 18)

Procesos conceptuales para V1 (todos manuales, sin automatización — explícitamente permitido y recomendado para esta etapa):

| Escenario | Proceso V1 |
|---|---|
| Comprador pierde acceso | Redirigir a "Recibos" de Gumroad (su cuenta o el email de confirmación) |
| Cambio de dispositivo | Ninguna acción necesaria — sin restricción técnica de dispositivo en V1 |
| Compra no reconocida | Gestionado por Gumroad (su propio soporte de pagos/disputas) |
| Reembolso | Gestionado por Gumroad; Impulso no necesita replicar ese estado (sin Entitlement técnico que revocar en V1) |
| Licencia "revocada" | No aplica en V1 (nada que revocar técnicamente) |
| Aplicación sin conexión | No es un caso de soporte — funciona por diseño |
| Actualización fallida | Soporte manual por email: reenviar el enlace/build correcto |
| Proyecto incompatible (edición inferior abre un proyecto de una superior) | Ver política de compatibilidad (`05-Technical-Debt.md`/futuro ADR de Fase 4.2) — en V1 solo existe una edición, no aplica todavía |
| Restauración de compra | Vía historial de Gumroad |

## 4. UX comercial — wireflows textuales (sección 22)

En V1, con una sola edición y `delivery-only`, la mayoría de estos flujos **no tienen UI todavía** porque no hay nada que bloquear o desbloquear. Se documentan como diseño conceptual para cuando Fase 4.2+ introduzca una segunda edición o gating real:

- **Activación inicial**: no existe pantalla de activación en V1 — la app arranca igual que hoy, sin pedir nada.
- **Producto desbloqueado / capability bloqueada**: cuando exista una segunda edición (Fase 4.2+), una feature no incluida se muestra con su nombre/beneficio visible pero deshabilitada, con un mensaje claro ("Disponible en Sticker Builder Professional") — nunca oculta sin explicación, nunca con lenguaje de urgencia/presión.
- **Licencia inválida / periodo de gracia**: no aplica en V1. Diseño futuro: un banner no bloqueante, nunca un modal que impida seguir trabajando en proyectos ya abiertos.
- **Recuperación**: un enlace visible a "¿Perdiste tu acceso?" apuntando a instrucciones de recuperación vía Gumroad.
- **Upgrade**: un botón/enlace claro desde dentro de la app hacia el listado de la edición superior (fuera de la app — sin checkout embebido en V1).
- **Bundle**: no aplica todavía (un solo producto).
- **Actualización disponible / error del servidor**: no aplica en V1 (sin verificación online).

## 5. Modelo de venta recomendado para V1 (sección 24) y Decisiones obligatorias (sección 27)

| # | Decisión | Recomendación V1 |
|---|---|---|
| 1 | Producto inicial | **Sticker Builder** como producto único, todo incluido (Standard + Professional/Print Engine en una sola edición) — no fragmentar en 2 SKUs sin evidencia de demanda diferenciada todavía |
| 2 | Canal inicial | **Gumroad** (checkout/entrega), con **Bookfluence** como landing/marketing que enlaza hacia Gumroad |
| 3 | Modelo de cobro | **Pago único** — coherente con "mini apps digitales", cero infraestructura de suscripción necesaria |
| 4 | Modelo de activación | **Entrega controlada sin validación técnica** (`licensingMode: "delivery-only"`) — Gumroad gatea quién recibe el acceso |
| 5 | Necesidad de cuenta | **No obligatoria** — la cuenta de Gumroad del comprador cubre recuperación/historial en V1 |
| 6 | Estrategia offline | **100% offline siempre** — ninguna validación de red en ningún momento |
| 7 | Backend inicial | **Ninguno** en 4.1-4.3 |
| 8 | Proveedor recomendado o neutralidad | **Neutral por ahora; si se necesita backend (Fase 4.4+), Supabase es la recomendación por defecto** (ver `COST_MODEL.md`/backend, razón: modelo relacional encaja mejor con Entitlements/Purchases que un NoSQL tipo Firebase, y reduce lock-in por ser Postgres estándar) — pero el contrato (`EntitlementService`) se diseña para no depender de esa elección |
| 9 | Modelo de capabilities | **`CapabilityId` de namespace punteado, `CapabilityProvider` con default "todo concedido"** hasta que exista una segunda edición real (ver `CAPABILITY_MODEL.md`) |
| 10 | Estrategia de empaquetado | **Un solo build, manifest-driven** (ADR-0027) — nunca forks de código por edición/cliente |
| 11 | Estrategia de actualización | **`updatePolicy: "included-minor"`**: actualizaciones menores incluidas indefinidamente con la compra; mayores (nueva edición con features nuevas) a evaluar cuando exista evidencia de demanda, nunca decidido unilateralmente ahora |
| 12 | Política de soporte | **`supportPolicy: "email"`**, manual, sin automatización — ver tabla de la sección 3 arriba |
| 13 | Datos mínimos recopilados | **Ninguno propio de Impulso.** Solo lo que Gumroad ya recopila para procesar el pago (email, país por impuestos) — Impulso no agrega telemetría productiva en 4.1 (ver política de privacidad, sección 16 del enunciado, cubierta en `05-Technical-Debt.md`/Roadmap) |
| 14 | Siguiente fase exacta | **Fase 4.2 — Product Manifest & Capabilities**: decidir la mecánica real de entrega del manifest, construir el `CapabilityProvider` real (con default "todo concedido" para no romper nada), y conectar el primer manifest real a `apps/sticker-builder` — todavía sin backend/pagos/segunda edición real |

## 6. Versionado y actualizaciones (sección 14)

Cuatro versiones distintas coexisten y no deben confundirse:
- **Versión del producto comercial** (`CommercialProduct.version`/`ProductManifest.productVersion`) — lo que el comprador percibe como "versión de Sticker Builder Professional".
- **Versión de cada paquete de código** (`@impulso/print-engine@0.5.0`, etc.) — interna, ya versionada independientemente (confirmado por auditoría).
- **Versión de schemas** (`PRINT_JOB_SCHEMA_VERSION`, `documentVersion`/`schemaVersion` del Document Schema, `schemaVersion` del nuevo `ProductManifest`) — cada una evoluciona a su propio ritmo, ya con precedente en el proyecto.
- **Versión de un proyecto guardado por el usuario** — ya modelada en Document Schema, sin cambios de esta fase.

**Canales de actualización** (`updateChannel` en el manifest): `stable` (V1, el único usado), `beta`/`internal` reservados para cuando exista un pipeline de release real (Fase 4.6) — no se activan en 4.1.

**Política para compradores de pago único**: ver decisión #11 (`included-minor`) — actualizaciones menores del mismo `productId`/edición incluidas sin costo adicional indefinidamente; una actualización mayor que agregue una edición nueva (ej. una "v2" con features que hoy no existen) se evaluaría como una decisión de producto separada, no automática.

## 7. Compatibilidad de proyectos entre ediciones (sección 23)

Con una sola edición en V1, no hay hoy ningún caso real de "proyecto de edición superior abierto en una inferior" — se documenta la política para cuando Fase 4.2+ introduzca una segunda edición, reutilizando principios ya establecidos en Document Schema (preservar campos/objetos desconocidos en vez de descartarlos):
- Nunca destruir datos de un proyecto por abrirlo en una edición que no incluye todas sus capabilities.
- Preservar cualquier `SceneObject`/metadata desconocida o no soportada por la edición actual, en vez de eliminarla al guardar.
- Mostrar qué capabilities usadas por el proyecto no están disponibles en la edición actual (mensaje claro, no silencioso).
- Permitir exportación limitada cuando sea seguro (ej. exportar a PNG aunque el proyecto tenga una configuración de imposición que la edición actual no puede re-editar).
- Nunca guardar automáticamente una versión "degradada" del proyecto sin que el usuario lo sepa.

## 8. Privacidad y telemetría (sección 16)

Separación de categorías (ninguna implementada en 4.1 — diseño para cuándo exista telemetría real, probablemente Fase 4.6+):
- **Analytics de marketing** — vive en Bookfluence/Gumroad (fuera de la app de Impulso), no en el runtime del Builder.
- **Activación** — no aplica en V1 (`delivery-only`, sin evento de activación técnica).
- **Diagnóstico / crash reporting** — no implementado en 4.1.
- **Uso de features** — no implementado en 4.1.
- **Contenido del usuario** — **nunca** se sube: por defecto, ningún asset, texto de proyecto, ni nombre de archivo sale del dispositivo del usuario sin una acción explícita suya (exportar/descargar), igual que hoy.

**Eventos mínimos futuros** (diseño, no implementación): `app_started`, `product_activated`, `export_completed`, `export_failed`, `workflow_completed` — todos sin contenido creativo adjunto, solo metadata de producto/capability/resultado.

### Por qué esta combinación y no otra
El objetivo de negocio declarado es vender una mini-app digital ya terminada (Sticker Builder + Print Engine, Epic 9 cerrada) a través de marketplaces existentes, no construir una plataforma SaaS desde cero antes de tener el primer comprador. Cada elección de arriba minimiza infraestructura nueva mientras dejando los contratos de dominio (Entitlement, Capability, ProductManifest) listos para crecer sin retrabajo — es la misma disciplina que Epic 9 aplicó al Print Engine (construir lo mínimo verificable primero, diseñar la extensión sin implementarla prematuramente).
