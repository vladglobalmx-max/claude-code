-- THÖREN — Ajuste de cierre: "Seleccionar todos los productos que
-- coinciden con los filtros" en Configuración → Catálogo.
--
-- =========================================================================
-- PROBLEMA REAL (Cloud): con un filtro de Business Unit (ej. "Juno
-- Promotional", ~1,296 productos), la única forma de desactivar en bloque
-- era seleccionar página por página (50 a la vez) o mandar los 1,296 ids
-- desde el navegador — lo segundo generaba una URL de PostgREST tan larga
-- que Supabase respondía Bad Request.
--
-- SOLUCIÓN: una función que resuelve y desactiva el conjunto completo
-- DENTRO de Postgres, en una sola sentencia — nunca transmite una lista de
-- ids, ni desde ni hacia el cliente.
--
-- =========================================================================
-- V1 DELIBERADAMENTE ACOTADA — solo Business Unit (p_bu) y Tipo de
-- Producto (p_tipo), SIN búsqueda de texto (p_q):
--   - `ILIKE` (Postgres) es insensible a mayúsculas pero NO a acentos;
--     `canonicalize()` (JS, usado por la búsqueda en pantalla) sí lo es.
--     Sin la extensión `unaccent` (deliberadamente NO agregada aquí),
--     "México"/"mexico" darían resultados distintos entre lo que el
--     usuario ve buscar y lo que este RPC afectaría — inaceptable para
--     una acción destructiva-adyacente (aunque sea soft-delete). Se
--     prefiere no ofrecer selección masiva bajo búsqueda de texto antes
--     que arriesgar esa discrepancia.
--   - Esta función SIEMPRE filtra `active = true` — no depende ni conoce
--     el filtro "Estado" de la pantalla. Es responsabilidad de la UI
--     (catalog-selection-table.tsx) ofrecer esta acción ÚNICAMENTE cuando
--     el filtro Estado vigente es "Activo"/omitido (nunca con
--     "Inactivo"/"Todos") y no hay búsqueda de texto activa — mismo
--     criterio de "nunca confiar solo en la UI": aunque se invocara con
--     otro estado visible en pantalla, esta función jamás toca una fila ya
--     inactiva.
--
-- =========================================================================
-- Regla de Business Unit — EXACTAMENTE la misma que ya usa la pantalla
-- (filterCatalogRows, catalog-search.ts): un producto coincide con un
-- filtro de BU si tiene una fila en product_business_units para esa BU, O
-- si no tiene NINGUNA fila en product_business_units (0 filas = compartido
-- con todas las Business Units de la organización, ver 0019).
--
-- Seguridad: SECURITY DEFINER (product_catalog no tiene policy de UPDATE
-- para un usuario normal fuera de product_catalog_admin_write, y aun así
-- nunca se confía solo en RLS para una operación masiva) — resuelve
-- organización y autoridad admin INTERNAMENTE (current_user_organization_id()/
-- current_user_is_admin(), 0011/0013), nunca acepta organization_id como
-- parámetro del cliente. Un producto de otra organización nunca puede
-- verse afectado: el WHERE siempre incluye
-- `organization_id = v_organization_id`, resuelto server-side.
--
-- Atomicidad: una sola sentencia UPDATE — el "conjunto vigente" se evalúa
-- en el momento exacto de ejecutar (si el catálogo cambió entre que el
-- usuario vio "1,296" y confirmó, la sentencia SIEMPRE opera sobre la
-- realidad actual, nunca sobre un snapshot stale) — sin necesidad de
-- BEGIN/EXCEPTION explícito, "rollback ante cualquier error" es una
-- propiedad del lenguaje.
-- =========================================================================

begin;

create or replace function rpc_bulk_deactivate_catalog_products_by_filters(p_bu uuid, p_tipo uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_updated_count integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede eliminar productos del catálogo.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización asociada. Contacta a soporte.';
  end if;

  with updated as (
    update product_catalog
    set active = false
    where organization_id = v_organization_id
      and active = true
      and (p_tipo is null or product_type_id = p_tipo)
      and (
        p_bu is null
        or exists (
          select 1 from product_business_units pbu
          where pbu.product_id = product_catalog.id and pbu.business_unit_id = p_bu
        )
        or not exists (
          select 1 from product_business_units pbu
          where pbu.product_id = product_catalog.id
        )
      )
    returning id
  )
  select count(*) into v_updated_count from updated;

  return v_updated_count;
end;
$$;

commit;
