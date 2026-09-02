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
   políticas, cuelga vendedores/clientes/catálogo/almacén/proveedor de
   prueba de la organización real (`global-supplier-mty`, ya bootstrapeada
   por las propias migraciones — el seed NO crea una organización nueva),
   y deja 3 cuentas de login listas para usar. No hay que crear nada a mano
   en el dashboard.
   ```bash
   supabase db reset
   ```
   Cuentas de prueba (`supabase/seed/seed_demo_data.sql`), todas con
   password **`Thoren2026!`** — SOLO existen en tu stack local, nunca en un
   proyecto real:

   | Correo                  | Rol      | Nota                          |
   | ------------------------ | -------- | ----------------------------- |
   | `admin@thoren.local`     | ADMIN    | acceso total                  |
   | `vladimir@thoren.local`  | VENDEDOR | vendedor "Vladimir Peña", VPT |
   | `karla@thoren.local`     | VENDEDOR | vendedor "Karla Saucedo", KST |
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
5. **(Opcional) Crear tu propio usuario** en vez de usar las cuentas de
   prueba — la app no tiene pantalla de registro (es un sistema interno, de
   alta manual). Créalo desde Supabase Studio (`http://127.0.0.1:54323` →
   Authentication → Add user, marca "Auto Confirm User"), agrégalo a
   `organization_members` (organización `global-supplier-mty`) y luego:
   ```sql
   insert into user_profiles (user_id, name, role, active)
   select id, 'Administrador', 'admin', true
   from auth.users
   where email = 'tu-correo@globalsupplier.com.mx'
   on conflict (user_id) do update set role = 'admin', active = true;
   ```
6. **Correr la app**
   ```bash
   npm run dev
   ```
   Abre `http://localhost:3000` — redirige a `/login`.

Para un proyecto Supabase remoto (staging/producción) el flujo es el mismo:
`supabase link`, `supabase db push` en lugar de `db reset` (el seed es solo
para desarrollo), y las keys las tomas del dashboard del proyecto en vez de
la salida de `supabase start`.

## Problemas comunes en local (Windows)

- **`supabase start` solo imprime `DB_URL`, sin `anon key` ni
  `service_role key`.** Quedó un contenedor huérfano de un intento anterior
  bloqueando que suba el resto del stack. Corre `supabase stop` y luego
  `supabase start` de nuevo — con eso sale la tabla completa (API URL,
  Studio URL, `anon key`, `service_role key`, etc.).
- **`NotFound: FileSystem.readFile (...\.supabase\profile)` al correr
  cualquier comando.** Bug conocido del CLI en Windows
  ([supabase/cli#5890](https://github.com/supabase/cli/issues/5890)).
  Inofensivo — el CLI cae al perfil por default. Ignóralo. **No** crees a
  mano el archivo `~/.supabase/profile`: si existe pero no tiene el formato
  exacto que el CLI espera, el error deja de ser un warning y se vuelve
  fatal (`LegacyProfileLoadError`).
- **`supabase db reset` truena** (a veces como `EUNKNOWN: unknown error,
  uv_spawn`, a veces como `LegacyMigrationApplyError` apuntando a
  `0011_users_roles_rls.sql`). La migración 0011 promueve a admin al primer
  usuario que ya exista con cierto correo — como `db reset` recrea la DB
  desde cero (borra usuarios), si nadie con ese correo existe todavía la
  migración fallaba y tumbaba TODO el reset. Ya está arreglado en el repo
  (avisa con `raise warning` en vez de `raise exception` si no encuentra al
  usuario); si sigue tronando en 0011 después de un `git pull`, es que tu
  copia local quedó desactualizada.
- **`supabase start` (o `stop`) se cuelga en
  `LegacyHealthCheckTimeoutError`** en `supabase_storage` o
  `supabase_studio` ("container is not ready: unhealthy"), aunque sus logs
  digan `Started Successfully`. Es Docker Desktop tardándose más del
  timeout del CLI (normal si tienes otros proyectos con contenedores
  corriendo al mismo tiempo). Reintenta con
  `supabase start --ignore-health-check` y confirma a mano con
  `docker ps --filter name=supabase` que todo diga `healthy` unos segundos
  después.
- **Login da `422 email_provider_disabled` ("Email logins are disabled")
  aunque la cuenta exista y la password sea correcta.** En esta versión del
  CLI, `[auth.email].enable_signup` controla tanto el auto-registro como si
  el proveedor de email/password está prendido del todo
  (`GOTRUE_EXTERNAL_EMAIL_ENABLED = enable_signup`, sin distinción). Por eso
  `supabase/config.toml` trae `enable_signup = true` — es necesario para
  poder hacer login local, no habilita ningún registro público porque la
  app no expone esa pantalla. Esto solo aplica al stack local; no afecta el
  proyecto de producción.

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
