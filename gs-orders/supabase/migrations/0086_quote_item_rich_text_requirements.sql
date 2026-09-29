-- THÖREN — CotizIA: "Requisitos del cliente" como editor de texto
-- enriquecido + visibilidad en PDF por partida (0086).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- Ticket: convertir quote_items.customer_requirements (hoy texto plano) en
-- un editor tipo Word básico (negrita/cursiva/subrayado/listas/alineación/
-- deshacer-rehacer, Tiptap en la capa de aplicación) y agregar un checkbox
-- por partida "Incluir en la cotización (visible en PDF)". Auditoría previa
-- confirmó: no existe ninguna librería de rich text ni de sanitización en
-- el proyecto hoy; el campo es `text` nullable desde 0028, sin ningún
-- control de visibilidad. Se reutiliza la columna existente — NO se crea
-- un campo paralelo de "alcance" (decisión explícita del usuario).
--
-- =========================================================================
-- DECISIÓN — customer_requirements sigue siendo `text`, ahora con HTML
-- sanitizado adentro; sin cambio de tipo de columna
-- =========================================================================
-- El HTML que produce el editor (Tiptap, capa de aplicación) se sanitiza
-- ANTES de llegar aquí (transform de zod en src/lib/validations/quote.ts,
-- vía src/lib/rich-text.ts — allowlist cerrado: p/strong/b/em/i/u/ul/ol/li/br
-- + style="text-align" únicamente). La autoridad real de seguridad frente a
-- XSS es el SANITIZADO EN LECTURA (RichTextView, antes de cada
-- dangerouslySetInnerHTML): ningún HTML guardado llega al DOM de ningún
-- usuario sin volver a pasar por el sanitizador al momento de renderizarse.
--
-- REVISIÓN DE SEGURIDAD (mismo ticket, ronda 2) — rpc_create_quote,
-- rpc_update_quote y rpc_create_quote_revision NUNCA han tenido su EXECUTE
-- revocado (igual que el resto de RPC de Quotes desde 0020/0025/0031/0085);
-- son invocables directamente vía supabase-js/PostgREST por cualquier
-- usuario autenticado, sin pasar por el zod transform de la app. Eso
-- significa que, sin un control aquí, la base de datos podía quedar
-- contaminada con HTML crudo (`<script>`, `<img onerror=...>`,
-- `<... onclick=...>`) aunque nunca se ejecutara en un navegador (por el
-- sanitizado en lectura). Para no depender EXCLUSIVAMENTE de la UI (tal
-- como exige el ticket), se agrega fn_check_rich_text_safety(text): un
-- guardia de bloqueo (NO un parser de HTML — Postgres no tiene uno nativo,
-- y no se justifica duplicar uno) que rechaza con excepción cualquier
-- customer_requirements con etiquetas peligrosas (`script`, `iframe`,
-- `object`, `embed`, `style`, `svg`), atributos de evento (`on\w+=` dentro
-- de una etiqueta) o esquemas peligrosos (`javascript:`, `data:text/html`).
-- Se invoca en las tres RPC, en el mismo loop de validación de items que ya
-- corre fn_check_quote_item_catalog_product — antes de cualquier insert, y
-- antes del insert a quote_versions en rpc_create_quote_revision fue hecho
-- primero en el código, pero Postgres revierte TODO el trabajo de la
-- función si la excepción se propaga (una función sin subtransacción propia
-- es atómica dentro de la transacción que la invoca) — sin fila fantasma en
-- quotes/quote_items/quote_versions. Restringir EXECUTE no es viable aquí:
-- estas tres RPC son la única forma en que la app legítima opera bajo la
-- sesión del propio usuario (a diferencia de rpc_provision_organization,
-- pensada exclusivamente para service_role) — revocarlo rompería el feature
-- completo de Cotizaciones para cualquier usuario legítimo.
--
-- =========================================================================
-- DECISIÓN — customer_requirements_visible_in_pdf: nueva columna,
-- DEFAULT true
-- =========================================================================
-- `true` por default preserva EXACTAMENTE el comportamiento actual para
-- cualquier quote_item ya existente (hoy customer_requirements SIEMPRE se
-- imprime si tiene contenido) — cero regresión visual en cotizaciones ya
-- creadas. Es un booleano por PARTIDA (igual granularidad que
-- customer_requirements), no por Quote completa. Solo afecta el PDF de
-- Cotización: si está en false, el contenido se guarda igual (nunca se
-- borra) pero no se imprime; si customer_requirements está vacío, nunca se
-- reserva espacio, sin importar este booleano.
--
-- Fuera de alcance a propósito: `order_items.customer_requirements`
-- (0029) NO recibe esta columna. El Pedido es un documento operativo
-- interno, no el documento comercial que ve el cliente — sigue
-- imprimiendo customer_requirements siempre, sin toggle, exactamente como
-- hoy. Sí se actualizan (fuera de esta migración, en la capa de
-- aplicación) los renders de order_items.customer_requirements para
-- interpretar HTML en vez de texto plano — necesario porque
-- rpc_create_order_from_quote copia el valor tal cual desde quote_items, y
-- ese valor ahora puede ser HTML.
--
-- =========================================================================
-- DECISIÓN — rpc_create_quote / rpc_update_quote / rpc_create_quote_revision:
-- reemplazo forward-only, mismas firmas
-- =========================================================================
-- Ninguna migración anterior (0020/0025/0031/0085) se edita. Las tres
-- funciones se reemplazan con `create or replace` (firma idéntica —
-- p_items sigue siendo jsonb arbitrario, no hace falta drop) — el único
-- cambio real en cada una es que el INSERT a quote_items ahora incluye
-- `customer_requirements_visible_in_pdf`, leído de
-- `p_items[].customer_requirements_visible_in_pdf` con
-- `coalesce(..., true)` (mismo default que la columna — un caller que no
-- mande esta clave, incluido cualquier integración futura, se comporta
-- exactamente como hoy). El resto del cuerpo de las tres funciones es
-- carácter por carácter idéntico a su versión anterior (0031 para las
-- primeras dos, 0085 para la tercera).
--
-- Como el resto del proyecto: idempotente donde aplica y corre completa en
-- una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) quote_items.customer_requirements_visible_in_pdf
-- =========================================================================
alter table quote_items
  add column if not exists customer_requirements_visible_in_pdf boolean not null default true;

-- =========================================================================
-- 2) fn_check_rich_text_safety — guardia de bloqueo (no un parser de HTML)
--    contra HTML peligroso, para no depender exclusivamente del zod
--    transform de la app (ver REVISIÓN DE SEGURIDAD arriba). Se aplica solo
--    a customer_requirements (el único campo de esta tabla que se renderiza
--    alguna vez vía dangerouslySetInnerHTML) — NO a description, que nunca
--    es HTML y se interpola como texto plano en React.
-- =========================================================================
create or replace function fn_check_rich_text_safety(p_html text)
returns void
language plpgsql
as $$
begin
  if p_html is null then
    return;
  end if;

  -- NOTA: \y es el escape de "límite de palabra" en las Advanced Regular
  -- Expressions de Postgres — \b (como en Perl/JS) aquí es el carácter de
  -- backspace, NO un límite de palabra; usarlo por error deja el guardia
  -- completamente inerte (detectado en la ronda de pruebas de este ticket).
  if p_html ~* '<\s*(script|iframe|object|embed|style|svg)\y'
     or p_html ~* '<[a-z][^>]*\son\w+\s*='
     or p_html ~* 'javascript\s*:'
     or p_html ~* 'data\s*:\s*text/html'
  then
    raise exception
      'fn_check_rich_text_safety: customer_requirements contiene HTML no permitido (etiqueta, atributo de evento o esquema peligroso).';
  end if;
end;
$$;

-- =========================================================================
-- 3) rpc_create_quote — idéntica a 0031 salvo la columna nueva en el INSERT
--    de quote_items y la llamada a fn_check_rich_text_safety.
-- =========================================================================
create or replace function rpc_create_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_business_unit_id uuid := (p_quote->>'business_unit_id')::uuid;
  v_salesperson_id uuid := (p_quote->>'salesperson_id')::uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_quote_date date := coalesce((p_quote->>'quote_date')::date, current_date);
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := coalesce((p_quote->>'valid_until')::date, (coalesce((p_quote->>'quote_date')::date, current_date) + 15));
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_organization_id uuid;
  v_bu_name text;
  v_bu_code text;
  v_sp_name text;
  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_folio_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select organization_id, name, code into v_organization_id, v_bu_name, v_bu_code
    from business_units where id = v_business_unit_id;
  if v_organization_id is null then
    raise exception 'rpc_create_quote: business unit % no encontrada.', v_business_unit_id;
  end if;

  select name into v_sp_name from salespeople where id = v_salesperson_id;
  if v_sp_name is null then
    raise exception 'rpc_create_quote: salesperson % no encontrado.', v_salesperson_id;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote: customer % no encontrado.', v_customer_id;
  end if;

  select * into v_folio_result from fn_next_quote_folio(v_salesperson_id, v_business_unit_id, v_quote_date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id);
    end if;
    perform fn_check_rich_text_safety(v_item->>'customer_requirements');

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  insert into quotes (
    id, organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status,
    currency, tax_rate, global_discount_percent, valid_until,
    customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total, notes,
    payment_terms, delivery_time, customer_notes, warranty
  )
  values (
    p_quote_id, v_organization_id, v_business_unit_id, v_salesperson_id, v_customer_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_quote_date, 'borrador',
    v_currency, v_tax_rate, v_global_discount_percent, v_valid_until,
    v_customer_name, v_customer_legal_name, v_customer_tax_id,
    v_bu_name, v_bu_code, v_sp_name,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_notes,
    v_payment_terms, v_delivery_time, v_customer_notes, v_warranty
  )
  returning * into v_quote;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements,
      customer_requirements_visible_in_pdf
    )
    values (
      v_quote.id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
      coalesce((v_item->>'customer_requirements_visible_in_pdf')::boolean, true)
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 4) rpc_update_quote — idéntica a 0031 salvo la columna nueva en el
--    INSERT de quote_items y la llamada a fn_check_rich_text_safety. Sigue
--    rechazando cualquier escritura fuera de "borrador" (sin cambios ahí).
-- =========================================================================
create or replace function rpc_update_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_current_status text;
  v_organization_id uuid;
  v_business_unit_id uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := (p_quote->>'valid_until')::date;
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select status, organization_id, business_unit_id into v_current_status, v_organization_id, v_business_unit_id
    from quotes where id = p_quote_id;
  if v_current_status is null then
    raise exception 'rpc_update_quote: Quote % no encontrada.', p_quote_id;
  end if;
  if v_current_status <> 'borrador' then
    raise exception
      'rpc_update_quote: la Quote % no está en borrador (status actual: %); su contenido comercial no puede editarse.',
      p_quote_id, v_current_status;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_update_quote: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id);
    end if;
    perform fn_check_rich_text_safety(v_item->>'customer_requirements');

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  update quotes set
    customer_id = v_customer_id,
    currency = v_currency,
    tax_rate = v_tax_rate,
    global_discount_percent = v_global_discount_percent,
    valid_until = v_valid_until,
    customer_name = v_customer_name,
    customer_legal_name = v_customer_legal_name,
    customer_tax_id = v_customer_tax_id,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    total = v_total,
    notes = v_notes,
    payment_terms = v_payment_terms,
    delivery_time = v_delivery_time,
    customer_notes = v_customer_notes,
    warranty = v_warranty
  where id = p_quote_id
  returning * into v_quote;

  if not found then
    raise exception 'rpc_update_quote: Quote % no encontrada al actualizar.', p_quote_id;
  end if;

  delete from quote_items where quote_id = p_quote_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements,
      customer_requirements_visible_in_pdf
    )
    values (
      p_quote_id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
      coalesce((v_item->>'customer_requirements_visible_in_pdf')::boolean, true)
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 5) rpc_create_quote_revision — idéntica a 0085 salvo la columna nueva en
--    el INSERT de quote_items y la llamada a fn_check_rich_text_safety.
--    Sigue exigiendo status 'enviada' y sigue fijando
--    thoren.creating_quote_revision antes del UPDATE de status (0085) —
--    nada de eso cambia.
-- =========================================================================
create or replace function rpc_create_quote_revision(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_created_by_name text;
  v_items_snapshot jsonb;

  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := (p_quote->>'valid_until')::date;
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'rpc_create_quote_revision: Quote % no encontrada.', p_quote_id;
  end if;

  if not (
    is_organization_admin(v_quote.organization_id)
    or (is_organization_member(v_quote.organization_id) and v_quote.salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'rpc_create_quote_revision: no tienes permiso para crear una nueva versión de esta cotización.';
  end if;

  if v_quote.status <> 'enviada' then
    raise exception
      'rpc_create_quote_revision: solo se puede crear una nueva versión de una cotización en estado "enviada" (actual: %). Si está en borrador, guárdala directamente; si ya fue aceptada/rechazada, duplícala.',
      v_quote.status;
  end if;

  select name into v_created_by_name from user_profiles where user_id = auth.uid();

  select coalesce(jsonb_agg(to_jsonb(qi) order by qi.position), '[]'::jsonb)
    into v_items_snapshot
    from quote_items qi where qi.quote_id = p_quote_id;

  insert into quote_versions (quote_id, version, snapshot, created_by, created_by_name)
  values (
    p_quote_id,
    v_quote.version,
    jsonb_build_object('quote', to_jsonb(v_quote), 'items', v_items_snapshot),
    auth.uid(),
    v_created_by_name
  );

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote_revision: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_quote.organization_id, v_quote.business_unit_id);
    end if;
    perform fn_check_rich_text_safety(v_item->>'customer_requirements');

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  perform set_config('thoren.creating_quote_revision', 'true', true);

  update quotes set
    customer_id = v_customer_id,
    currency = v_currency,
    tax_rate = v_tax_rate,
    global_discount_percent = v_global_discount_percent,
    valid_until = v_valid_until,
    customer_name = v_customer_name,
    customer_legal_name = v_customer_legal_name,
    customer_tax_id = v_customer_tax_id,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    total = v_total,
    notes = v_notes,
    payment_terms = v_payment_terms,
    delivery_time = v_delivery_time,
    customer_notes = v_customer_notes,
    warranty = v_warranty,
    status = 'borrador',
    version = v_quote.version + 1
  where id = p_quote_id
  returning * into v_quote;

  delete from quote_items where quote_id = p_quote_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements,
      customer_requirements_visible_in_pdf
    )
    values (
      p_quote_id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
      coalesce((v_item->>'customer_requirements_visible_in_pdf')::boolean, true)
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

commit;
