# GLOBAL QUOTE — Módulo 1 (Cimientos)

Aplicación Next.js del sistema **GLOBAL QUOTE — Quotation & Commercial Control System** para Global Supplier MTY. Este directorio contiene el primer módulo del plan de MVP descrito en [`../docs/ARCHITECTURE.md §10`](../docs/ARCHITECTURE.md#10-plan-del-mvp-por-módulos): login, roles/permisos (RBAC) y líneas de negocio.

## Alcance de este módulo

### Módulo 1 — Cimientos
- Login con correo/contraseña (Auth.js / Credentials), sesión JWT, bloqueo tras 5 intentos fallidos.
- 7 roles (`SUPER_ADMIN`, `DIRECCION_GENERAL`, `ADMINISTRACION`, `GERENTE_VENTAS`, `VENDEDOR`, `MARKETING`, `CONSULTA`) con su matriz de permisos (`src/lib/auth/permissions.ts`), fiel a `docs/ARCHITECTURE.md §4.1`.
- 7 líneas de negocio (TSS, TLL, GFB, TFS, JUN, GTX, GSM) con asignación de usuarios por línea.
- `proxy.ts` (el `middleware.ts` de Next.js 15 se renombró a `proxy.ts` en Next 16 — ver `AGENTS.md`) protege todas las rutas autenticadas y bloquea `/admin/*` sin el permiso correspondiente; el layout de `(app)` vuelve a validar la sesión como segunda barrera.
- El dashboard demuestra la proyección de datos por rol: un Vendedor nunca recibe el bloque de costos/márgenes; un Super Admin sí.

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

## Requisitos

- Node.js 20.9+
- PostgreSQL 14+ (local o en contenedor)

## Instalación

```bash
npm install
cp .env.example .env.local   # completa DATABASE_URL y AUTH_SECRET (openssl rand -base64 32)
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
- `tests/e2e/login.spec.ts`, `tests/e2e/products.spec.ts`, `tests/e2e/product-crud.spec.ts`, `tests/e2e/customers.spec.ts`, `tests/e2e/sequences.spec.ts`, `tests/e2e/quotations.spec.ts` y `tests/e2e/approvals.spec.ts`: navegador real — contraseña incorrecta, redirección sin sesión, RBAC del dashboard/catálogo/clientes/folios/cotizaciones/autorizaciones, el flujo completo de alta/edición de producto y de cliente, la emisión de folios de prueba consecutivos, una cotización real creada con partidas agregadas y enviada (caso sano y caso que requiere autorización), y el flujo completo de autorización: Dirección General aprobando o rechazando, Gerente de Ventas y Administración viendo una bandeja vacía para una excepción de margen sobre la que no tienen autoridad, y Marketing sin acceso al panel.

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
