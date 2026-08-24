-- GS Orders — Migración 0030: THÖREN Catálogo Maestro de Productos +
-- Importador Excel (Fase 6C)
--
-- Fase 6C pidió explícitamente auditar antes de crear estructuras nuevas.
-- La auditoría encontró que `product_catalog` (0009/0019), `product_types`
-- (0010) y `product_business_units` (0019, N:M) YA EXISTEN, con un
-- importador Excel funcional (INSERT-only, sin actualización) desde una
-- fase anterior de esta misma sesión. Esta migración es 100% aditiva sobre
-- ese modelo — NO crea ninguna tabla nueva.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega a `product_catalog`: `product_type_id` (FK a `product_types`,
--    reutilizada — NO se crea una tabla de tipos paralela),
--    `brand`, `model`, `unit` (los 4 nullable). `category` (0009) se
--    vuelve NULLABLE (era NOT NULL) — ver DECISIÓN abajo.
-- 2) Reemplaza el único índice de unicidad de SKU: de GLOBAL
--    (`upper(sku)`, sin ningún scope) a `(organization_id, upper(sku))` —
--    ver DECISIÓN "natural key" abajo.
-- 3) Crea `rpc_import_product_catalog(p_products jsonb)` — INSERT/UPDATE
--    atómico (una sola función = una sola transacción implícita; CUALQUIER
--    fila inválida aborta TODA la importación, cero escritura parcial).
--    SECURITY INVOKER: la RLS ya existente de `product_catalog`
--    (`product_catalog_admin_write`, 0019) sigue siendo la única autoridad
--    real sobre quién puede escribir — esta función no la bypassa ni la
--    duplica.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO crea ninguna tabla nueva — reutiliza product_catalog/product_types/
--   product_business_units tal cual existen.
-- - NO toca `quotes`, `quote_items`, `orders`, `order_items`, PDF, ni
--   `rpc_create_order_from_quote`/`rpc_create_order`/0029 — integración con
--   Quote Builder es la siguiente fase, explícitamente fuera de esta.
-- - NO agrega `currency`/`unit_price` como columnas nuevas — reutiliza
--   `default_price_mxn`/`default_price_usd` (0019) tal cual; la app mapea
--   el par "Moneda + Precio base" (que pide Fase 6C) a estas 2 columnas ya
--   existentes (ver DECISIÓN abajo). Sin motor de conversión, sin
--   histórico de precio — mismo criterio que 0019.
-- - NO colapsa `product_business_units` (N:M) a una columna
--   `business_unit_id` directa — ver DECISIÓN "Business Unit" abajo.
-- - NO agrega `customer_requirements`, `warranty` ni `delivery_time` al
--   catálogo — son datos de la COTIZACIÓN/línea (ya existen ahí desde 0025/
--   0028), no del producto maestro: dos Quotes distintas del mismo
--   producto pueden pactar garantía o tiempo de entrega diferentes con
--   clientes distintos. Ponerlos en el catálogo los convertiría en un
--   default que ninguna pantalla actual lee ni necesita.
-- - NO agrega `metadata` jsonb genérico — ningún consumidor real hoy;
--   agregar un cajón sin esquema "por si acaso" es exactamente la
--   sobreingeniería que Fase 6C pidió evitar explícitamente.
-- - NO crea Business Units ni Product Types automáticamente desde Excel —
--   la importación solo RESUELVE nombres existentes; si no existen, es
--   error de fila, nunca alta automática (pedido explícito del usuario).
-- - NO relaja RLS de `product_catalog`/`product_business_units` — ADMIN-
--   only para escritura ya estaba correctamente resuelto desde 0019, sin
--   cambios.
--
-- =========================================================================
-- DECISIÓN — natural key: `(organization_id, upper(sku))`, NO
-- `(organization_id, business_unit_id, sku)`:
-- =========================================================================
-- El brief de Fase 6C sugería evaluar `organization_id + business_unit_id
-- + sku`. Se descarta deliberadamente: un producto de `product_catalog` no
-- tiene UN business_unit_id (es N:M vía `product_business_units` — 0
-- filas = compartido con TODAS las Business Units de la organización, 1+
-- filas = acotado a esas). Una key compuesta con business_unit_id
-- fragmentaría el mismo SKU físico en filas distintas por cada Business
-- Unit que lo vende, exactamente lo que la relación N:M ya evita a
-- propósito desde 0019. Un SKU es además, por naturaleza, un código de
-- fabricante/artículo — no cambia según qué Business Unit interna lo
-- revende. La key elegida SÍ corrige un bug real encontrado en la
-- auditoría: el índice de 0009 era GLOBAL (ni siquiera por organización),
-- documentado en el propio import-parsing.ts como "la única restricción
-- real, se respeta esa regla, no la sugerida" — sin ningún caso de uso que
-- lo justifique y con riesgo real para un futuro multi-organización.
-- `organization_id + upper(sku)` es la corrección mínima y correcta: cada
-- organización tiene su propio espacio de SKUs, sin fragmentar por
-- Business Unit.
--
-- =========================================================================
-- DECISIÓN — Business Unit: se conserva product_business_units (N:M), la
-- UI/Excel lo exponen como selección simple:
-- =========================================================================
-- Colapsar a una columna `business_unit_id` directa perdería la capacidad
-- ya construida y probada de "producto compartido con todas las Business
-- Units" (0 filas) sin ganar nada real: el caso de uso pedido en Fase 6C
-- (una fila de Excel = un producto = una Business Unit) sigue siendo
-- perfectamente representable como "reemplaza las filas de
-- product_business_units de este producto por exactamente 1 fila" (o 0 si
-- el Excel trae la Business Unit vacía/"Todas"). rpc_import_product_catalog
-- y el formulario manual (ya existente, sin tocar su UI de checkboxes)
-- siguen coexistiendo: la tabla/Excel/import usan el caso simple de 0/1,
-- el formulario manual conserva la capacidad completa de 1+ Business Units
-- ya construida.
--
-- =========================================================================
-- DECISIÓN — Moneda + Precio base (Fase 6C) se mapean a
-- default_price_mxn/default_price_usd (0019), sin columnas nuevas:
-- =========================================================================
-- 0019 ya modela el precio sugerido como DOS columnas independientes (MXN
-- y USD) en vez de una columna currency+price — más flexible (permite
-- sugerir ambas monedas a la vez) y ya en producción. Colapsarlo a un solo
-- par currency+base_price perdería esa capacidad sin necesidad real. La
-- capa de aplicación (formulario, tabla, Excel) expone "Moneda" + "Precio
-- base" como INPUT simple (igual que pide el brief): al guardar, el valor
-- se escribe en default_price_mxn si Moneda=MXN o en default_price_usd si
-- Moneda=USD, dejando la otra columna en NULL — la app decide a qué
-- columna mapear, la base de datos no gana ninguna columna nueva.
--
-- =========================================================================
-- DECISIÓN — `category` se vuelve nullable, `product_type_id` es el nuevo
-- eje de clasificación primario (reutilizando product_types):
-- =========================================================================
-- `category` (0009, texto libre) y `product_type` de Orders (0010) fueron
-- documentados en su momento como "conceptos DISTINTOS, sin relación 1:1"
-- — decisión que sigue siendo válida para los productos YA existentes
-- (Luz LED Grúa Viajera). Pero el brief de Fase 6C pide explícitamente un
-- campo "Tipo de producto" validado contra una lista existente — eso es
-- exactamente `product_types` (ya reutilizada por Orders desde 0010), no
-- una taxonomía nueva. En vez de mantener DOS ejes de clasificación
-- paralelos y confusos (category libre + product_type_id formal) para
-- productos nuevos, `product_type_id` pasa a ser el eje de clasificación
-- que la UI/Excel de Fase 6C administra; `category` se vuelve NULLABLE
-- (para no romper ninguna fila existente, que conserva su valor intacto)
-- y deja de pedirse en el formulario/Excel nuevos — sigue existiendo en el
-- esquema por si algún consumidor futuro la necesita, simplemente no se
-- escribe para productos nuevos vía Fase 6C. `product_type_id` es
-- nullable (no se fuerza un backfill inventado sobre productos
-- existentes); la capa de aplicación sí lo exige al crear/editar/importar
-- un producto nuevo.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones) y corre completa en una sola
-- transacción (begin/commit).

begin;

-- =========================================================================
-- 1) product_catalog — 4 columnas nuevas + category nullable.
-- =========================================================================
alter table product_catalog
  add column if not exists product_type_id uuid references product_types (id) on delete restrict,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists unit text;

alter table product_catalog alter column category drop not null;

create index if not exists product_catalog_product_type_idx on product_catalog (product_type_id);

-- =========================================================================
-- 2) SKU natural key: organization_id + upper(sku), reemplaza el índice
--    GLOBAL de 0009 (ver DECISIÓN arriba).
-- =========================================================================
drop index if exists product_catalog_sku_unique;

create unique index if not exists product_catalog_org_sku_unique
  on product_catalog (organization_id, upper(sku));

-- =========================================================================
-- 3) rpc_import_product_catalog — INSERT/UPDATE atómico. SECURITY INVOKER:
--    sujeto por completo a product_catalog_admin_write (0019) y a
--    trg_check_product_business_unit_same_org (0019) para cada fila —
--    ninguna validación de autorización se reimplementa aquí. Una
--    excepción en cualquier fila aborta TODA la llamada (comportamiento
--    plpgsql estándar de este proyecto: la función no atrapa excepciones,
--    así que se propagan y revierten la transacción completa del RPC).
--
--    `business_unit_ids` (jsonb array de uuid, posiblemente vacío) —
--    AJUSTE posterior a la aprobación conceptual de Fase 6C: el brief
--    original solo consideraba una Business Unit por fila; la relación
--    real (product_business_units, 0019) siempre fue N:M, así que exportar
--    un producto con 2+ Business Units y reimportarlo colapsaba
--    accidentalmente esas asociaciones a una sola. Ahora cada fila trae la
--    lista completa de Business Units resuelta en el preview — [] sigue
--    significando "compartido con todas" (0 filas), exactamente la misma
--    semántica de siempre.
-- =========================================================================
create or replace function rpc_import_product_catalog(p_products jsonb)
returns table (sku text, action text, product_id uuid)
language plpgsql
as $$
declare
  v_organization_id uuid;
  v_row jsonb;
  v_action text;
  v_id uuid;
  v_sku text;
  v_currency text;
  v_base_price numeric;
  v_price_mxn numeric;
  v_price_usd numeric;
  v_business_unit_id uuid;
  v_product_id uuid;
begin
  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'rpc_import_product_catalog: no se pudo resolver tu organización.';
  end if;

  for v_row in select * from jsonb_array_elements(p_products)
  loop
    v_action := v_row->>'action';
    v_sku := v_row->>'sku';
    v_currency := v_row->>'currency';
    v_base_price := nullif(v_row->>'base_price', '')::numeric;

    if v_currency = 'USD' then
      v_price_usd := v_base_price;
      v_price_mxn := null;
    else
      v_price_mxn := v_base_price;
      v_price_usd := null;
    end if;

    if v_action = 'insert' then
      insert into product_catalog (
        organization_id, sku, name, description, product_type_id, brand, model, unit,
        default_price_mxn, default_price_usd, active
      ) values (
        v_organization_id, v_sku, v_row->>'name', nullif(v_row->>'description', ''),
        nullif(v_row->>'product_type_id', '')::uuid, nullif(v_row->>'brand', ''), nullif(v_row->>'model', ''),
        nullif(v_row->>'unit', ''), v_price_mxn, v_price_usd, coalesce((v_row->>'active')::boolean, true)
      )
      returning id into v_product_id;

    elsif v_action = 'update' then
      v_id := (v_row->>'id')::uuid;

      update product_catalog set
        sku = v_sku,
        name = v_row->>'name',
        description = nullif(v_row->>'description', ''),
        product_type_id = nullif(v_row->>'product_type_id', '')::uuid,
        brand = nullif(v_row->>'brand', ''),
        model = nullif(v_row->>'model', ''),
        unit = nullif(v_row->>'unit', ''),
        default_price_mxn = v_price_mxn,
        default_price_usd = v_price_usd,
        active = coalesce((v_row->>'active')::boolean, true)
      where id = v_id and organization_id = v_organization_id
      returning id into v_product_id;

      if not found then
        raise exception 'rpc_import_product_catalog: producto % no encontrado o sin acceso.', v_id;
      end if;

    else
      raise exception 'rpc_import_product_catalog: acción inválida "%" para SKU %.', v_action, v_sku;
    end if;

    -- Reemplaza por completo las Business Units del producto — mismo
    -- criterio que syncBusinessUnits() del formulario manual
    -- (configuracion/catalogo/actions.ts): 0 filas = compartido con todas.
    -- `business_unit_ids` es un array jsonb de uuid (posiblemente vacío) —
    -- soporta N Business Units por fila, no solo una. Tabla calificada
    -- explícitamente (pbu.product_id): la columna de salida `product_id`
    -- de esta función (RETURNS TABLE) es también una variable implícita en
    -- este scope y colisiona con el nombre de columna real de
    -- product_business_units si se deja sin calificar.
    delete from product_business_units pbu where pbu.product_id = v_product_id;
    for v_business_unit_id in
      select value::uuid from jsonb_array_elements_text(coalesce(v_row->'business_unit_ids', '[]'::jsonb))
    loop
      insert into product_business_units (product_id, business_unit_id)
      values (v_product_id, v_business_unit_id);
    end loop;

    sku := v_sku;
    action := v_action;
    product_id := v_product_id;
    return next;
  end loop;
end;
$$;

commit;
