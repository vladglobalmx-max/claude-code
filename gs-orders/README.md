# GS Orders

Aplicación interna de **Global Supplier MTY** para generar, guardar, consultar,
editar, duplicar e imprimir pedidos que se envían a proveedores y fábricas.
Primera unidad de negocio activa: **Thunder Safety Solutions / Thunder LED
Lights**. Ver [`MVP_SPEC.md`](MVP_SPEC.md) para el alcance completo.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres,
Auth, Storage).

## Instalación

```bash
npm install
cp .env.example .env.local
```

## Base de datos (local)

Requiere el [Supabase CLI](https://supabase.com/docs/guides/cli) y Docker.

```bash
supabase start          # levanta Postgres, Auth y Storage localmente
supabase db reset       # aplica supabase/migrations/*.sql y el seed
```

`supabase start` imprime la URL y las keys locales — cópialas a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key impresa por supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key impresa por supabase start>
```

El seed (`supabase/seed/seed_demo_data.sql`) crea dos vendedores de ejemplo
(Vladimir Peña / VPT y Karla Solís / KST).

### Usuarios

El registro está deshabilitado (`enable_signup = false`): los usuarios se
crean manualmente desde el dashboard de Supabase Auth (o `supabase.auth.admin`)
— es un sistema interno, no hay alta pública.

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`.

## Estructura

```
src/app/(auth)/login/        inicio de sesión
src/app/(app)/               pedidos, vendedores, configuración (con sidebar)
src/app/(print)/             vista imprimible del pedido (sin sidebar)
src/components/ui/           design system (button, card, input, table…)
src/components/orders/       formulario de pedido, secciones, detalle
src/lib/supabase/            clientes browser/server/admin
supabase/migrations/         esquema, folios atómicos, storage
```

## Folios

`[PREFIJO]-[AAAADDMM]-[CONSECUTIVO]`, ej. `VPT-20261108-001`. Se generan con
un trigger de Postgres (`fn_next_order_folio`) que bloquea la fila del
vendedor (`select ... for update`) para incrementar su consecutivo de forma
atómica — nunca se reinicia y nunca se repite, aunque dos pedidos se creen
al mismo tiempo. El folio es inmutable una vez generado.

## Próximos pasos sugeridos

1. Conectar un proyecto Supabase real y crear los primeros usuarios.
2. Agregar los formularios de Juno Promotional, Got Fresh Breath y The Fire
   Spot cuando esas unidades arranquen (el esquema ya soporta `business_unit`).
3. Roles/permisos más allá de "todo usuario autenticado puede usar la app".
