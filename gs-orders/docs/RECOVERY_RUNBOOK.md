# THÖREN — Recovery Runbook

Qué hacer cuando algo se rompe. No es disaster recovery enterprise — es un
runbook simple: qué revisar, qué detener, cómo volver atrás, y quién/qué
sistema es la fuente de verdad en cada caso. Ver `PILOT_RUNBOOK.md` para
todo lo que pasa ANTES de que algo se rompa (provisioning, checklist de
readiness).

**Fuente de verdad general**: Postgres de Supabase Cloud es la única
fuente de verdad de los datos. `main` (este repo) es la única fuente de
verdad del código y del esquema (migraciones). Nunca al revés — si algo en
Cloud no coincide con `main`, es Cloud el que está desalineado, no al
contrario.

---

## Antes de necesitar este documento: verificar que hay con qué recuperar

**Backups / PITR** — verificar en **Supabase Dashboard → Settings →
Database → Backups**:

- Plan actual y si incluye backups automáticos (Free NO los incluye).
- Frecuencia y retención.
- Si hay PITR (Point-in-Time Recovery) o solo snapshots diarios.
- Si el restore es self-service desde el dashboard o requiere ticket de
  soporte.

**Esto no pudo verificarse desde una sesión de desarrollo local** (sin
credenciales de Supabase Cloud) — es el primer paso real de este runbook,
no un dato que este documento pueda asumir. Si no hay backups automáticos,
los 4 casos de abajo son más graves de lo que el runbook asume por
default: sin backup, "volver atrás" en datos puede no ser posible en
absoluto, solo en esquema/código.

**Migraciones** — para confirmar que Cloud corre exactamente lo que `main`
tiene, correr en el SQL Editor de Supabase:

```sql
select version from supabase_migrations.schema_migrations order by version desc limit 10;
```

Comparar contra `ls supabase/migrations/ | sort -V | tail -10` en el repo
local. Si Cloud tiene MENOS migraciones que `main`: es la causa más
probable de cualquier error "columna/función no existe" reportado por la
app — resolver eso primero, antes de sospechar de datos o código.

---

## CASO A — Borrado accidental de datos

**Síntoma**: un usuario (o un bug) borró filas que no debían borrarse —
pedidos, clientes, catálogo, lo que sea.

**Qué revisar primero**:
1. ¿Fue un DELETE real o el dato sigue ahí pero con `active = false`? La
   mayoría de las tablas del proyecto usan soft-delete (`active` boolean) —
   confirmar en el SQL Editor antes de asumir que se perdió algo:
   ```sql
   select * from <tabla> where id = '<id>';
   ```
2. ¿Cuántas filas / qué alcance? Un borrado de una fila puntual vs. un
   DELETE sin WHERE son escenarios completamente distintos.

**Qué detener**: si el borrado sigue en curso (ej. un script corriendo en
loop), detenerlo antes que nada — no hay recovery útil mientras el daño
sigue creciendo.

**Cómo volver atrás**:
- Si es soft-delete: revertir el flag (`update ... set active = true where
  id = ...`) — no requiere backup.
- Si es un DELETE real y hay backups/PITR (ver sección de arriba): restore
  puntual desde el dashboard de Supabase, o soporte de Supabase si el plan
  lo requiere. Un restore completo de PITR revierte TODO el proyecto a ese
  punto en el tiempo — evaluar si vale la pena vs. reconstruir manualmente
  las filas perdidas si son pocas.
- Si NO hay backups: no hay recovery de datos posible más allá de lo que
  alguien haya exportado manualmente antes (CSV, `pg_dump` manual, etc.).
  Esto es exactamente por lo que la sección de arriba debe verificarse
  ANTES de operar con datos reales de un cliente.

**Fuente de verdad**: Postgres de Cloud. Ningún archivo local tiene los
datos reales del piloto.

---

## CASO B — Migración defectuosa

**Síntoma**: una migración nueva se aplicó a Cloud y algo se rompió (una
función falla, RLS bloquea algo que antes funcionaba, un CHECK constraint
rechaza inserts válidos).

**Qué revisar primero**:
1. ¿Qué migración fue la última aplicada? (`schema_migrations`, ver
   arriba).
2. ¿El error reproduce localmente contra el mismo esquema? Si sí, es un
   bug real de la migración, no un problema de datos de Cloud
   específicamente — reproducirlo local es más rápido que debuggear contra
   producción.

**Qué detener**: si la migración rota bloquea un flujo crítico (ej. nadie
puede crear pedidos), comunicar el incidente antes de intentar arreglarlo
en caliente — un fix apurado sobre una migración ya aplicada en
producción es más riesgoso que 10 minutos de aviso.

**Cómo volver atrás**:
- **Preferido**: escribir una migración NUEVA que corrija el problema
  (nunca editar una migración ya aplicada — el proyecto nunca ha hecho
  esto, y editar una migración histórica desincroniza cualquier ambiente
  que ya la haya corrido). Aplicar esa migración correctiva primero local
  contra Postgres real, confirmar, luego a Cloud.
- Si la migración rota tiene un `down`/rollback explícito preparado (no es
  el patrón usado en este proyecto — las migraciones aquí son
  forward-only): no aplica. Si no lo tiene, la migración correctiva de
  arriba es el único camino.
- Si el daño ya incluye datos corruptos (no solo esquema): combinar con
  CASO A.

**Fuente de verdad**: `main` en este repo para saber exactamente qué
migración se supone que existe y en qué orden. `schema_migrations` en
Cloud para saber qué realmente se aplicó.

---

## CASO C — Deploy de app defectuoso

**Síntoma**: un deploy nuevo a Vercel rompió algo — build falló, o el
build pasó pero algo se comporta mal en producción.

**Qué revisar primero**:
1. Vercel → Deployments → ¿el build en sí falló, o el build pasó y el
   problema es en runtime? Son causas completamente distintas.
2. Si es runtime: Runtime Logs (ver `PILOT_RUNBOOK.md` sección 6) para el
   error real.

**Qué detener**: nada que "detener" del lado de datos — este caso no
suele tocar Postgres. La acción es sobre el deploy, no sobre la base de
datos.

**Cómo volver atrás**:
- Vercel guarda cada deploy anterior — desde Deployments, seleccionar el
  último deploy bueno conocido y "Promote to Production" (o el equivalente
  en la versión de Vercel que se esté usando). Esto es instantáneo y no
  requiere revertir código en git primero.
- Después de estabilizar con el rollback de Vercel, sí revertir/arreglar
  en git con calma, y volver a deployar cuando esté confirmado.

**Fuente de verdad**: el historial de deploys de Vercel es la fuente de
verdad de "qué está corriendo en producción ahora mismo" — puede no
coincidir momentáneamente con la punta de `main` si se hizo un rollback
manual, y esa es la excepción aceptada (documentarlo cuando pase, para que
el próximo deploy normal no sorprenda a nadie).

---

## CASO D — Problema de Auth/configuración

**Síntoma**: usuarios no pueden hacer login, invitaciones no llegan,
resets de password no funcionan, o un tenant específico empieza a fallar
en Auth sin que nadie haya tocado código.

**Qué revisar primero**:
1. Supabase Dashboard → Authentication → Logs — el error real de GoTrue
   casi siempre está ahí, no en Vercel (Vercel solo ve la respuesta que
   Supabase le dio).
2. ¿Es un usuario específico o todos? Si es todos: sospechar de un cambio
   de configuración reciente en Authentication → URL Configuration (Site
   URL/Redirect URLs mal puestos rompe TODOS los redirects a la vez, ver
   `PILOT_RUNBOOK.md` sección 3).
3. Si es un tenant/dominio específico: revisar la sección 1.3 de
   `PILOT_RUNBOOK.md` (posible Auth Hook de restricción de dominio).

**Qué detener**: si se sospecha que un cambio de configuración reciente en
el dashboard de Supabase causó esto, no seguir tocando configuración
"a ver si arregla" — un segundo cambio sin diagnóstico claro hace más
difícil saber cuál de los dos causó qué.

**Cómo volver atrás**: la configuración de Auth en Supabase Cloud no tiene
historial de versiones como git — si se cambió Site URL/Redirect URLs
recientemente, el único "rollback" es volver a poner manualmente el valor
anterior (por eso `PILOT_RUNBOOK.md` sección 3 documenta el valor correcto
exacto esperado, para tener con qué comparar).

**Fuente de verdad**: `PILOT_RUNBOOK.md` sección 3 (URLs esperadas) y
sección 5 (templates esperados) — son el "estado correcto conocido" contra
el cual comparar cuando algo de Auth se ve raro.

---

## Nota sobre datos de demo vs. datos reales

`seed_demo_data.sql` (guard real desde 7C — exige
`thoren.allow_demo_seed=local`, ver `scripts/reset-local-demo.sh`) NUNCA
debe correr contra el proyecto de Cloud del piloto. Si alguna vez aparece
un usuario `@thoren.local` con password `Thoren2026!` en el proyecto de
Cloud real, es una señal de que el guard fue bypaseado manualmente (alguien
corrió el SQL directo con el GUC puesto a propósito) — tratarlo como
incidente de seguridad, no como un bug de la app.
