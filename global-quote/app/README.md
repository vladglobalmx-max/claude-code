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

**Fuera de este alcance** (vienen en Módulos 2/3 ampliado o después, ver `docs/ARCHITECTURE.md §10`): imágenes/documentos, kits/combos, precios por volumen/cliente, alta de categorías desde la UI, clientes, motor de folios, cotizaciones, autorizaciones, PDF, auditoría.

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
- `tests/e2e/login.spec.ts`, `tests/e2e/products.spec.ts` y `tests/e2e/product-crud.spec.ts`: navegador real — contraseña incorrecta, redirección sin sesión, RBAC del dashboard y del catálogo, y el flujo completo de alta/edición de producto por Administración (un Vendedor es redirigido con `?error=forbidden` si intenta `/products/new`).

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
- Las páginas que requieren un permiso (`/products/new`, `/products/[id]/edit`) usan `redirect("/dashboard?error=forbidden")`, igual que `proxy.ts`, en vez de `notFound()` — consistente en toda la app y más fácil de verificar en pruebas e2e.
