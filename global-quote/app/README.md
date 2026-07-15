# GLOBAL QUOTE — Módulo 1 (Cimientos)

Aplicación Next.js del sistema **GLOBAL QUOTE — Quotation & Commercial Control System** para Global Supplier MTY. Este directorio contiene el primer módulo del plan de MVP descrito en [`../docs/ARCHITECTURE.md §10`](../docs/ARCHITECTURE.md#10-plan-del-mvp-por-módulos): login, roles/permisos (RBAC) y líneas de negocio.

## Alcance de este módulo

- Login con correo/contraseña (Auth.js / Credentials), sesión JWT, bloqueo tras 5 intentos fallidos.
- 7 roles (`SUPER_ADMIN`, `DIRECCION_GENERAL`, `ADMINISTRACION`, `GERENTE_VENTAS`, `VENDEDOR`, `MARKETING`, `CONSULTA`) con su matriz de permisos (`src/lib/auth/permissions.ts`), fiel a `docs/ARCHITECTURE.md §4.1`.
- 7 líneas de negocio (TSS, TLL, GFB, TFS, JUN, GTX, GSM) con asignación de usuarios por línea.
- `proxy.ts` (el `middleware.ts` de Next.js 15 se renombró a `proxy.ts` en Next 16 — ver `AGENTS.md`) protege todas las rutas autenticadas y bloquea `/admin/*` sin el permiso correspondiente; el layout de `(app)` vuelve a validar la sesión como segunda barrera.
- El dashboard demuestra la proyección de datos por rol: un Vendedor nunca recibe el bloque de costos/márgenes; un Super Admin sí.

**Fuera de este módulo** (vienen en Módulos 2+, ver `docs/ARCHITECTURE.md §10`): catálogo de productos, clientes, motor de folios, cotizaciones, autorizaciones, PDF, auditoría.

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
- `tests/integration/login.test.ts`: login real contra la base de datos sembrada para los 7 roles, más bloqueo por intentos fallidos y cuentas inactivas.
- `tests/e2e/login.spec.ts`: navegador real — contraseña incorrecta, redirección sin sesión, y que el Vendedor no vea costos mientras el Super Admin sí.

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
