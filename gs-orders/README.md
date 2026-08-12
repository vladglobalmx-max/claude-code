# GS Orders

Aplicación interna de **Global Supplier MTY** para generar, guardar, consultar,
editar, duplicar e imprimir pedidos que se envían a proveedores y fábricas.
Primera unidad de negocio activa: **Thunder Safety Solutions / Thunder LED
Lights**. Ver [`MVP_SPEC.md`](MVP_SPEC.md) para el alcance completo.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres,
Auth, Storage).

## Puesta en marcha (local)

Requiere Node 20+, el [Supabase CLI](https://supabase.com/docs/guides/cli) y Docker.

1. **Instalar dependencias**
   ```bash
   npm install
   ```
2. **Levantar Supabase local** (Postgres + Auth + Storage)
   ```bash
   supabase start
   ```
3. **Aplicar migraciones y seed** — esto crea las tablas, los triggers de
   folio, los buckets de Storage (`order-media`, `order-files`) y sus
   políticas, y dos vendedores de ejemplo. No hay que crear nada a mano en
   el dashboard.
   ```bash
   supabase db reset
   ```
4. **Variables de entorno** — copia el ejemplo y pega la URL y las keys que
   imprimió `supabase start`:
   ```bash
   cp .env.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key impresa por supabase start>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key impresa por supabase start>
   ```
5. **Crear un usuario** — el registro público está deshabilitado
   (`enable_signup = false`, es un sistema interno). Créalo desde Supabase
   Studio (`http://127.0.0.1:54323` → Authentication → Add user) o con
   `supabase.auth.admin.createUser(...)`.
6. **Correr la app**
   ```bash
   npm run dev
   ```
   Abre `http://localhost:3000` — redirige a `/login`.

Para un proyecto Supabase remoto (staging/producción) el flujo es el mismo:
`supabase link`, `supabase db push` en lugar de `db reset` (el seed es solo
para desarrollo), y las keys las tomas del dashboard del proyecto en vez de
la salida de `supabase start`.

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

`[PREFIJO]-[AAAADDMM]-[CONSECUTIVO]`, ej. `VPT-20261108-001` (año + día + mes,
NO año-mes-día). Se generan con un trigger de Postgres (`fn_next_order_folio`)
que bloquea la fila del vendedor (`select ... for update`) para incrementar
su consecutivo de forma atómica — nunca se reinicia y nunca se repite, aunque
dos pedidos se creen al mismo tiempo. El folio se asigna en cuanto el pedido
se guarda por primera vez (aunque sea Borrador) y es inmutable después: no
se puede reescribir el folio, el consecutivo, el vendedor ni la fecha de un
pedido ya creado.

Crear/editar/duplicar un pedido completo (datos + productos + imágenes +
archivos) corre en una sola transacción (`rpc_create_order`,
`rpc_update_order`, `rpc_duplicate_order` en
`supabase/migrations/0004_order_mutations_rpc.sql`): si cualquier parte
falla, Postgres revierte todo — incluido el incremento del consecutivo — así
que un pedido que no llega a guardarse nunca "gasta" un folio.

## Pruebas

```bash
npm test
```

Cubre el formato de folio (orden AAAADDMM, relleno de ceros, consecutivo
independiente por vendedor) y la validación de campos obligatorios de
Proyector/GOBO antes de pasar a "Pedido". El comportamiento a nivel de base
de datos (row locking, atomicidad, inmutabilidad) se valida por separado con
`supabase/tests/folio_smoke_test.sql` contra un Postgres real — instrucciones
dentro del archivo.

## Próximos pasos sugeridos

1. Conectar un proyecto Supabase real y crear los primeros usuarios.
2. Agregar los formularios de Juno Promotional, Got Fresh Breath y The Fire
   Spot cuando esas unidades arranquen (el esquema ya soporta `business_unit`).
3. Roles/permisos más allá de "todo usuario autenticado puede usar la app".
