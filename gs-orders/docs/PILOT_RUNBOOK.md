# THÖREN — Pilot Runbook

Guía operativa para llevar un tenant piloto real a producción. No es
documentación de arquitectura (ver `THOREN_BRAND_SYSTEM.md` para marca,
`MVP_SPEC.md` para alcance funcional) — esto es "qué hacer, en qué orden,
qué verificar" para quien opera THÖREN, no para quien lo desarrolla.

Este documento asume que quien lo ejecuta SÍ tiene acceso al dashboard de
Supabase Cloud y a Vercel — ninguna sesión de desarrollo local (incluida la
que escribió este runbook) tiene esas credenciales, así que varios pasos
están marcados explícitamente como **PENDIENTE DE VERIFICAR** en vez de
asumir un estado.

---

## 1. Estado de Cloud — verificar antes de continuar

Ninguno de estos tres puntos pudo confirmarse desde una sesión de
desarrollo local (sin credenciales de Supabase Cloud). Antes de meter datos
reales de un piloto, Vladimir debe verificar los tres:

### 1.1 Migraciones aplicadas

`main` incluye hoy hasta `0053_organization_timezone.sql`. Verificar en
Supabase Cloud:

- **Dashboard** → Database → Migrations (si el proyecto ya usa el flujo de
  migraciones de Supabase, ahí se ve la lista aplicada), o
- **SQL Editor**, correr:
  ```sql
  select version from supabase_migrations.schema_migrations order by version desc limit 10;
  ```
  Confirmar que `0051`, `0052` y `0053` (o sus timestamps equivalentes)
  aparecen en la lista.

Si faltan, aplicar en Cloud **en este orden exacto** (nunca fuera de
orden, cada una asume que la anterior ya corrió):

1. `supabase/migrations/0051_multitenant_isolation_hardening.sql`
2. `supabase/migrations/0052_organization_provisioning.sql`
3. `supabase/migrations/0053_organization_timezone.sql`

Vía `supabase link` + `supabase db push` (recomendado, deja el historial de
migraciones correcto) o pegando el SQL directo en el SQL Editor si `db
push` no es viable — en ese caso, registrar manualmente la versión en
`supabase_migrations.schema_migrations` para que futuros `db push` no
intenten reaplicarla.

**No se aplicó nada de esto desde esta sesión** (sin credenciales, y fuera
del alcance de 7D de todas formas).

### 1.2 Backups / PITR

Verificar en **Supabase Dashboard → Settings → Database → Backups**:

| Dato a confirmar | Por qué importa |
|---|---|
| Plan actual (Free / Pro / Team / Enterprise) | Free NO incluye backups automáticos ni PITR — es el primer dato que determina todo lo demás. |
| Backups automáticos: sí/no | Si no hay, cualquier borrado accidental (CASO A del recovery runbook) es irreversible salvo un `pg_dump` manual que alguien haya sacado antes. |
| Frecuencia (diaria, etc.) | Determina cuánto trabajo se puede perder en el peor caso. |
| Retención (días) | Determina la ventana real de recuperación. |
| PITR (Point-in-Time Recovery) disponible: sí/no | Solo Pro+ con add-on. Sin PITR, solo se puede restaurar al snapshot diario más cercano, no a un segundo específico. |
| Procedimiento de restore disponible desde el dashboard: sí/no | Algunos planes requieren abrir un ticket de soporte para restaurar, no es self-service. |
| Costo/upgrade si aplica | Para decidir si vale la pena antes de meter datos reales de un cliente. |

**No se pudo verificar ninguno de estos puntos desde esta sesión.** No
asumir que hay backups — verificar explícitamente antes del piloto.

### 1.3 Auth Hook / restricción de dominio de email

Pendiente desde Fase 7C: en QA solo funcionaron correos
`@globalsupplier.com.mx`, y la auditoría de código no encontró ningún
mecanismo (sin trigger en `auth.users`, sin regex de dominio en
`createUserAccessSchema`, sin Auth Hook versionado en el repo). Checklist
manual para Vladimir:

1. **Dashboard → Authentication → Hooks** — ¿existe algún hook "Before User
   Created" (o equivalente) habilitado? Si sí, abrirlo y confirmar si
   contiene lógica de validación de dominio.
2. **Dashboard → Authentication → Providers → Email** — ¿hay alguna opción
   de restricción de dominio activada? (Supabase Cloud no expone esto como
   toggle nativo en la mayoría de planes, pero confirmar por versión.)
3. **Dashboard → Authentication → URL Configuration** — no es donde vive
   una restricción de dominio, pero conviene revisar de paso junto con la
   sección 3 de este documento.

Si NINGUNO de los tres tiene nada de dominio: la conclusión de 7C se
confirma — nunca hubo restricción técnica, solo que todo invite hecho hasta
hoy usó `@globalsupplier.com.mx` por hábito operativo. Si SÍ aparece algo:
reportarlo antes de invitar al primer usuario del tenant piloto (Org B),
para no descubrirlo cuando la invitación falle en producción.

---

## 2. Provisioning de un tenant nuevo (Tenant B)

Procedimiento completo, pensado para repetirse sin improvisar SQL a mano.

### 2.1 Requisitos previos

```bash
export SUPABASE_URL=https://<proyecto>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role key del dashboard>
export SITE_URL=https://app.thoren.mx   # opcional pero recomendado — ver sección 3
```

Nunca pegar la `service_role key` en un chat, ticket o commit — solo en la
terminal local de quien ejecuta el provisioning.

### 2.2 Ejecutar `provision-organization.mjs`

```bash
node scripts/provision-organization.mjs \
  --org-name "Nombre Real del Cliente" \
  --org-slug "nombre-real-del-cliente" \
  --admin-email admin@dominio-del-cliente.com \
  --admin-name "Nombre del admin" \
  --bu-name "Nombre de su primera Business Unit" \
  --bu-code "codigo_bu"
```

Esto, en una sola transacción: crea la organización, el primer admin
(`user_profiles` + `organization_members`), su `Person`, y la Business
Unit inicial — y envía la invitación real por correo (GoTrue). Si algo
falla a medio camino, el script revierte el usuario de Auth creado — nunca
deja un tenant a medias.

### 2.3 Timezone del tenant

`organizations.timezone` queda en `'America/Monterrey'` por default (0053)
— el script de provisioning NO expone un parámetro para cambiarlo (fuera
de alcance de 7C/7D a propósito, ver DECISIÓN en `0053_organization_timezone.sql`).

Si el cliente opera en otra zona horaria, **inmediatamente después de
provisionar**, correr en el SQL Editor de Supabase (requiere estar
conectado como `service_role`/postgres, no como usuario de la app — no
existe policy de UPDATE para `organizations` a propósito, ver
`0053_functional_tests.sql` TEST 4):

```sql
update organizations
set timezone = 'America/Mexico_City'  -- reemplazar por el timezone IANA correcto del cliente
where slug = 'nombre-real-del-cliente';
```

Verificar el resultado:

```sql
select slug, timezone from organizations where slug = 'nombre-real-del-cliente';
```

No hay UI para esto todavía (decisión deliberada de 7C — ver sección 9 más
abajo). No construir una pantalla nueva solo para este paso.

### 2.4 Validar admin

1. El admin recibe el correo de invitación (o, si el envío de correo está
   limitado, generar el enlace manualmente desde
   `/configuracion/usuarios` una vez que exista un segundo admin con
   acceso, o desde el dashboard de Supabase → Authentication → Users →
   ese usuario → "Send magic link"/"Reset password" como alternativa).
2. El admin define su contraseña en `/set-password`.
3. Login en `/login` con ese correo — debe caer en `/pedidos` (o donde
   redirija por default) viendo el nombre real de SU organización en el
   sidebar (no "Global Supplier MTY" — ver `getCurrentOrganizationName()`,
   7B).

### 2.5 Business Unit inicial

Ya la crea el script (paso 2.2, `--bu-name`/`--bu-code`). Si el cliente
necesita más de una BU desde el día uno, crearlas manualmente desde
`/unidades-negocio/nueva` una vez el admin tiene sesión.

### 2.6 Invitar usuarios adicionales

Desde `/configuracion/usuarios` (como el admin del tenant, o cualquier
usuario con `can_manage_users`) → "Invitar" o "Generar enlace de acceso".
Confirmar que el correo del nuevo usuario NO necesita ser
`@globalsupplier.com.mx` (ver sección 1.3 — si el Auth Hook resultara
existir y bloquear, este es el paso donde se notaría).

### 2.7 Folios / almacenes (si el cliente los necesita)

- Folios de cotización: `/configuracion/folios-cotizaciones/nuevo` — asigna
  prefijo + Business Unit a cada vendedor que vaya a cotizar. Sin esto, un
  vendedor no puede crear cotizaciones (bloqueo explícito, no un formulario
  roto — ver `cotizaciones/nueva/page.tsx`).
- Almacenes: `/almacenes/nuevo`, si el cliente usa el módulo de
  inventario/entregas.
- Proveedores: `/proveedores/nuevo`, si va a generar Purchase Orders.

Ninguno de estos es obligatorio para que el tenant exista — son
configuración operativa según lo que el cliente vaya a usar.

### 2.8 Sanity check de aislamiento

Antes de considerar el tenant listo, confirmar manualmente (con dos
sesiones de navegador, una por cada organización):

- El admin del Tenant B NO ve pedidos/clientes/catálogo de Global Supplier
  MTY (ni de ningún otro tenant existente).
- Un admin de Global Supplier MTY NO ve nada del Tenant B.
- El prefijo de folio del Tenant B puede repetir un prefijo ya usado en
  otro tenant sin colisionar (aislamiento por organización, ver 0051).

Esto ya está cubierto por pruebas automatizadas contra Postgres real
(`0051_functional_tests.sql`, `0052_functional_tests.sql`) — este paso es
la confirmación visual en la app real, no una repetición de esas pruebas.

---

## 3. Conectar `app.thoren.mx` — checklist exacto

**No ejecutar todavía** — esto es el checklist para cuando se autorice
conectar el dominio real, no una acción de esta fase.

### DNS

- Record recomendado: `CNAME` de `app` → el dominio que Vercel indique
  para el proyecto (normalmente `cname.vercel-dns.com`, confirmar el valor
  exacto que Vercel muestra al agregar el dominio — puede variar).
- Verificar propagación con `dig app.thoren.mx` o el propio panel de Vercel
  (marca el dominio como verificado cuando el DNS resuelve).

### Vercel

1. Project Settings → Domains → agregar `app.thoren.mx`.
2. Project Settings → Environment Variables (**Production** únicamente):
   `NEXT_PUBLIC_SITE_URL=https://app.thoren.mx`.
   `getSiteUrl()` (`src/lib/site-url.ts`) prioriza esta variable sobre
   cualquier header — si no se define, cae al host real de la petición
   (funciona igual, pero es mejor fijarla explícita en producción).
3. Confirmar que el deploy de producción toma la variable nueva (puede
   requerir un re-deploy si Vercel no lo hace automático al agregar la
   env var).

### Supabase Auth

En **Authentication → URL Configuration**:

- **Site URL** → `https://app.thoren.mx`.
- **Redirect URLs** → agregar `https://app.thoren.mx/set-password` (es la
  única ruta de callback que la app usa hoy — `buildSetPasswordLink()` en
  `src/lib/user-access.ts` construye siempre `<site>/set-password`, tanto
  para invite como para recovery). No hay una ruta de "invite callback"
  separada ni Magic Link en uso — no agregar URLs que la app no usa.
- Si el proyecto todavía tiene la URL de Vercel (`*.vercel.app`) o
  localhost configurada ahí, dejarla o quitarla es indistinto para la app
  en sí, pero quitarla reduce superficie de redirect abierto.

---

## 4. `www.thoren.mx` — arquitectura recomendada (solo documentación)

**No conectar la app a `www.thoren.mx`.** Arquitectura recomendada:

- `www.thoren.mx` → sitio comercial/landing (marketing, no la aplicación).
  Proyecto separado, puede vivir en Vercel también pero como un proyecto
  distinto, o en cualquier otro hosting — no comparte código con
  `gs-orders`.
- `app.thoren.mx` → la aplicación THÖREN (este repo).

Esto es solo la recomendación arquitectónica para cuando se decida crear
el sitio comercial — no hay nada que construir en esta fase.

---

## 5. Email templates — checklist Supabase Auth Cloud

Nada de esto está versionado en el repo (confirmado en 7C — sin
templates/SMTP config en `supabase/config.toml` ni en ningún otro
archivo). Checklist para revisar directo en **Authentication → Email
Templates**:

| Template | Verificar |
|---|---|
| Invite User | Cero mención de "Global Supplier"; copy neutral tipo THÖREN; el link generado apunta a `{{ .SiteURL }}` (que ya será `app.thoren.mx` tras la sección 3) — no a una URL fija hardcodeada dentro del template. |
| Reset Password | Mismo criterio: sin branding de Global Supplier, link vía `{{ .SiteURL }}`. |
| Magic Link | Solo si el proyecto lo usa (hoy la app no depende de Magic Link — confirmar que no esté siendo usado por error). |
| Change Email | Solo si el proyecto lo usa. |

**Remitente**: por default, Supabase envía desde su propio dominio
(`noreply@mail.app.supabase.io` o similar) — el nombre del remitente en el
template SÍ es editable ahí mismo aunque no se use Custom SMTP. Si se
quiere un remitente `@thoren.mx` real, eso requiere **Custom SMTP**
(Authentication → Email → SMTP Settings) — **documentar como P1, no
bloquear el piloto si el envío actual ya funciona** (instrucción explícita
de 7D).

---

## 6. Runtime Logs de Vercel — qué buscar durante el piloto

No se instala Sentry/Datadog. Vercel Runtime Logs (Project → Logs, o
`vercel logs` desde CLI) es la observabilidad interina. Checklist corto
para quien da soporte durante el piloto:

| Síntoma reportado por el usuario | Qué buscar en Runtime Logs |
|---|---|
| Pantalla de error / "algo salió mal" (500) | Filtrar por status 500 en la ruta reportada; el `error.tsx` de esa sección ya loguea con `console.error(error)` (ver cualquier `error.tsx`, ej. `pedidos/error.tsx`) — el stack completo debe aparecer ahí. |
| Un botón "no hizo nada" (Server Action falló en silencio) | Buscar por el nombre de la función de la Server Action (ej. `createOrder`, `uploadOrderMedia`) — varias ya hacen `console.error` explícito con contexto (`orderId`, `fileName`, etc., ver `storage-actions.ts`). |
| "No puedo entrar" / login falla | Revisar si el error viene de Supabase Auth (mensaje mapeado por `auth-errors.ts`) vs. un fallo de red — si es Auth, cross-check en el dashboard de Supabase → Authentication → Logs. |
| Un usuario ve datos que no debería (o NO ve datos que sí debería) | Sospecha de RLS — buscar mensajes de Postgres tipo `permission denied for table` o simplemente 0 filas donde se esperaban datos. Esto NO debería pasar tras 0051, pero si pasa, es P0 — revisar inmediatamente `organization_members` del usuario afectado. |
| La página tarda o no responde (timeout) | Buscar duración de la función en los logs (Vercel marca funciones que exceden el límite) — usualmente una consulta sin `.range()`/paginación (ver DECISIÓN de paginación en `paginated-fetch.ts`) o una race real de Postgres. |
| El deploy mismo falló | Eso vive en Vercel → Deployments, no en Runtime Logs — revisar el log de build ahí, no aquí. |

No se construye ningún dashboard nuevo — esta tabla ES el checklist.

---

## 7. Pilot readiness checklist (maestro)

Usar esto como el único checklist antes de meter datos reales de un
cliente piloto.

**DATABASE**
- [ ] Migraciones alineadas: Cloud tiene `0051`/`0052`/`0053` aplicadas (sección 1.1)
- [ ] Backups/PITR verificados (sección 1.2) — aunque el resultado sea "plan actual no incluye backups automáticos", debe quedar EXPLÍCITO, no asumido
- [ ] Tenant creado vía `provision-organization.mjs` (sección 2)
- [ ] Aislamiento smoke-tested manualmente con dos sesiones (sección 2.8)

**AUTH**
- [ ] Admin del tenant puede hacer login
- [ ] Admin puede invitar un segundo usuario
- [ ] Reset de password funciona
- [ ] Dominio/email del cliente confirmado sin bloqueo (sección 1.3)
- [ ] Redirects apuntan a `app.thoren.mx` (sección 3) — o, si el dominio
      real aún no está conectado, a la URL real que se esté usando para
      el piloto (Vercel preview/production URL)

**APP**
- [ ] `app.thoren.mx` conectado (sección 3) — o explícitamente diferido, con la URL real documentada
- [ ] `NEXT_PUBLIC_SITE_URL` correcta en Production
- [ ] Build/deploy de producción verde
- [ ] Sin branding de Global Supplier visible en ninguna pantalla del tenant nuevo (sidebar, login, set-password, metadata — ver 7B)
- [ ] Timezone del tenant confirmado (Monterrey por default, o ajustado manualmente si aplica — sección 2.3)

**OPERACIÓN**
- [ ] Runtime Logs de Vercel accesibles para quien da soporte (sección 6)
- [ ] `RECOVERY_RUNBOOK.md` leído por quien va a dar soporte durante el piloto
- [ ] Responsable de soporte identificado (nombre/rol, no "alguien del equipo")
- [ ] Datos de prueba (`seed_demo_data.sql`) claramente separados de datos reales — confirmar que NINGÚN usuario `@thoren.local` con password `Thoren2026!` existe en el proyecto Cloud del piloto (ver `RECOVERY_RUNBOOK.md` y el guard de 7C)

---

## 8. Qué falta hoy (blockers reales antes de datos reales de piloto)

Este documento puede cerrarse como completo aunque estos sigan
pendientes — pero deben quedar visibles, no enterrados:

1. **Backups/PITR sin verificar** — plan de Supabase Cloud desconocido
   desde esta sesión. Si el plan no incluye backups automáticos, es el
   riesgo más alto de todo el piloto (ver `RECOVERY_RUNBOOK.md`).
2. **DNS de `app.thoren.mx` no conectado** — el piloto puede correr sobre
   la URL de Vercel mientras tanto, pero eso debe ser una decisión
   explícita, no un olvido.
3. **Auth Hook de dominio sin confirmar** — si existiera y bloqueara, se
   descubre hasta que falle la primera invitación real a un dominio que no
   sea `@globalsupplier.com.mx`.
4. **Custom SMTP no configurado** — aceptable para el piloto (P1, no
   bloqueante) mientras el envío por defecto de Supabase siga funcionando.
