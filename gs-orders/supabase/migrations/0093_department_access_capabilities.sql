-- THÖREN — Control de acceso por departamentos (Fase 1/2: infraestructura).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- Objetivo del ticket: permitir que Dirección General (admin) asigne uno o
-- varios de los 5 departamentos (Ventas, Administración, Compras, Almacén,
-- Logística) a cada empleado desde Configuración → Usuarios, y que esa
-- asignación filtre qué ve/puede navegar ese usuario, SIN tocar ninguna
-- restricción existente (moduleKey/adminOnly/commissionsOnly/RLS). Esta
-- migración es 100% ADITIVA, mismo criterio que 0040/0083: ningún usuario
-- gana ni pierde acceso funcional por sí sola — un usuario sin ninguna
-- capability de departamento asignada no se ve afectado por esta
-- migración (la activación real del filtro vive en código de aplicación,
-- fuera de este archivo, y solo se conecta cuando Dirección guarda una
-- asignación — "transición segura" pedida explícitamente en el ticket).
--
-- =========================================================================
-- DECISIÓN — 5 capabilities nuevas (`can_access_<departamento>`), no una
-- tabla nueva
-- =========================================================================
-- Reutiliza el catálogo `capabilities` + `user_capabilities` ya existente
-- (0040), exactamente como pide la sección ARQUITECTURA del ticket ("no
-- crear roles ni tablas nuevas, reutilizar user_capabilities"). Cada
-- departamento es una capability más, otorgable/revocable con la misma
-- infraestructura, RLS y auditoría (granted_by/granted_at/revoked_by/
-- revoked_at) que las 16 capabilities existentes — sin necesidad de
-- tocar la tabla `user_capabilities` ni su RLS en absoluto.
--
-- =========================================================================
-- DECISIÓN — rpc_set_user_departments(), SECURITY DEFINER, mismo patrón
-- que rpc_delete_salesperson (0079) / rpc_delete_purchase_order (0082)
-- =========================================================================
-- La RLS de `user_capabilities` (0040) YA exige is_organization_admin()
-- para cualquier INSERT/UPDATE/DELETE — eso NO se toca ni se duplica aquí
-- (ver ARQUITECTURA del ticket: "no tocar RLS existente salvo necesidad
-- concreta" — no hay necesidad concreta, la RLS ya protege exactamente lo
-- que se pide). Este RPC es SECURITY DEFINER no para saltarse esa regla,
-- sino para poder:
--   (a) resolver la organización del usuario DESTINO internamente (vía
--       organization_members, nunca aceptado como parámetro del cliente),
--   (b) exigir autoridad de admin con el mismo criterio EXACTO que la RLS
--       ya vigente sobre user_capabilities (0040): is_organization_admin()
--       sobre la organización del usuario DESTINO — nunca
--       current_user_is_admin() a secas (eso solo confirmaría admin en SU
--       PROPIA organización, no autoridad sobre la del destino) ni
--       can_manage_users (ver DECISIÓN original de 0040: otorgar/revocar
--       capacidades es autoridad EXCLUSIVA del Super Admin),
--   (c) bloquear auto-asignación (un admin no puede asignarse
--       departamentos a sí mismo — requisito explícito de TRANSICIÓN
--       SEGURA), verificación que no existe en ningún otro lugar,
--   (d) escribir las 5 filas (una por departamento) de forma atómica y
--       preservando el historial de auditoría de 0040: una fila ya activa
--       que sigue en la lista NO se re-otorga (conserva su
--       granted_by/granted_at original); una fila ausente de la lista se
--       UPDATE a active=false + revoked_by/revoked_at (nunca se hace
--       DELETE, mismo criterio de auditoría que el resto del proyecto);
--       una fila nueva se INSERT con active=true.
-- La función corre su propia autorización ANTES de tocar una sola fila —
-- mismo criterio que 0079/0082 — así que aunque sea SECURITY DEFINER, el
-- resultado observable es idéntico a si RLS la hubiera bloqueado: ningún
-- no-admin ni auto-asignación puede escribir una sola fila a través de
-- ella.
--
-- =========================================================================
-- DECISIÓN — trg_check_user_capability_same_org (0040) ya cubre la
-- integridad cross-org, no se duplica
-- =========================================================================
-- El trigger existente ya rechaza cualquier INSERT/UPDATE en
-- user_capabilities donde el usuario destino no pertenezca a la
-- organización indicada — este RPC resuelve esa organización leyendo
-- organization_members del propio usuario destino, así que esa
-- combinación siempre es consistente por construcción, y el trigger actúa
-- como cinturón de seguridad adicional sin que haya que replicar su
-- lógica aquí.
--
-- Idempotente (on conflict do nothing, create or replace function),
-- transacción única (begin/commit) — mismo criterio que el resto del
-- proyecto.

begin;

-- =========================================================================
-- 1) capabilities — 5 nuevas, aditivas sobre el catálogo de 0040/.../0083.
-- =========================================================================
insert into capabilities (key, description) values
  ('can_access_ventas', 'Acceso departamental a los módulos de Ventas (Clientes, Cotizaciones, Pedidos) vía el filtro de departamentos — aditivo, nunca sustituye las restricciones de módulo/rol/capability ya existentes sobre esas rutas.'),
  ('can_access_administracion', 'Acceso departamental a los módulos de Administración vía el filtro de departamentos — aditivo, nunca sustituye las restricciones de módulo/rol/capability ya existentes sobre esas rutas.'),
  ('can_access_compras', 'Acceso departamental a los módulos de Compras (Proveedores, Requisiciones, Órdenes de Compra, Recepciones) vía el filtro de departamentos — aditivo, nunca sustituye las restricciones de módulo/rol/capability ya existentes sobre esas rutas.'),
  ('can_access_almacen', 'Acceso departamental a los módulos de Almacén (Inventario, Almacenes, Movimientos) vía el filtro de departamentos — aditivo, nunca sustituye las restricciones de módulo/rol/capability ya existentes sobre esas rutas.'),
  ('can_access_logistica', 'Acceso departamental a los módulos de Logística (Reservas, Surtido, Entregas) vía el filtro de departamentos — aditivo, nunca sustituye las restricciones de módulo/rol/capability ya existentes sobre esas rutas.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) rpc_set_user_departments(p_user_id, p_departments) — ver DECISIÓN
--    arriba. Única vía soportada para escribir estas 5 capabilities desde
--    la aplicación (la RLS de user_capabilities sigue permitiendo que un
--    admin las escriba también directamente, pero la UI/server action de
--    Configuración → Usuarios usará exclusivamente este RPC).
-- =========================================================================
create or replace function rpc_set_user_departments(p_user_id uuid, p_departments text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_departments text[] := array['can_access_ventas', 'can_access_administracion', 'can_access_compras', 'can_access_almacen', 'can_access_logistica'];
  v_organization_id uuid;
  v_department text;
  v_requested text[];
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes asignarte departamentos a ti mismo.';
  end if;

  select array_agg(distinct d) into v_requested
    from unnest(coalesce(p_departments, array[]::text[])) as d;
  v_requested := coalesce(v_requested, array[]::text[]);

  if exists (select 1 from unnest(v_requested) as d where d <> all (v_valid_departments)) then
    raise exception 'Departamento inválido.';
  end if;

  -- Resuelve la organización del usuario DESTINO (nunca aceptada como
  -- parámetro) y exige is_organization_admin() sobre ESA organización
  -- específica — no basta con current_user_is_admin() global: un admin
  -- de la Org A nunca debe poder escribir sobre un usuario de la Org B
  -- solo por ser admin en su propia organización.
  select om.organization_id into v_organization_id
    from organization_members om
    where om.user_id = p_user_id and om.active = true
    limit 1;
  if v_organization_id is null or not is_organization_admin(v_organization_id) then
    raise exception 'Usuario no encontrado o no tienes autoridad de administrador sobre su organización.';
  end if;

  foreach v_department in array v_valid_departments loop
    if v_department = any (v_requested) then
      insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id, granted_at)
        values (v_organization_id, p_user_id, v_department, true, auth.uid(), now())
      on conflict (organization_id, user_id, capability) do update
        set active = true,
            granted_by_user_id = case when user_capabilities.active then user_capabilities.granted_by_user_id else auth.uid() end,
            granted_at = case when user_capabilities.active then user_capabilities.granted_at else now() end,
            revoked_by_user_id = case when user_capabilities.active then user_capabilities.revoked_by_user_id else null end,
            revoked_at = case when user_capabilities.active then user_capabilities.revoked_at else null end
        where user_capabilities.organization_id = v_organization_id
          and user_capabilities.user_id = p_user_id
          and user_capabilities.capability = v_department;
    else
      update user_capabilities
        set active = false, revoked_by_user_id = auth.uid(), revoked_at = now()
        where organization_id = v_organization_id
          and user_id = p_user_id
          and capability = v_department
          and active = true;
    end if;
  end loop;
end;
$$;

commit;
