# MVP Validation Report — GS Orders (Thunder)

Fecha: 2026-08-12. Revisión de endurecimiento sobre el MVP existente — sin
funciones nuevas.

## Qué corregí

1. **Atomicidad de folios (crítico).** Crear/editar/duplicar un pedido hacía
   varios `insert` separados desde la app. Si el primero (que genera el
   folio y consume el consecutivo del vendedor) tenía éxito pero uno
   posterior fallaba, el consecutivo quedaba gastado sin un pedido real.
   Ahora `createOrder`, `updateOrder` y `duplicateOrder` llaman a funciones
   Postgres (`rpc_create_order`, `rpc_update_order`, `rpc_duplicate_order`,
   ver `supabase/migrations/0004_order_mutations_rpc.sql`) que hacen todo
   en una sola transacción: si algo falla, Postgres revierte todo, incluido
   el incremento del consecutivo.
2. **Inmutabilidad de fecha.** El trigger que protege el folio bloqueaba
   cambios a `salesperson_id`, pero no a `order_date` (la fecha usada para
   construir el folio). Agregado.
3. **Prefijo de vendedor.** Ahora se limpia (quita espacios), se convierte a
   MAYÚSCULAS y se limita a 5 caracteres, tanto en validación (Zod) como con
   un `check` en la base de datos.
4. **Mensajes de error.** `pedidos/actions.ts` y `vendedores/actions.ts` ya
   no muestran `error.message` crudo de Postgres; se traduce a mensajes en
   español (`src/lib/db-errors.ts`). Las excepciones propias (folio
   inmutable, vendedor inactivo, etc.) ya estaban en español y se muestran
   igual.
5. **PDF/impresión.** Agregué `@page` con márgenes, quité fondos
   innecesarios del bloque de resumen al imprimir y agrandé la imagen a
   proyectar en la vista impresa.
6. **Datos demo.** Corregido el nombre del segundo vendedor semilla a
   "Karla Saucedo / KST" como se pidió.
7. **README / `.env.example`.** `.env.example` ya solo tenía los 3 nombres
   necesarios (sin secretos) — verificado por grep contra todo el código,
   nada más se usa. README reescrito como checklist de 6 pasos, aclarando
   que las migraciones ya crean los buckets de Storage (no hay paso manual).

## Qué validé y quedó como estaba (ya cumplía)

- Esquema: FKs, `on delete cascade` en items/imágenes/archivos, `unique` en
  folio y en (business_unit, prefix), índices en salesperson_id/status/
  product_type/order_date/client_name, timestamps con trigger.
- RLS: todas las tablas y los 2 buckets de Storage exigen
  `auth.role() = 'authenticated'`; no hay policy para `anon`.
- Validación §20 (Proyector/GOBO): Borrador permite datos incompletos;
  pasar a "Pedido" exige vendedor/cliente/proveedor/modelo/cantidad/
  descripción/imagen/altura/ancho/alto y lista lo que falta.
- Formato de folio AAAADDMM (no AAAAMMDD) y consecutivo independiente por
  vendedor — cubierto por tests.

## Tests agregados

```bash
npm test
```

17 pruebas (Vitest): formato/orden de fecha del folio, relleno de ceros,
consecutivo independiente por vendedor, validación de campos obligatorios
de Proyector/GOBO, saneamiento del prefijo de vendedor.

`npm run build`, `npm run lint` y `npm run typecheck` corren limpios.

## Qué NO pude validar realmente

Este sandbox no tiene Docker, así que no hay Postgres/Supabase local
corriendo. Esto significa que **no ejecuté el camino dorado completo
contra una base de datos real**. Concretamente no verifiqué en vivo:

- Que `rpc_create_order` / `rpc_update_order` / `rpc_duplicate_order`
  compilen y corran sin errores de sintaxis PL/pgSQL contra Postgres real
  (las revisé a mano con cuidado, pero no hay sustituto de correrlas).
- El row-locking real bajo concurrencia (dos pedidos del mismo vendedor
  creados al mismo tiempo).
- Subida/lectura real de archivos en Supabase Storage.
- Las pantallas autenticadas (Pedidos, Nuevo Pedido, Ver Pedido,
  Vendedores, PDF) renderizadas con datos reales — solo pude cargar
  `/login` en un navegador real (confirmé que es responsive de verdad,
  sin overflow, en 390px/768px). El resto lo revisé leyendo el código con
  cuidado, no viéndolo renderizado.
- Escribí `supabase/tests/folio_smoke_test.sql`, un script que valida en
  SQL puro formato de folio, consecutivo por vendedor, inmutabilidad y que
  el consecutivo no se consume si el insert falla — pero no lo pude
  ejecutar aquí.

## Pasos exactos para que tú lo pruebes

```bash
cd gs-orders
npm install
supabase start
supabase db reset          # aplica migraciones (incluye 0004 nueva) + seed
cp .env.example .env.local # pega las keys que imprimió `supabase start`
```

Crea un usuario desde Supabase Studio (`http://127.0.0.1:54323` →
Authentication → Add user), luego:

```bash
npm run dev
```

1. Valida el smoke test de folios primero (rápido, sin UI):
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -f supabase/tests/folio_smoke_test.sql
   ```
   Debe imprimir `OK: todas las validaciones de folio pasaron`.
2. En el navegador: login → Vendedores → crea uno con prefijo `vpt` (debe
   guardarse como `VPT`) → Nuevo Pedido → Proyector/GOBO → llena
   especificaciones, sube imagen a proyectar y fotografías → Guardar
   borrador → confirma que ya tiene folio `VPT-AAAADDMM-001` → Editar →
   confirma que vendedor/fecha/folio están bloqueados → cambia a estado
   "Pedido" (si falta algo debe listarlo) → Ver pedido → PDF (imprime a
   PDF desde el navegador, revisa que no se corte nada) → Duplicar →
   confirma folio y consecutivo nuevos (`VPT-...-002`).
3. Repite la creación de un segundo pedido el mismo día y uno "otro día"
   (cambiando la fecha del sistema o esperando) para confirmar
   `...-001`, `...-002`, `...-003` sin reinicios.
