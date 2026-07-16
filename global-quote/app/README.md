# GLOBAL QUOTE — Módulo 1 (Cimientos)

Aplicación Next.js del sistema **GLOBAL QUOTE — Quotation & Commercial Control System** para Global Supplier MTY. Este directorio contiene el primer módulo del plan de MVP descrito en [`../docs/ARCHITECTURE.md §10`](../docs/ARCHITECTURE.md#10-plan-del-mvp-por-módulos): login, roles/permisos (RBAC) y líneas de negocio.

## Alcance de este módulo

### Módulo 1 — Cimientos
- Login con correo/contraseña (Auth.js / Credentials), sesión JWT, bloqueo tras 5 intentos fallidos.
- 7 roles (`SUPER_ADMIN`, `DIRECCION_GENERAL`, `ADMINISTRACION`, `GERENTE_VENTAS`, `VENDEDOR`, `MARKETING`, `CONSULTA`) con su matriz de permisos (`src/lib/auth/permissions.ts`), fiel a `docs/ARCHITECTURE.md §4.1`.
- 7 líneas de negocio (TSS, TLL, GFB, TFS, JUN, GTX, GSM) con asignación de usuarios por línea.
- `proxy.ts` (el `middleware.ts` de Next.js 15 se renombró a `proxy.ts` en Next 16 — ver `AGENTS.md`) protege todas las rutas autenticadas y bloquea `/admin/*` sin el permiso correspondiente; el layout de `(app)` vuelve a validar la sesión como segunda barrera.
- El dashboard demuestra la proyección de datos por rol: un Vendedor nunca recibe el bloque de costos/márgenes; un Super Admin sí.

### Módulo 2 — Líneas de negocio y configuración

- Modelo de datos: `bank_accounts` y `terms_and_conditions` (nuevos), más CRUD real sobre `business_units` — que hasta ahora solo se creaba/editaba vía `prisma/seed.ts`, sin ninguna pantalla de administración (`docs/ARCHITECTURE.md §5.2`).
- `sequence_settings` no ganó campos propios en este módulo: su única configuración real en este esquema (`folioNumberingMode`, anual/continua) ya vive en `business_units` desde el Módulo 5, así que "configurar folios" en la práctica es editar ese campo de la línea, no una pantalla aparte.
- `/admin/business-units` (permiso `admin.configure_business_units`, Super Admin únicamente): lista las líneas, permite dar de alta una nueva (`code` único e inmutable — nunca aparece en el formulario de edición, igual que `internal_sku` de productos o el folio de una cotización) y entrar al detalle de cada una para editar datos fiscales/marca (RFC, dirección, colores, margen mínimo por defecto), cuentas bancarias (alta + activar/desactivar) y términos y condiciones.
- `terms_and_conditions` es versionado igual que `product_costs` (Módulo 3): guardar una nueva versión cierra la vigente (`effective_to = ahora`) y crea una nueva — el texto anterior nunca se edita ni se borra, queda en un historial consultable en la misma página.
- `/admin/taxes` (mismo permiso): catálogo **global** de impuestos (IVA 16%, exento, tasa 0%, etc.) — no es por línea de negocio. Aplicarlos a una cotización queda fuera de este alcance; hoy es solo el catálogo de configuración que describe `docs/ARCHITECTURE.md §5.2`.
- Nav "Líneas de negocio" (antes deshabilitado desde el Módulo 1) ahora apunta a `/admin/business-units`; el hub `/admin` gana tarjetas para ambas pantallas nuevas.
- Bug real encontrado y corregido durante las pruebas e2e: el formulario de términos y condiciones usa un `<textarea>` no controlado (`defaultValue`) — al enviarlo dos veces seguidas *sin recargar la página*, el remount que refleja el nuevo valor guardado podía competir con la siguiente escritura del usuario y perder el segundo cambio. Se corrigió dándole un `key={currentTerms.id}` al formulario, para que React lo remonte de forma determinista cada vez que cambia la versión vigente (el patrón que React mismo recomienda para "resetear un campo no controlado cuando cambia su identidad subyacente").
- Probado con 8 casos de integración contra Postgres real (`tests/integration/business-units.test.ts` — alta con código único, rechazo de código duplicado incluyendo los 7 ya sembrados, edición sin tocar el código inmutable, cuentas bancarias, versionado de términos y condiciones, alta/duplicado de impuestos) y 4 e2e con Playwright (`tests/e2e/business-units.spec.ts` — un Vendedor sin el permiso no ve el nav ni puede entrar a ninguna de las dos pantallas; Super Admin da de alta una línea nueva y la configura de extremo a extremo — datos fiscales, cuenta bancaria, dos versiones de términos y condiciones —; rechazo de código duplicado; alta y baja de un impuesto).

**Fuera de este alcance**: aplicar impuestos/términos y condiciones a una cotización real (esos catálogos existen, pero `quotations` no los consume todavía); plantillas de documentos (`document_templates`, Módulo 9 ampliado); eliminar una línea de negocio o una cuenta bancaria (solo activar/desactivar, nunca borrar — mismo principio de soft-delete/append-only del resto del sistema); reglas de reinicio de folio más allá de anual/continua.

### Módulo 3 — Catálogo (alcance básico, línea GFB)
- Modelo de datos: `categories` (con subcategoría), `products`, `product_costs` (vigencias sin traslape, garantizado con un `EXCLUDE` constraint de Postgres) y `price_lists`/`price_list_items` (`docs/ARCHITECTURE.md §5.2`/`§5.3`).
- Motor de margen único (`src/lib/catalog/margin.ts`, con `decimal.js`): precio de venta = costo aterrizado / (1 - margen), nunca markup (`docs/ARCHITECTURE.md §8.1`).
- Proyección de producto por rol (`src/lib/catalog/project.ts`): un Vendedor nunca recibe `landedCost` ni `marginPct` en el objeto de respuesta, sin importar qué pida el componente — es la "frontera de seguridad de costos" de `docs/ARCHITECTURE.md §3.1`, ahora aplicada al catálogo además del dashboard.
- `/products` y `/products/[id]`: catálogo filtrado por las líneas de negocio asignadas al usuario, con una bandera visible de "por debajo del margen mínimo" para quien puede ver márgenes.
- `/products/new` y `/products/[id]/edit`: alta y edición de producto, costo y precio de lista (`Administración`/`Super Admin` únicamente — permiso `products.manage` + `products.view_costs`, revalidado en la página *y* en el Server Action, nunca solo en una capa). Editar el costo **nunca sobrescribe** la vigencia anterior: la cierra (`effective_to = ahora`) y crea una nueva fila, conservando el historial (`docs/ARCHITECTURE.md §7.3`). El formulario recalcula costo aterrizado/margen en vivo con el mismo motor de `margin.ts`.
- Catálogo demo: 12 productos ficticios de la línea GFB (Got Fresh Breath México), uno de ellos (`GFB-ENJ-004`) con un precio de lista deliberadamente viejo para demostrar la bandera de margen insuficiente (§8.2 — requeriría autorización de Dirección General).

**Fuera de este alcance** (vienen en Módulos 2/3 ampliado o después, ver `docs/ARCHITECTURE.md §10`): imágenes/documentos, kits/combos, precios por volumen/cliente, alta de categorías desde la UI.

### Módulo 4 — Clientes y contactos (alcance básico, línea GFB)
- Modelo de datos: `customers`, `customer_addresses` (fiscal/entrega — modelado en el schema, sin UI todavía), `contacts` y `payment_terms` (`docs/ARCHITECTURE.md §11`).
- Alcance de visibilidad por rol, no por campo (`src/lib/customers/scope.ts`): un Vendedor **solo ve los clientes que tiene asignados** (`assignedSellerId`); el resto de roles con permiso ve todos los clientes de sus líneas de negocio. Una cuenta sin vendedor asignado ("cuenta casa") es invisible para un Vendedor aunque esté en su línea — verificado en `tests/e2e/customers.spec.ts`.
- Dos rutas de alta en `/customers/new`, la misma página para ambos casos: un **Vendedor** crea un "prospecto" (razón social, RFC, industria, notas) que queda auto-asignado a sí mismo — no puede fijar condiciones comerciales; **Administración/Super Admin** además capturan vendedor asignado, condiciones de pago, lista de precios, línea de crédito y descuento autorizado. Ambos casos comparten un único Server Action (`createCustomerAction`) que decide qué campos aceptar según el permiso de quien llama, nunca según lo que el formulario del cliente diga tener.
- `/customers/[id]`: ficha con información comercial (proyectada por rol, igual que el catálogo) y contactos, con un formulario para agregar contactos.
- `/customers/[id]/edit`: edición completa — `Administración`/`Super Admin` únicamente.

**Fuera de este alcance**: UI de direcciones fiscal/entrega, reasignación de cartera por Gerente de Ventas (hoy solo lectura de todos los clientes de su línea), historial de cotizaciones/pedidos por cliente (esos módulos no existen todavía), documentos fiscales adjuntos.

### Módulo 5 — Motor de folios
- Modelo de datos: `sequence_settings` (`business_unit_id`, `document_type`, `year`, `last_consecutive`), único por línea/tipo/año. `year = 0` es un valor centinela para la numeración *continua* (`docs/ARCHITECTURE.md §7.1`/`§7.2`) — evita depender de `NULL` en la unique key, donde Postgres trata cada `NULL` como distinto y permitiría filas duplicadas.
- `src/lib/folio/format.ts`: funciones puras que dan forma al folio largo (`TSS-2026-07-0001-KS`), corto (`TSS-2607-0001`), de pedido (`PED-TSS-2026-0001`) y al sufijo de versión (`-V2`) — sin tocar la base de datos.
- `src/lib/folio/sequence.ts` (`reserveNextConsecutive` + `issueFolio`): el consecutivo se incrementa con un solo `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` — Postgres serializa las escrituras concurrentes sobre esa fila, así que dos solicitudes simultáneas nunca obtienen el mismo número. Probado con 50 llamadas concurrentes reales (`tests/integration/folio-sequence.test.ts`) y con un rollback deliberado que confirma que el consecutivo no avanza si la transacción que lo reservó falla.
- `/admin/sequences` (Super Admin únicamente — permiso `admin.configure_sequences`): consulta el consecutivo vigente de cada línea y tipo de documento, y emite folios de prueba reales para verificar el motor antes de que exista el módulo de cotizaciones.

**Fuera de este alcance**: el motor no tiene todavía ningún documento real (cotización/pedido) que lo consuma — eso es el Módulo 6. La emisión desde `/admin/sequences` es un diagnóstico, no un documento de negocio.

### Módulo 6 — Cotizaciones (núcleo, línea GFB)
- Modelo de datos: `quotations`, `quotation_items`, `quotation_status_history` (`docs/ARCHITECTURE.md §6`/`§5.2`). El folio se emite dentro de la **misma transacción** que crea el borrador (`issueFolioInTransaction`, refactor de Módulo 5) — si la creación falla después, el consecutivo se revierte con ella (`docs/ARCHITECTURE.md §7.2`/`§7.4`, folio al primer guardado, no antes).
- Resolución automática de precio (`src/lib/quotations/pricing.ts`): lista de precios del cliente si tiene una asignada, si no la lista activa de la línea; `specialPrice` gana sobre `listPrice`. Si no hay precio vigente para ese producto/cliente, el sistema **no permite agregarlo** (`docs/ARCHITECTURE.md §8.2`).
- Margen y autorización (`recomputeQuotationTotals` en `src/lib/quotations/mutations.ts`, reutilizando el motor de `catalog/margin.ts`): cada partida guarda una foto de su costo aterrizado y margen mínimo al agregarse; la cotización completa se marca `requiresApproval` si **cualquier** partida queda por debajo de su margen mínimo, o si el descuento aplicado excede el `discountLimitPct` del vendedor (5% para el Vendedor demo, 10% para el Gerente de Ventas demo — antes sin usar, ahora sembrado). Al enviar, una cotización marcada va a `PENDING_APPROVAL` en vez de `SENT`.
- `/quotations`, `/quotations/new`, `/quotations/[id]`: alcance de visibilidad por rol igual que clientes (`src/lib/quotations/scope.ts` — un Vendedor solo ve/edita las suyas); alta de encabezado (cliente + vigencia + notas) seguida de alta de partidas una por una (mismo patrón que "agregar contacto" — se prefirió sobre un formulario de líneas dinámicas por simplicidad y robustez); quitar partidas y enviar, ambos bloqueados fuera de `DRAFT` (matiz de "no editar una cotización enviada" — el versionado real es Módulo 8).

**Fuera de este alcance** (ver `docs/ARCHITECTURE.md §10`): workflow de autorización con registro propio (`quotation_approvals`, Módulo 7 — hoy solo hay una bandera + motivo, sin pantalla de aprobar/rechazar), versionado tras el envío (Módulo 8), PDF (Módulo 9), descuento global (solo por partida), moneda distinta a MXN.

### Módulo 7 — Autorizaciones (línea GFB)
- Modelo de datos: `quotation_approvals` (`docs/ARCHITECTURE.md §12`) — una fila por excepción, con `ruleType`, motivo, quién la solicitó y con qué justificación, y (una vez resuelta) quién decidió, cuándo y con qué nota. Guarda además una foto del margen de la cotización al momento de solicitarla (`marginPctBefore`), para auditoría.
- Motor de reglas puro (`src/lib/quotations/approval-rules.ts`, sin tocar la base de datos — probado con 15 casos unitarios): `computeApprovalTriggers` evalúa cuatro reglas — margen de alguna partida por debajo de su mínimo, total mayor a $500,000 MXN, vigencia mayor a 30 días, y descuento por partida por encima del límite del vendedor — y las reporta ordenadas por severidad. `canApproveRule(rol, tipoDeRegla)` es una segunda matriz de autoridad, **más fina que el permiso general** `quotations.approve_exception`: Administración tiene el permiso (puede entrar al panel), pero no tiene autoridad sobre margen ni descuento en este alcance — solo Dirección General decide margen/monto, y Dirección General o Gerente de Ventas deciden vigencia/descuento. Super Admin puede todo.
- Al enviar una cotización marcada (`submitQuotation` en `mutations.ts`), el vendedor debe capturar una justificación obligatoria; se crea la fila de `quotation_approvals` con la regla de mayor severidad como principal y la cotización pasa a `PENDING_APPROVAL`.
- `/approvals` (permiso `quotations.approve_exception`, nav "Autorizaciones"): bandeja de excepciones pendientes de las líneas de negocio del usuario, filtrada en memoria por `canApproveRule` (Prisma no puede expresar esa lógica en un `where`) — cada quien solo ve las excepciones sobre las que de verdad tiene autoridad de decisión, no todas las que el permiso general le dejaría ver. Aprobar (`decideApproval` en `src/lib/quotations/approvals.ts`) envía la cotización a `SENT`. **Rechazar la regresa a `DRAFT`, no a un estado terminal** — es un rechazo interno de la excepción, no un rechazo del cliente (ese es el estado `REJECTED` de la cotización, sin relación); el vendedor corrige y puede volver a enviarla, generando una nueva fila de aprobación. Rechazar exige una nota de motivo.
- `/quotations/[id]` ahora incluye el historial completo de autorizaciones de esa cotización (solicitudes, justificaciones, decisiones y notas), visible para cualquiera con acceso a la cotización.
- Probado con 15 casos unitarios (`tests/unit/approval-rules.test.ts`), 6 casos de integración contra Postgres real (`tests/integration/quotation-approvals.test.ts` — aprobar, rechazar, rol sin autoridad, Administración sin autoridad pese al permiso, doble decisión, ciclo completo de rechazo→corrección→reenvío→aprobación) y 5 casos e2e con Playwright (`tests/e2e/approvals.spec.ts`).

**Fuera de este alcance**: notificaciones (correo/push) al solicitar o decidir una excepción, un registro de auditoría separado del propio historial de `quotation_approvals`, autorización en cascada (varias reglas de la misma cotización requiriendo decisiones independientes — hoy se crea una sola fila con la regla de mayor severidad), reglas de crédito especial (dependen de un módulo de crédito que no existe todavía).

### Módulo 9 — PDF (línea GFB)

Construido saltándose el Módulo 8 (versionado) a petición explícita — en ese momento la plantilla siempre imprimía "Versión 1". El Módulo 8 se construyó después (ver más abajo) y hoy el PDF refleja la versión real de la cotización.

- Motor de render server-side con `@react-pdf/renderer` (no Playwright/Chromium headless, la otra opción del stack en `docs/ARCHITECTURE.md §3`): produce un PDF determinista sin depender de un navegador en el proceso del servidor, y su modelo de layout (`View`/`Text` con flexbox) encaja mejor con una plantilla tabular que un render HTML→PDF genérico. `src/lib/pdf/quotation-document.tsx` es la plantilla; `src/lib/pdf/render-quotation-pdf.tsx` carga la cotización completa y genera el QR (`qrcode`) antes de invocar `renderToBuffer`.
- Encabezado de marca (logo textual, RFC, dirección, franja de color) y encabezado de columnas de la tabla van `fixed` — se repiten en cada página, igual que el pie con "Página X de Y" — para que una cotización con muchas partidas no pierda contexto al paginar. Probado con 50 partidas reales (`tests/integration/quotation-pdf.test.ts`, verificado con `pdf-lib` que el resultado ocupa más de una página).
- Datos fiscales/marca por línea (`business_units.legal_name/tax_id/address/color_primary`) ya existían en el modelo desde Módulo 1 pero sin sembrar — esta es la primera vez que se usan; solo GFB los tiene capturados en el seed (`prisma/seed.ts`), el resto queda en `null` hasta que existan como líneas reales.
- El QR del pie **no apunta a una URL pública** (no existe todavía un dominio de verificación desplegado): codifica folio, versión y total para poder cotejarlos manualmente contra el documento. Un endpoint real de verificación queda fuera de este alcance.
- Bloqueo de generación (`src/lib/quotations/pdf-gate.ts`, función pura `canGenerateQuotationPdf`): no se genera PDF de una cotización en `DRAFT` ni en `PENDING_APPROVAL`, para cualquier rol — coincide con la matriz de permisos (`docs/ARCHITECTURE.md §4.1`, "Generar/descargar PDF: Vendedor solo si autorizada"; en este alcance esa condición es la misma para todos los roles, no solo para el Vendedor). El permiso general `quotations.generate_pdf` decide quién puede intentarlo; el estado de la cotización decide si se le permite en ese momento.
- `/quotations/[id]/pdf` (Route Handler, no una página — no hereda el layout de `(app)`, así que revalida sesión, permiso y alcance de visibilidad como cualquier acción): descarga el PDF si el rol tiene el permiso, la cotización está en el alcance de visibilidad del usuario, y su estado lo permite; devuelve 403 si está bloqueada, 404 si no existe o está fuera de alcance. El enlace "Descargar PDF" en `/quotations/[id]` solo se muestra cuando ambas condiciones se cumplen.
- El folio que imprime el PDF usa `displayFolio` (Módulo 8) — bare para la versión 1, con sufijo `-V{n}` a partir de la versión 2 — además de la etiqueta de texto "Versión N" que ya traía desde este módulo.
- Probado con 2 casos unitarios (`tests/unit/quotation-pdf-gate.test.ts`), 3 de integración contra Postgres real (`tests/integration/quotation-pdf.test.ts` — PDF válido de una página, PDF de más de una página con 50 partidas, error al pedir un id inexistente) y 4 e2e con Playwright (`tests/e2e/quotation-pdf.spec.ts` — descarga real de una cotización enviada, bloqueo en borrador, bloqueo en pendiente de autorización, redirección de Marketing sin el permiso).

**Fuera de este alcance**: envío por correo con el PDF adjunto, plantillas específicas por línea más allá de GFB (logo real como imagen, no solo texto — no hay `logo_url` sembrado), endpoint público de verificación del QR, exportación a otros formatos.

### Módulo 8 — Versionado (línea GFB)

Construido después del Módulo 9 (PDF), que se había saltado adelante a petición explícita — este módulo es lo que hace que el "Versión N" que el PDF ya imprimía deje de ser siempre 1.

- Modelo de datos: `quotation_versions` (`docs/ARCHITECTURE.md §7.3`) — una fila por versión ya congelada, con un `snapshot` JSON del estado completo (status, montos, partidas) *anterior* al cambio que la generó, quién la generó y cuándo. Único por `(quotationId, versionNumber)`; nunca se edita ni se borra (cascada solo si se borra la cotización completa).
- `freezeQuotationVersionSnapshot` (`src/lib/quotations/mutations.ts`): antes de aplicar un cambio a una cotización ya enviada, congela su estado actual (con la versión que tenía hasta ese momento) y sube `quotations.current_version` en 1. Los montos se guardan como string en el JSON porque `Json` no serializa instancias de `Decimal`.
- `addQuotationItem`/`removeQuotationItem` ahora aceptan editar una cotización en `SENT` o `ACCEPTED` (antes solo `DRAFT`) — dispara el congelamiento automáticamente. `PENDING_APPROVAL` sigue bloqueada a propósito (no tiene sentido cambiar el contenido mientras una excepción está a medio decidir), igual que los estados terminales (`REJECTED`/`CANCELLED`/`EXPIRED`/`CONVERTED_TO_ORDER`).
- Autorización: editar una cotización ya enviada requiere el permiso `quotations.edit_approved` (`EDIT_APPROVED_QUOTATION`) — Super Admin/Administración únicamente (`docs/ARCHITECTURE.md §4.1`), resuelto en la capa de Server Action (`src/app/(app)/quotations/actions.ts`, `requiredItemEditPermission`) según el estado actual de la cotización, nunca en `mutations.ts` (esa capa solo conoce invariantes de estado, no roles).
- `src/lib/folio/format.ts`: nueva función pura `displayFolio(folio, currentVersion)` — la versión 1 se muestra sin sufijo (no rompe lo que Módulos 6/9 ya mostraban), el sufijo `-V{n}` aparece a partir de la versión 2.
- `/quotations/[id]` muestra el folio con `displayFolio`, un aviso cuando una edición post-envío va a congelar una versión, y una nueva sección "Historial de versiones" con cada snapshot congelado (monto, número de partidas, quién y cuándo editó).
- Probado con 1 caso unitario extra en `tests/unit/folio-format.test.ts` (`displayFolio`), 11 de integración contra Postgres real (2 en `tests/integration/quotation-mutations.test.ts` + 9 en `tests/integration/quotation-versioning.test.ts` — congela y sube versión al agregar/quitar, snapshots inmutables y consultables tras varias ediciones, edita `ACCEPTED` igual que `SENT`, rechaza editar en cada estado no editable) y 3 e2e con Playwright (`tests/e2e/quotation-versioning.spec.ts` — Administración edita y ve el folio con `-V2` y el historial, un Vendedor y un Gerente de Ventas sin el permiso no ven los controles de edición).

**Fuera de este alcance**: editar campos de encabezado (vigencia, notas) tras el envío — solo agregar/quitar partidas; volver a disparar una autorización si una edición post-envío hace que la cotización pase a requerirla (la bandera `requiresApproval` se recalcula, pero el estado no regresa a `PENDING_APPROVAL` automáticamente); notificar a alguien cuando se crea una nueva versión.

### Módulo 10 — Auditoría (transversal)

- Modelo de datos: `audit_logs` (`docs/ARCHITECTURE.md §5.2`) — `entity_type`/`entity_id` polimórfico (sin FK real: una entidad puede borrarse y su historial de auditoría sigue existiendo, que es el comportamiento correcto), `user_id`, `action`, `field_changed`/`old_value`/`new_value`, `reason`, `occurred_at`. `ip_address` está en el schema por fidelidad con el documento pero no se captura todavía (requeriría leer `headers()` en cada Server Action — fuera de este alcance).
- **Append-only reforzado con triggers de Postgres, no con `GRANT`/`REVOKE`**: el rol de conexión de la app es *dueño* de la tabla (la creó al correr la migración), y Postgres siempre le da al dueño de una tabla todos los privilegios sin importar lo que diga un `REVOKE` — así que esa ruta no habría funcionado. Un trigger `BEFORE UPDATE`/`BEFORE DELETE` que lanza una excepción incondicional sí funciona para cualquier rol, incluido el dueño — verificado con SQL crudo contra la tabla real (`tests/integration/audit-log.test.ts`), no solo a nivel de convención de la aplicación.
- No es middleware transparente de Prisma: se llama explícitamente (`recordAuditLog`/`diffSensitiveFields` en `src/lib/audit/log.ts`) desde cada mutación que toca un campo sensible, con el mismo `actorId` explícito que ya usa el resto del sistema — se prefirió sobre una capa de contexto implícito (`AsyncLocalStorage`) que habría sido la primera de su tipo en este código base.
- Campos sensibles auditados en este alcance (los dos puntos de mutación que ya existían y tocan datos comercialmente sensibles): `updateCustomerCommercialInfo` (crédito, descuento autorizado, vendedor asignado) y `replaceProductCost` (costo aterrizado, margen mínimo — comparado contra la vigencia anterior; la primera vigencia de un producto no tiene "antes" que auditar). Cambios de rol o de línea de negocio asignada a un usuario (`docs/ARCHITECTURE.md §4.2`) quedan fuera: ese CRUD de usuarios no existe todavía (llegaría con el Módulo 2 o uno de gestión de usuarios).
- `/admin/audit` (permiso `admin.view_audit`, nav "Auditoría"): Super Admin y Dirección General ven todo; **Administración tiene acceso "parcial"** (`docs/ARCHITECTURE.md §4.1`) — `auditVisibleEntityTypes` (`src/lib/audit/scope.ts`) la limita a su propio dominio comercial (`Customer`, `Product`), resuelto en el servidor y no solo en las opciones del `<select>`, para que no se pueda burlar editando el query string a mano. Filtros por entidad, usuario y rango de fechas vía formulario `GET`.
- Probado con 6 casos unitarios (`tests/unit/audit-log.test.ts` — el diff de campos sensibles y el alcance por rol), 4 de integración contra Postgres real (`tests/integration/audit-log.test.ts` — se audita crédito/descuento/vendedor pero no campos no sensibles, no se audita si nada sensible cambió, se audita el reemplazo de costo pero no la primera vigencia, y el trigger de append-only rechaza `UPDATE`/`DELETE` crudos) y 5 e2e con Playwright (`tests/e2e/audit.spec.ts` — editar cliente/producto reales genera el registro visible en `/admin/audit`, Super Admin y Administración lo consultan, un Vendedor sin el permiso es redirigido).

**Fuera de este alcance**: captura de `ip_address`; auditoría de cambios de rol/línea de negocio de usuarios (no existe el CRUD de usuarios todavía); búsqueda de texto libre y exportación (`/admin/audit` avanzado es Módulo 15, Fase 2); un middleware genérico de Prisma que audite automáticamente cualquier modelo sin llamada explícita.

### Módulo 11 — Seguimiento (línea GFB, primer módulo de Fase 2)

- Modelo de datos: `quotation_followups` (`docs/ARCHITECTURE.md §5.2`) — medio de contacto, próximo seguimiento, probabilidad de cierre, competidor/objeción/comentarios, quién lo registró. `weighted_amount` es "calculado" (§5.2): **nunca se guarda**, se deriva de `total × close_probability_pct / 100` al leerlo (`computeWeightedAmount` en `src/lib/followups/rules.ts`), igual de puro que el motor de reglas de autorización del Módulo 7.
- Nuestra máquina de estados (Módulo 6) colapsa "Enviada/Vista por cliente/En seguimiento/Negociación" del brief (`docs/ARCHITECTURE.md §6.1`) en un solo estado `SENT` — así que la regla de vencimiento automático ("se dispara cuando `now() > valid_until` y el estado sigue en alguno de esos cuatro") se simplifica aquí a `status === "SENT"` (`isQuotationExpired`).
- **Vencimiento automático** (`expireOverdueQuotations`): no hay un proceso siempre-activo en esta app que lo dispare solo (`docs/ARCHITECTURE.md §3`: "Cron job ligero — Vercel Cron o worker dedicado" es infraestructura de despliegue, no código de la aplicación). Se expone de dos formas: `/api/cron/expire-quotations` (protegido con un secreto compartido `CRON_SECRET` en el header `Authorization: Bearer …`, el mismo patrón que usa Vercel Cron — por eso ese path se excluyó del matcher de `proxy.ts`, no necesita ni puede llevar sesión de usuario) y `/admin/followups` (Super Admin, disparo manual/diagnóstico, mismo espíritu que la emisión de folios de prueba del Módulo 5). Cada transición queda en `quotation_status_history` — como no hay sesión humana en un disparo real por cron, se atribuye a un actor "sistema" (`resolveSystemActorId`, el Super Admin activo más antiguo — documentado explícitamente como una convención, no una cuenta de servicio real, que no existe todavía).
- `/followups`: cotizaciones agrupadas en Vencidos · Hoy · Próximos · Sin programar · Completados (`docs/ARCHITECTURE.md §9` — "Completados" es cualquier estado terminal, sin importar qué diga la fecha de próximo seguimiento), con el mismo alcance de visibilidad por rol que `/quotations` (`quotationScopeWhere`, reutilizado sin cambios).
- `/quotations/[id]` gana una sección "Seguimiento": formulario para registrar uno nuevo (solo si la cotización está `SENT`) e historial de los ya registrados. Solo tiene sentido sobre una cotización enviada y todavía viva, nunca sobre un borrador ni una ya cerrada.
- Probado con 11 casos unitarios (`tests/unit/followup-rules.test.ts` — vencimiento, los cinco buckets, el cálculo de monto ponderado), 4 de integración contra Postgres real (`tests/integration/followups.test.ts` — alta de seguimiento, rechazo sobre un borrador, vencimiento automático que respeta vigencia y dejar sanas las demás, idempotencia de correr la tarea dos veces) y 5 e2e con Playwright (`tests/e2e/followups.spec.ts` — un Vendedor registra un seguimiento real y lo ve en `/followups`; no se ofrece sobre un borrador; Super Admin vence una cotización real desde `/admin/followups`; un rol sin el permiso no entra; el endpoint de cron exige el secreto y funciona sin sesión de usuario).

**Fuera de este alcance**: envío real de recordatorios (correo/WhatsApp) — esta app no tiene integración de correo transaccional todavía, así que "recordatorio automático" aquí es solo detectar y agrupar qué necesita seguimiento, no notificar a nadie; conversión a pedido (Módulo 12); dashboards que consuman estos datos (Módulo 13); apertura de correo rastreada (`opened_at` no existe en el modelo, requeriría un pixel de tracking).

### Módulo 12 — Pedidos (línea GFB)

Este módulo también cierra un hueco abierto desde el Módulo 6: `QuotationStatus.ACCEPTED` y `.REJECTED` existían en el enum (y en el diagrama de estados de `docs/ARCHITECTURE.md §6.1`) desde el principio, pero ninguna mutación los alcanzaba nunca — una cotización `SENT` solo podía pasar a `EXPIRED` (Módulo 11) o, editándola, generar una nueva versión. Sin una forma de marcar `ACCEPTED`, "convertir a pedido" no tenía nada que convertir.

- **No hay portal de cliente** (eso es Fase 3 — `docs/ARCHITECTURE.md §10`): `markQuotationAccepted`/`markQuotationRejectedByClient` (`src/lib/quotations/mutations.ts`) las dispara un humano — vendedor o Administración — que registra lo que el cliente decidió por el canal que haya usado (llamada, correo, WhatsApp), no una firma electrónica ni una confirmación automática. Ambas exigen que la cotización esté en `SENT`; el rechazo además exige un motivo (`quotation_status_history.note`). Se gatean con el mismo permiso que registrar seguimiento (`quotations.create`, Módulo 11) — es la misma persona haciendo el mismo trabajo de atender al cliente, no una capacidad nueva.
- Modelo de datos: `orders`/`order_items` (`docs/ARCHITECTURE.md §5.2`) — `orders.quotation_id` es `@unique`, así que la relación es 1:1 y la base de datos, no solo la mutación, impide convertir la misma cotización dos veces. `order_items` es una **copia congelada** de `quotation_items` al momento de la conversión, no una referencia viva: como `CONVERTED_TO_ORDER` es un estado terminal para la cotización, sus partidas ya no pueden cambiar, pero el pedido tampoco debería depender de leer la cotización para saber qué se vendió.
- `convertQuotationToOrder` (`src/lib/orders/mutations.ts`): conversión con un clic dentro de una sola transacción — exige `status === "ACCEPTED"`, emite el folio de pedido (serie `PED-{LINEA}-{AÑO}-{CONSECUTIVO}`, **ya construida desde el Módulo 5** como una serie independiente de la de cotizaciones — este módulo solo la usa por primera vez), copia las partidas, y mueve la cotización a `CONVERTED_TO_ORDER` con su entrada en `quotation_status_history`. Requiere `quotations.convert_to_order` (`CONVERT_TO_ORDER`) — Super Admin/Administración únicamente (`docs/ARCHITECTURE.md §4.1`), a diferencia de registrar la decisión del cliente, que sí puede hacer el vendedor.
- `/quotations/[id]` gana dos secciones nuevas: "Decisión del cliente" (botones Aceptar/Rechazar, visibles solo en `SENT`) y "Pedido" (botón "Convertir a pedido" visible solo en `ACCEPTED` para quien tenga el permiso; si la cotización ya se convirtió, un enlace directo al pedido resultante en su lugar).
- `/orders` (nav "Pedidos", antes deshabilitado) y `/orders/[id]`: listado y detalle con el mismo alcance de visibilidad por rol que `/quotations` (`orderScopeWhere` en `src/lib/orders/scope.ts`, mismo criterio que `quotationScopeWhere` — quien podía ver la cotización original puede ver el pedido).
- Probado con 7 casos de integración contra Postgres real (`tests/integration/orders.test.ts` — aceptar/rechazar solo desde `SENT` con su historial, convertir una cotización aceptada con folio `PED-` real y partidas congeladas, rechazo de convertir una cotización que no está `ACCEPTED`, rechazo de convertir la misma cotización dos veces) y 3 e2e con Playwright (`tests/e2e/orders.spec.ts` — un Vendedor acepta y no puede convertir, Administración sí convierte y ambos ven el pedido enlazado desde la cotización y desde `/orders`; un Vendedor rechaza con motivo; una cotización `SENT` no ofrece el botón de convertir).

**Fuera de este alcance**: cancelar un pedido ya confirmado (`OrderStatus.CANCELLED` existe en el modelo pero sin mutación/acción todavía — quedaría gateado con `quotations.cancel`, igual que cancelar una cotización); reportes/dashboards que consuman pedidos (Módulo 13); cualquier paso posterior a la conversión (surtido, facturación, CFDI — Fase 3).

## Requisitos

- Node.js 20.9+
- PostgreSQL 14+ (local o en contenedor)

## Instalación

```bash
npm install
cp .env.example .env.local   # completa DATABASE_URL, AUTH_SECRET y CRON_SECRET (openssl rand -base64 32 para ambos)
```

## Base de datos

```bash
npx prisma migrate dev   # aplica prisma/migrations/*
npm run db:seed          # crea las 7 líneas, 7 roles y 7 usuarios demo
```

### Credenciales de demo (`prisma/seed.ts`)

Contraseña compartida: **`GlobalQuote2026!`**

| Correo | Rol |
|---|---|
| ana.torres@globalsuppliermty.com | Super Administrador |
| direccion.general.demo@globalsuppliermty.com | Dirección General |
| laura.gonzalez@globalsuppliermty.com | Administración |
| carlos.medina@globalsuppliermty.com | Gerente de Ventas (TSS, TLL) |
| diego.ramirez@globalsuppliermty.com | Vendedor (TSS) |
| sofia.hernandez@globalsuppliermty.com | Marketing |
| consulta.demo@globalsuppliermty.com | Consulta |

Estos son datos ficticios (instrucción del brief §27/§28): ningún nombre ni correo corresponde a una persona real de la empresa.

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`.

## Pruebas

```bash
npm run test        # unit + integración (vitest) — requiere Postgres migrado y sembrado
npm run test:e2e     # e2e (Playwright) — requiere `npm run dev` corriendo en :3100 o E2E_BASE_URL
```

- `tests/unit/permissions.test.ts`: la matriz de permisos completa (¿quién ve costos? ¿quién configura folios?) sin tocar la base de datos.
- `tests/unit/margin.test.ts`: la fórmula de margen (incluye el ejemplo del brief: costo 1000, margen 30% → 1428.57) y que nunca coincide con un cálculo de markup.
- `tests/unit/catalog-project.test.ts`: la proyección de producto por rol, con el caso real de `GFB-ENJ-004` por debajo del margen mínimo.
- `tests/integration/login.test.ts`: login real contra la base de datos sembrada para los 7 roles, más bloqueo por intentos fallidos y cuentas inactivas.
- `tests/integration/catalog.test.ts`: el catálogo sembrado de GFB, y que el `EXCLUDE` constraint de `product_costs` rechaza dos vigencias abiertas para el mismo producto.
- `tests/integration/catalog-mutations.test.ts`: las funciones de mutación (`createProductWithCostAndPrice`, `replaceProductCost`, ...) contra Postgres real — SKU duplicado rechazado, historial de costos preservado al recostear.
- `tests/unit/customer-scope.test.ts`: el alcance de visibilidad de clientes por rol.
- `tests/integration/customer-mutations.test.ts`: alta de prospecto vs. alta completa, edición y alta de contacto contra Postgres real.
- `tests/unit/folio-format.test.ts`: los cuatro formatos de folio contra los ejemplos exactos del brief.
- `tests/integration/folio-sequence.test.ts`: 50 reservas de consecutivo concurrentes sin colisión, un rollback que no avanza el contador, series independientes por tipo de documento, y `issueFolio` de extremo a extremo.
- `tests/unit/quotation-scope.test.ts`: el alcance de visibilidad de cotizaciones por rol.
- `tests/integration/quotation-mutations.test.ts`: resolución de precio (lista del cliente vs. default de línea), folio real emitido atómicamente con el borrador, cálculo de margen/total al agregar y quitar partidas, las dos rutas que disparan `requiresApproval` (margen bajo el mínimo, descuento sobre el límite del vendedor), las transiciones de envío (`SENT` vs. `PENDING_APPROVAL`), el rechazo de un envío sin justificación, y la fila de `quotation_approvals` creada con su justificación y foto de margen.
- `tests/unit/approval-rules.test.ts`: las cuatro reglas de `computeApprovalTriggers` (margen, monto, vigencia, descuento) en sus límites exactos, el orden por severidad cuando varias reglas disparan a la vez, y la matriz completa de `canApproveRule` por rol.
- `tests/integration/quotation-approvals.test.ts`: `decideApproval` contra Postgres real — aprobar envía a `SENT`, rechazar exige nota y regresa a `DRAFT` (no a un estado terminal), un rol sin autoridad sobre la regla es rechazado, Administración es rechazada pese a tener el permiso general, una autorización ya decidida no puede volver a decidirse, y el ciclo completo de rechazo → corrección → reenvío → aprobación.
- `tests/unit/quotation-pdf-gate.test.ts`: `canGenerateQuotationPdf` en sus dos estados bloqueados (`DRAFT`, `PENDING_APPROVAL`) y los seis permitidos.
- `tests/integration/quotation-pdf.test.ts`: `renderQuotationPdf` contra Postgres real — un PDF válido de una página con los datos de marca de GFB sembrados, un PDF de más de una página con 50 partidas reales (verificado con `pdf-lib`, sin parsear el contenido), y el error al pedir un id que no existe.
- `tests/integration/quotation-versioning.test.ts` y 2 casos extra en `tests/integration/quotation-mutations.test.ts`: congelar y subir versión al agregar o quitar una partida de una cotización `SENT`/`ACCEPTED`, snapshots inmutables y consultables tras varias ediciones sucesivas, rechazo de edición en `PENDING_APPROVAL` y en cada estado terminal.
- `tests/unit/audit-log.test.ts`: `diffSensitiveFields` (solo reporta lo que de verdad cambió, incluidas transiciones a/desde `null`, comparación estable de valores tipo `Decimal`) y `auditVisibleEntityTypes` por rol.
- `tests/integration/audit-log.test.ts`: se audita crédito/descuento/vendedor asignado al cambiar pero no campos no sensibles, no se audita si nada sensible cambió, se audita el reemplazo de costo/margen pero no la primera vigencia de un producto, y — el más importante — una prueba contra SQL crudo que confirma que el trigger de `audit_logs` rechaza `UPDATE`/`DELETE` incluso desde el rol dueño de la tabla.
- `tests/integration/business-units.test.ts`: alta de línea con código único, rechazo de código duplicado (incluidos los 7 ya sembrados), edición sin tocar el código inmutable, cuentas bancarias, versionado de términos y condiciones (misma mecánica que `product_costs`), alta y duplicado de impuestos.
- `tests/unit/followup-rules.test.ts`: `isQuotationExpired` (solo `SENT` vence, y solo pasada su vigencia), los cinco buckets de `followupBucket` (cualquier estado terminal es "Completado" sin importar la fecha), y `computeWeightedAmount`.
- `tests/integration/followups.test.ts`: alta de seguimiento sobre una cotización enviada, rechazo sobre un borrador, vencimiento automático que respeta la vigencia real y deja sanas las demás cotizaciones, e idempotencia (correr la tarea dos veces no re-vence ni duplica historial).
- `tests/integration/orders.test.ts`: `markQuotationAccepted`/`markQuotationRejectedByClient` solo desde `SENT` (con su historial y, en el rechazo, el motivo), y `convertQuotationToOrder` — folio `PED-` real emitido dentro de la transacción, partidas congeladas idénticas a las de la cotización, rechazo de convertir una cotización que no está `ACCEPTED`, rechazo de convertir la misma cotización dos veces.
- `tests/e2e/login.spec.ts`, `tests/e2e/products.spec.ts`, `tests/e2e/product-crud.spec.ts`, `tests/e2e/customers.spec.ts`, `tests/e2e/sequences.spec.ts`, `tests/e2e/quotations.spec.ts`, `tests/e2e/approvals.spec.ts`, `tests/e2e/quotation-pdf.spec.ts`, `tests/e2e/quotation-versioning.spec.ts`, `tests/e2e/audit.spec.ts`, `tests/e2e/business-units.spec.ts`, `tests/e2e/followups.spec.ts` y `tests/e2e/orders.spec.ts`: navegador real — contraseña incorrecta, redirección sin sesión, RBAC del dashboard/catálogo/clientes/folios/cotizaciones/autorizaciones/PDF/versionado/auditoría/líneas de negocio/seguimiento/pedidos, el flujo completo de alta/edición de producto y de cliente, la emisión de folios de prueba consecutivos, una cotización real creada con partidas agregadas y enviada (caso sano y caso que requiere autorización), el flujo completo de autorización (Dirección General aprobando o rechazando, Gerente de Ventas y Administración viendo una bandeja vacía para una excepción de margen sobre la que no tienen autoridad, Marketing sin acceso al panel), la descarga real de un PDF (enlace visible y ruta que responde `application/pdf` solo cuando corresponde; 403 en borrador o pendiente de autorización; redirección de Marketing sin el permiso), una edición real de una cotización enviada por Administración (folio con `-V2`, historial de versiones visible; un Vendedor y un Gerente de Ventas sin el permiso no ven los controles), una edición real de cliente/producto que genera un registro de auditoría visible en `/admin/audit` (Super Admin y Administración lo consultan, un Vendedor sin el permiso es redirigido), el alta de una línea de negocio nueva configurada de extremo a extremo (datos fiscales, cuenta bancaria, dos versiones de términos y condiciones, un impuesto), el seguimiento de una cotización real (un Vendedor lo registra y lo ve agrupado en `/followups`; Super Admin vence una cotización real desde `/admin/followups`; el endpoint de cron exige su secreto y funciona sin sesión de usuario), y la conversión de un pedido real (un Vendedor acepta la decisión del cliente pero no puede convertir; Administración sí convierte y ambos ven el pedido con folio `PED-` enlazado desde la cotización y desde `/orders`; un Vendedor rechaza con motivo; una cotización sin aceptar no ofrece el botón de convertir).

> **Nota del entorno de pruebas:** Next.js 16 solo permite peticiones de assets de desarrollo (HMR, chunks) desde `localhost` por defecto (`allowedDevOrigins`). Acceder al servidor de desarrollo desde `127.0.0.1` rompe la hidratación del cliente en silencio (sin error visible) — usa siempre `http://localhost:<puerto>`, tanto a mano como en `playwright.config.ts` (`E2E_BASE_URL`).

## Estructura

```
app/
├── prisma/
│   ├── schema.prisma          # business_units, roles, users, user_business_units
│   ├── migrations/
│   └── seed.ts
├── proxy.ts                    # antes "middleware.ts" — protección de rutas + RBAC de /admin
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   └── (app)/dashboard/
│   │       └── layout.tsx      # sidebar, header, RBAC de navegación
│   └── lib/
│       ├── auth/                # auth.ts (Auth.js), permissions.ts, verify-credentials.ts
│       └── prisma/client.ts     # PrismaClient con adapter-pg (Prisma 7)
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Notas de implementación

- **Prisma 7** ya no acepta `url` en el bloque `datasource` del schema ni construye un `PrismaClient()` sin adaptador: la URL vive en `prisma.config.ts` y el cliente se crea con `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` (`src/lib/prisma/client.ts`).
- **Next.js 16** renombró `middleware.ts` a `proxy.ts`; el archivo en la raíz de este proyecto ya usa la convención nueva.
- `import "server-only"` en `lib/prisma/client.ts` y `lib/auth/verify-credentials.ts` impide que esos módulos (con costos, contraseñas y la cadena de conexión) terminen en el bundle del cliente — el build de Next falla si eso ocurre. Vitest resuelve `server-only` a su build vacío (`vitest.config.ts`) porque no corre bajo el bundler de Next.
- `lib/auth/session.ts` (`requireSession()`) reemplaza el patrón `session!.user` en todas las páginas: si `auth()` devuelve `null` en un punto donde no debería (JWT expirado entre el proxy y el render, por ejemplo), redirige a `/login` en vez de tronar con una excepción — se detectó en la práctica al construir el CRUD de productos.
- Las páginas que requieren un permiso (`/products/new`, `/products/[id]/edit`, `/customers/new`, `/customers/[id]/edit`) usan `redirect("/dashboard?error=forbidden")`, igual que `proxy.ts`, en vez de `notFound()` — consistente en toda la app y más fácil de verificar en pruebas e2e.
- Otro bug real que solo apareció al probar en navegador: `AddContactForm` no tenía un input `area`, pero `contactSchema` lo declaraba requerido — `formData.get("area")` devolvía `null` y Zod lo rechazaba con "expected string, received null". La lección: cuando un formulario y su schema se escriben por separado, un campo faltante en el formulario falla en tiempo de ejecución, no en el typecheck — vale la pena revisar ambos lado a lado, y las pruebas e2e (no las unitarias) son las que lo detectan.
- **Un Server Action que no redirige pierde el estado de cliente del formulario que lo invocó** cada vez que se envía — se descubrió construyendo `/admin/sequences`, el primer formulario de esta app que se queda en la misma página en vez de navegar tras un envío exitoso. Cada envío de un Server Action refresca el árbol de Server Components de la ruta actual; ese refresco recrea el Client Component anidado, así que cualquier `useState`/`defaultValue` local (la línea de negocio seleccionada, por ejemplo) se reinicia — un segundo envío sin volver a elegir nada termina mandando el valor por defecto, no el elegido. Se confirmó con capturas de la petición de red real (el propio `FormData` enviado cambiaba entre envíos) y se reprodujo igual en un build de producción (`next build && next start`), así que no era un artefacto del modo desarrollo. La solución fue la misma que ya usa el resto de la app: la acción redirige a `/admin/sequences?...` codificando la última selección y el resultado en la URL (`searchParams`), y la página los usa como `defaultValue` — el estado sobrevive porque vive en la URL, no en un componente de cliente que el framework puede recrear.
- `lib/folio/sequence.ts` expone dos entradas: `issueFolio` (abre su propia transacción — diagnóstico de `/admin/sequences`) e `issueFolioInTransaction` (recibe el `tx` de quien llama — `createQuotationDraft` en `lib/quotations/mutations.ts`). Ambas comparten la misma lógica (`issueFolioCore`); la diferencia es solo quién decide la frontera de la transacción, para que el folio y el documento que lo usa se creen o se reviertan juntos.
- Todos los agregados monetarios de una cotización (`subtotal`, `total`, `marginPct`, ...) se calculan con `decimal.js`, igual que el motor de margen del catálogo — sumar números de punto flotante en JavaScript puede acumular error de redondeo, y estos totales son dinero real que ve un cliente.
