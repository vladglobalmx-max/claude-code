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
  // THÖREN Business Unit Branding (0024_business_unit_branding.sql) —
  // referencia al archivo en el bucket business-unit-assets, nunca una URL
  // absoluta. Nullable: una BU sin logo sigue funcionando normalmente.
  logo_path: string | null;
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

/**
 * THÖREN Fase 6H (0033_order_operational_status.sql) — seguimiento
 * operativo de un pedido, INDEPENDIENTE de `OrderStatus` de arriba (ver
 * DECISIÓN en la migración): `status` es el gate de captura (¿sigue siendo
 * borrador editable? ¿ya se envió? ¿consumió folio?); `operational_status`
 * es en qué paso de cumplimiento logístico va un pedido ya enviado. Ningún
 * valor es terminal — las transiciones son libres, igual que `status` hoy
 * (mismo criterio que OrderStatusQuickActions: es una herramienta de
 * seguimiento, no un documento legal con estados terminales como Quotes).
 */
export type OrderOperationalStatus =
  | "pedido"
  | "en_proceso"
  | "ordenado_a_proveedor"
  | "en_transito"
  | "recibido"
  | "programado_entrega_instalacion"
  | "completado"
  | "cancelado";

export const ORDER_OPERATIONAL_STATUS_LABELS: Record<OrderOperationalStatus, string> = {
  pedido: "Pedido",
  en_proceso: "En proceso",
  ordenado_a_proveedor: "Ordenado a proveedor",
  en_transito: "En tránsito",
  recibido: "Recibido",
  programado_entrega_instalacion: "Programado para entrega/instalación",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ORDER_OPERATIONAL_STATUS_BADGE: Record<
  OrderOperationalStatus,
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  pedido: "neutral",
  en_proceso: "accent",
  ordenado_a_proveedor: "accent",
  en_transito: "warning",
  recibido: "accent",
  programado_entrega_instalacion: "warning",
  completado: "success",
  cancelado: "danger",
};

/**
 * Una fila de order_operational_status_history (0033) — INSERT-only vía
 * trigger, nunca escrita directamente por la app. `changed_by_name` es un
 * snapshot del nombre en el momento del cambio (igual criterio que
 * client_name/product_type_name_snapshot en el resto del proyecto): si el
 * usuario cambia de nombre o se desactiva después, el historial sigue
 * mostrando quién lo hizo tal como se llamaba ese día.
 */
export interface OrderOperationalStatusHistoryEntry {
  id: string;
  order_id: string;
  previous_status: OrderOperationalStatus | null;
  new_status: OrderOperationalStatus;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

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

  /**
   * Datos operativos por línea (0029_quote_order_hardening.sql, Fase 6F).
   * `unit` se autocompleta desde product_catalog.unit al elegir un
   * producto del catálogo (sigue editable); `customer_requirements` es
   * captura operativa manual, nunca se infiere del catálogo.
   */
  unit: string | null;
  customer_requirements: string | null;

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
  // THÖREN Quote → Order (0023_quote_to_order.sql) — nullable, único
  // parcial: una Quote aceptada genera como máximo un Order. Se asigna
  // exclusivamente dentro de rpc_create_order_from_quote, nunca desde la
  // app directamente.
  source_quote_id: string | null;
  business_unit: BusinessUnit;
  folio: string;
  sequence_number: number;
  salesperson_id: string;
  order_date: string;
  client_name: string;
  supplier_name: string | null;
  // THÖREN Fase 6H (0033_order_operational_status.sql) — seguimiento
  // operativo, independiente de `status` (ver OrderOperationalStatus
  // arriba). Cambiarlo genera una fila en order_operational_status_history
  // automáticamente (trigger).
  operational_status: OrderOperationalStatus;
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
  category: string | null;
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
  // Fase 6C (0030_product_catalog_master.sql) — Catálogo Maestro.
  product_type_id: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
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
 * business_unit_*, salesperson_name), los totales (subtotal/discount_total/
 * tax_total/total) y las condiciones comerciales (payment_terms/
 * delivery_time/customer_notes, 0025_quote_commercial_terms.sql) los
 * calcula/persiste exclusivamente rpc_create_quote/rpc_update_quote —
 * nunca se escriben directo desde la app, y quedan congelados apenas
 * status deja de ser "borrador". `notes` es la única excepción: es una
 * nota interna del equipo, nunca impresa, y nunca se congela.
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

  /** Condiciones comerciales para el cliente (0025_quote_commercial_terms.sql) — opcionales, se imprimen en el Quote PDF. Nunca confundir con `notes`, que es exclusivamente interno. */
  payment_terms: string | null;
  delivery_time: string | null;
  customer_notes: string | null;

  /**
   * THÖREN Quotes Historical Import (0028_quotes_historical_import_schema.sql).
   * `source` distingue Quotes reales de THÖREN ('thoren', default) de
   * cotizaciones históricas migradas desde CotizIA ('cotizia').
   * `original_folio` solo existe para `source = 'cotizia'` (CHECK en DB):
   * el folio CRUDO tal como salió de CotizIA, antes de cualquier
   * corrección de prefijo — `folio` sigue siendo el ya corregido/mostrado.
   * `customer_contact_name`/`customer_email`/`customer_phone`: snapshot
   * histórico, nunca se vuelven a resolver contra `customer_contacts`
   * (que es una tabla viva). `historical_pdf_path`: path en el bucket
   * privado `quote-archive`, resuelto vía signed URL igual que cualquier
   * otro archivo de Storage en el proyecto. `warranty`: texto libre de la
   * sección "Garantía" del PDF histórico ("1 año por defectos de
   * fabricación"…) — igual que payment_terms/delivery_time, es contenido
   * comercial editable mientras la Quote esté en 'borrador'.
   */
  source: "thoren" | "cotizia";
  original_folio: string | null;
  historical_pdf_path: string | null;
  customer_contact_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  warranty: string | null;

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

  /**
   * THÖREN Quotes Historical Import (0028) — texto libre tal como aparece
   * en el PDF histórico ("pza", "Pieza", "Unidad de servicio"…). NUNCA se
   * inventa cuando el PDF no trae unidad; NULL en ese caso.
   */
  unit: string | null;

  /**
   * THÖREN Quotes Historical Import (0028) — la caja "Requisitos del
   * cliente" que aparece por línea en varios PDFs históricos (técnica de
   * impresión, color, dimensiones, instalación, indicaciones
   * particulares…). Deliberadamente separado de `description`/
   * `customer_notes` — es especificación técnica de esa línea, no
   * descripción comercial ni nota general. NUNCA inventado; NULL si el PDF
   * no lo trae.
   */
  customer_requirements: string | null;

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
