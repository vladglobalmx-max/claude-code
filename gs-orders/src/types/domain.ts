export type UserRole = "admin" | "vendedor";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "ADMIN",
  vendedor: "VENDEDOR",
};

/** Fila de user_profiles unida con auth.users.email y salespeople — ver admin_list_user_profiles() en 0011_users_roles_rls.sql. */
export interface UserAccessRow {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  salesperson_id: string | null;
  salesperson_name: string | null;
  salesperson_prefix: string | null;
  active: boolean;
  created_at: string;
}

export type BusinessUnit =
  | "thunder"
  | "juno_promotional"
  | "got_fresh_breath"
  | "the_fire_spot";

export const BUSINESS_UNIT_LABELS: Record<BusinessUnit, string> = {
  thunder: "Thunder Safety Solutions / Thunder LED Lights",
  juno_promotional: "Juno Promotional",
  got_fresh_breath: "Got Fresh Breath",
  the_fire_spot: "The Fire Spot",
};

/**
 * THÖREN Core (ver 0013–0017_core_*.sql) — Person/BusinessUnit reales,
 * distintas del `BusinessUnit` de arriba (enum vestigial de
 * salespeople.business_unit/orders.business_unit, sin relación de FK ni
 * de código con estas tablas — ver 0014_core_business_units.sql). Se
 * nombra `BusinessUnitRow` para no chocar con el tipo legacy.
 */
export interface Person {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessUnitRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * THÖREN Quotes Q1 (ver 0018_core_customers.sql) — entidad Core reutilizable
 * (Quotes, y a futuro Orders/CRM/Documents/Invoices). organization_id-scoped,
 * sin relación con orders.client_name (texto libre, sin FK, conviven).
 */
export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Contacto de un Customer (0021_core_customer_contacts.sql). Sin
 * organization_id propio — se resuelve indirectamente vía
 * customer_id → customers.organization_id, igual que quote_items no
 * repite organization_id de su quote padre. is_primary lo mantiene
 * trg_customer_contacts_enforce_primary: como máximo un contacto
 * principal ACTIVO por Customer a la vez; desactivar el principal actual
 * limpia su marca automáticamente.
 */
export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonBusinessUnit {
  person_id: string;
  business_unit_id: string;
  active: boolean;
  created_at: string;
}

/**
 * Los 5 tipos con los que arrancó la app, antes de que "Tipo de producto"
 * se volviera administrable (ver product_types, 0010_product_types.sql).
 * Ya NO son la fuente de verdad de qué tipos existen — eso ahora vive en
 * la tabla product_types y se consulta dinámicamente. Este tipo se
 * conserva únicamente para tipar el diccionario de traducción al inglés
 * del PDF (EN_PRODUCT_TYPE_LABELS en order-detail-content.tsx), que solo
 * cubre estos 5 códigos históricos — un tipo nuevo creado desde
 * Configuración usa su snapshot en español también en el PDF en inglés,
 * en vez de inventarle una traducción.
 */
export type ProductType =
  | "proyector_gobo"
  | "luminaria"
  | "equipo_seguridad"
  | "refaccion_accesorio"
  | "otro";

export type OrderStatus = "borrador" | "pedido" | "cerrado" | "cancelado";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  borrador: "Borrador",
  pedido: "Pedido",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, "neutral" | "accent" | "success" | "danger"> = {
  borrador: "neutral",
  pedido: "accent",
  cerrado: "success",
  cancelado: "danger",
};

export type SizeUnit = "m" | "cm";
export type HeightUnit = "m" | "cm" | "pies";
export type Orientation = "piso" | "pared" | "inclinado" | "otro";
export type UseEnvironment = "interior" | "exterior" | "semi_exterior";
export type SurfaceType =
  | "piso"
  | "pared"
  | "techo"
  | "equipo"
  | "rack"
  | "anden"
  | "pasillo"
  | "otro";
export type SurfaceMaterial =
  | "concreto"
  | "epoxico"
  | "asfalto"
  | "metal"
  | "pintura"
  | "otro";

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  piso: "Hacia piso",
  pared: "Hacia pared",
  inclinado: "Inclinado",
  otro: "Otro",
};

export const USE_LABELS: Record<UseEnvironment, string> = {
  interior: "Interior",
  exterior: "Exterior",
  semi_exterior: "Semi exterior",
};

export const SURFACE_TYPE_LABELS: Record<SurfaceType, string> = {
  piso: "Piso",
  pared: "Pared",
  techo: "Techo",
  equipo: "Equipo",
  rack: "Rack",
  anden: "Andén",
  pasillo: "Pasillo",
  otro: "Otro",
};

export const SURFACE_MATERIAL_LABELS: Record<SurfaceMaterial, string> = {
  concreto: "Concreto",
  epoxico: "Epóxico",
  asfalto: "Asfalto",
  metal: "Metal",
  pintura: "Pintura",
  otro: "Otro",
};

export interface Salesperson {
  id: string;
  business_unit: BusinessUnit;
  name: string;
  prefix: string;
  sequence_current: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  position: number;
  image_path: string | null;
  model: string;
  description: string | null;
  quantity: number;
  notes: string | null;

  // Referencia opcional (solo trazabilidad) al producto del catálogo del
  // que se copió este producto, y color propio del producto — ver
  // 0009_product_catalog.sql. catalog_product_id NUNCA se vuelve a
  // consultar para reconstruir lo que se muestra: todo lo necesario ya
  // está copiado en las columnas de este mismo registro (snapshot).
  catalog_product_id: string | null;
  color: string | null;

  // Especificaciones técnicas del equipo (solo aplica si el pedido es
  // proyector_gobo). Antes vivían una sola vez en `orders`; ahora cada
  // producto tiene las suyas, porque un pedido puede incluir varios
  // proyectores con especificaciones distintas.
  power: string | null;
  lens_type: string | null;
  lens_pending_factory: boolean;

  // Proyección de este producto específico (antes también era una sola
  // columna global en `orders`). projection_file_path/name/type quedan
  // como legacy desde 0007 — la o las imágenes de proyección viven ahora
  // en order_item_images (kind = 'projection').
  projection_description: string | null;
  projection_description_en: string | null;
  projection_file_path: string | null;
  projection_file_name: string | null;
  projection_file_type: string | null;
  projection_width: number | null;
  projection_height: number | null;
  projection_size_unit: SizeUnit | null;

  // Instalación y superficie de este producto específico (antes también
  // eran columnas globales en `orders` — ver 0007_item_installation_and_multi_images.sql).
  // Un mismo pedido puede tener dos proyectores instalados en condiciones
  // distintas.
  installation_height: number | null;
  installation_height_unit: HeightUnit | null;
  installation_distance: number | null;
  installation_orientation: Orientation | null;
  installation_use: UseEnvironment | null;
  surface_type: SurfaceType | null;
  surface_material: SurfaceMaterial | null;
  surface_notes: string | null;
  surface_notes_en: string | null;

  created_at: string;
  updated_at: string;
}

/** Imagen de referencia del producto o imagen a proyectar (0 o varias de cada tipo, por producto). */
export interface OrderItemImage {
  id: string;
  order_item_id: string;
  kind: "reference" | "projection";
  position: number;
  storage_path: string;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
}

export interface OrderImage {
  id: string;
  order_id: string;
  position: number;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface OrderFile {
  id: string;
  order_id: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

/**
 * THÖREN Orders V2 Foundation (0022_orders_v2_foundation.sql) — aditivo
 * sobre Order: organization_id NOT NULL (resuelto siempre server-side,
 * inmutable), customer_id/business_unit_id nullable (sin backfill
 * histórico). `business_unit` (legacy, enum de 4 valores fijos, ver
 * BusinessUnit arriba) sigue existiendo sin cambios — deprecated pero
 * compatible, no relacionado por FK ni código con `business_unit_id`.
 */
export interface Order {
  id: string;
  organization_id: string;
  customer_id: string | null;
  business_unit_id: string | null;
  business_unit: BusinessUnit;
  folio: string;
  sequence_number: number;
  salesperson_id: string;
  order_date: string;
  client_name: string;
  supplier_name: string | null;
  // Código estable del tipo de producto (product_types.code) — ver
  // 0010_product_types.sql. Ya no es un literal fijo: puede ser cualquier
  // código dado de alta desde Configuración → Tipos de producto. La UI
  // especial de Proyector/GOBO sigue dependiendo de comparar este valor
  // contra "proyector_gobo", nunca contra el nombre visible.
  product_type: string;
  // Nombre visible del tipo en el momento en que se creó/editó el pedido
  // (snapshot). Nunca se recalcula al leer: si el tipo se renombra después
  // desde Configuración, este pedido sigue mostrando el nombre original.
  product_type_name_snapshot: string | null;
  status: OrderStatus;
  general_notes: string | null;
  vendor_notes: string | null;
  vendor_notes_en: string | null;

  projector_model: string | null;
  projector_quantity: number | null;
  projector_power: string | null;
  projector_lens_type: string | null;
  projector_lens_pending_factory: boolean;

  projection_description: string | null;
  projection_description_en: string | null;
  projection_file_path: string | null;
  projection_file_name: string | null;
  projection_file_type: string | null;

  projection_width: number | null;
  projection_height: number | null;
  projection_size_unit: SizeUnit | null;

  installation_height: number | null;
  installation_height_unit: HeightUnit | null;
  installation_distance: number | null;
  installation_orientation: Orientation | null;
  installation_use: UseEnvironment | null;

  surface_type: SurfaceType | null;
  surface_material: SurfaceMaterial | null;
  surface_notes: string | null;
  surface_notes_en: string | null;

  created_at: string;
  updated_at: string;
}

export interface OrderWithRelations extends Order {
  salesperson: Salesperson;
  items: OrderItem[];
  images: OrderImage[];
  files: OrderFile[];
}

/**
 * Producto del catálogo administrable (Configuración → Catálogo de
 * productos — ver 0009_product_catalog.sql). `category` es texto libre a
 * propósito: agregar una categoría nueva (Blue Spot, Sensores, etc.) es un
 * registro más, nunca una migración. Esto es independiente de
 * `ProductType`, que sigue clasificando el pedido completo.
 */
export interface ProductCatalogItem {
  id: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  image_path: string | null;
  power: string | null;
  color: string | null;
  lens_type: string | null;
  technical_notes: string | null;
  organization_id: string;
  default_price_mxn: number | null;
  default_price_usd: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * THÖREN Quotes Q2 (ver 0019_core_product_catalog_pricing.sql) — relación
 * N:M Product ↔ Business Unit. Sin fila para un producto = compartido con
 * TODAS las Business Units de su organización; 1+ filas = disponible
 * únicamente para esas Business Units. Sin columna `active`: la fila es la
 * relación, existe o no existe.
 */
export interface ProductBusinessUnit {
  product_id: string;
  business_unit_id: string;
  created_at: string;
}

/**
 * Tipo de producto administrable (Configuración → Tipos de producto — ver
 * 0010_product_types.sql). `code` es el identificador estable e interno
 * que controla comportamiento (p. ej. "proyector_gobo" activa la UI
 * especial de Proyector/GOBO); nunca se edita después de creado. `name` es
 * el texto visible y sí es editable — los pedidos ya creados no se ven
 * afectados por un renombre porque guardan su propio snapshot
 * (Order.product_type_name_snapshot).
 */
export interface ProductTypeItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * THÖREN Quotes Q3 (ver 0020_core_quotes.sql). Lifecycle fijo — transiciones
 * válidas: borrador→enviada|cancelada; enviada→aceptada|rechazada|cancelada;
 * aceptada/rechazada/cancelada son terminales (impuesto por
 * trg_quote_status_transition, no solo por la UI). Fuera de "borrador" el
 * contenido comercial queda congelado en DB.
 */
export type QuoteStatus = "borrador" | "enviada" | "aceptada" | "rechazada" | "cancelada";
export type QuoteCurrency = "MXN" | "USD";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

export const QUOTE_STATUS_BADGE: Record<QuoteStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  borrador: "neutral",
  enviada: "accent",
  aceptada: "success",
  rechazada: "danger",
  cancelada: "warning",
};

/**
 * Cotización (0020_core_quotes.sql). folio/sequence_number/salesperson_id/
 * business_unit_id/quote_date son inmutables una vez generado el folio
 * (trg_prevent_quote_folio_change). Los snapshots (customer_*,
 * business_unit_*, salesperson_name) y los totales (subtotal/discount_total/
 * tax_total/total) los calcula exclusivamente rpc_create_quote/
 * rpc_update_quote — nunca se escriben directo desde la app, y quedan
 * congelados apenas status deja de ser "borrador".
 */
export interface Quote {
  id: string;
  organization_id: string;
  business_unit_id: string;
  salesperson_id: string;
  customer_id: string;

  folio: string;
  sequence_number: number;

  quote_date: string;
  status: QuoteStatus;

  currency: QuoteCurrency;
  tax_rate: number;
  global_discount_percent: number;

  valid_until: string;

  customer_name: string;
  customer_legal_name: string | null;
  customer_tax_id: string | null;
  business_unit_name: string;
  business_unit_code: string;
  salesperson_name: string;

  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;

  notes: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Línea de una Quote (0020_core_quotes.sql). catalog_product_id es solo
 * trazabilidad opcional (línea libre = null) — igual que
 * OrderItem.catalog_product_id, nunca se vuelve a consultar para
 * reconstruir lo que se muestra: model/description/unit_price ya son
 * snapshot. line_subtotal lo calcula el RPC, nunca la app.
 */
export interface QuoteItem {
  id: string;
  quote_id: string;
  position: number;

  catalog_product_id: string | null;

  model: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_discount_percent: number;

  line_subtotal: number;

  created_at: string;
  updated_at: string;
}

/**
 * Motor de folios de Quotes, propio e independiente de
 * salespeople.prefix/sequence_current (ver 0020_core_quotes.sql). Clave
 * Salesperson × Business Unit — un mismo vendedor puede tener un prefijo
 * distinto por cada Business Unit en la que cotiza. sequence_current es
 * propiedad exclusiva de fn_next_quote_folio(): ninguna pantalla de la app
 * lo expone como editable (a diferencia de salespeople.sequence_current,
 * que sí es editable por ADMIN) — RLS además bloquea cualquier UPDATE de
 * VENDEDOR sobre esta tabla, incluida su propia fila.
 */
export interface SalespersonQuoteSequence {
  id: string;
  organization_id: string;
  salesperson_id: string;
  business_unit_id: string;
  quote_prefix: string;
  sequence_current: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
