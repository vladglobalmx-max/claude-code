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

/**
 * THÖREN Fase 6L (0035_purchases_suppliers.sql) — A QUIÉN LE COMPRAMOS,
 * relación inversa de Customer (a quién le vendemos) — tabla propia, no
 * reutiliza `customers` ni `people` (ver DECISIÓN en la migración).
 * "contacto" es un campo de texto libre en la propia fila (nombre de la
 * persona de contacto) — no hay tabla de contactos múltiples en esta fase.
 * Sin cuentas por pagar ni datos bancarios todavía.
 */
export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_currency: string | null;
  notes: string | null;
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
  // THÖREN Fase 8B (0056) — legacy, deprecated desde 0022, ya nullable
  // (nunca la escribe la app). Nunca asumir non-null en código nuevo.
  business_unit: BusinessUnit | null;
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
  // THÖREN Fase 8B (0056) — legacy, deprecated desde 0022, ya nullable. La
  // relación real es business_unit_id.
  business_unit: BusinessUnit | null;
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

  // THÖREN Fase 6K (0034_order_commitment_dates.sql) — fechas compromiso
  // de cumplimiento logístico, capturadas manualmente (nunca inferidas).
  // Cuál es "la relevante" para el estado de vencimiento depende de
  // operational_status — ver lib/dashboard/due-dates.ts.
  supplier_commitment_date: string | null;
  estimated_reception_date: string | null;
  scheduled_delivery_date: string | null;
  actual_completion_date: string | null;

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

/**
 * THÖREN Fase 6L (0035_purchases_suppliers.sql) — capa simple de Compras
 * vinculada a un Pedido. Un Pedido puede generar 0, 1 o varias Purchase
 * Orders (repartiendo sus partidas entre distintos proveedores).
 * organization_id/order_id/supplier_id/folio/sequence_number son
 * inmutables una vez creada (trg_purchase_orders_prevent_folio_change).
 * business_unit_id NO existe aquí — se deriva siempre vía
 * order_id -> orders.business_unit_id, nunca se duplica.
 *
 * `status`: 'recibida'/'recibida_parcial' SOLO los asigna
 * rpc_receive_purchase_order_item según cantidades reales recibidas —
 * nunca se asignan a mano (ver rpc_update_purchase_order_status).
 * 'cancelada' es terminal: ninguna PO cancelada admite más cambios.
 */
export type PurchaseOrderStatus =
  | "borrador"
  | "ordenada"
  | "confirmada"
  | "en_transito"
  | "recibida_parcial"
  | "recibida"
  | "cancelada";

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  borrador: "Borrador",
  ordenada: "Ordenada",
  confirmada: "Confirmada",
  en_transito: "En tránsito",
  recibida_parcial: "Recibida parcial",
  recibida: "Recibida",
  cancelada: "Cancelada",
};

export const PURCHASE_ORDER_STATUS_BADGE: Record<
  PurchaseOrderStatus,
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  borrador: "neutral",
  ordenada: "accent",
  confirmada: "accent",
  en_transito: "warning",
  recibida_parcial: "warning",
  recibida: "success",
  cancelada: "danger",
};

/** Estados en los que ya se puede registrar recepción (ver rpc_receive_purchase_order_item: bloqueado en 'borrador' y 'cancelada'). */
export const PURCHASE_ORDER_RECEIVABLE_STATUSES: PurchaseOrderStatus[] = [
  "ordenada",
  "confirmada",
  "en_transito",
  "recibida_parcial",
  "recibida",
];

/** Estados asignables a mano vía rpc_update_purchase_order_status — 'recibida'/'recibida_parcial' quedan fuera a propósito. */
export const PURCHASE_ORDER_MANUAL_STATUSES: PurchaseOrderStatus[] = [
  "borrador",
  "ordenada",
  "confirmada",
  "en_transito",
  "cancelada",
];

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  order_id: string;
  supplier_id: string;
  folio: string;
  sequence_number: number;
  po_date: string;
  supplier_commitment_date: string | null;
  estimated_reception_date: string | null;
  supplier_reference: string | null;
  notes: string | null;
  status: PurchaseOrderStatus;
  /**
   * THÖREN Fase 6L — AJUSTE FINAL. Última transición MANUAL de `status`
   * (la mantiene rpc_update_purchase_order_status en cada cambio). La lee
   * rpc_receive_purchase_order_item para volver aquí cuando el recibido
   * total de todas las partidas cae a 0 — así el estado nunca se queda en
   * 'recibida'/'recibida_parcial' sin recepción real. No es un campo que
   * la UI edite directamente.
   */
  pre_receiving_status: PurchaseOrderStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Partida de una Purchase Order — snapshot operativo de un order_item al
 * momento de crear la PO (nunca se vuelve a consultar order_items después,
 * mismo criterio que catalog_product_id en order_items). `order_item_id`
 * es INFORMATIVO, SIN constraint de FK a propósito: rpc_update_order borra
 * y reinserta todas las filas de order_items en cada edición del Pedido
 * (los id nunca son estables), así que una FK real rompería o borraría en
 * silencio Purchase Orders ya creadas al editar el Pedido origen — decisión
 * estructural consultada y confirmada con el usuario antes de implementar.
 * quantity_received nunca puede superar quantity_ordered (CHECK en DB,
 * además del guard de rpc_receive_purchase_order_item).
 */
export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  order_item_id: string | null;
  position: number;
  catalog_product_id: string | null;
  model: string;
  description: string | null;
  color: string | null;
  unit: string | null;
  customer_requirements: string | null;
  quantity_ordered: number;
  quantity_received: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  supplier: Supplier;
  items: PurchaseOrderItem[];
}

/**
 * THÖREN Fase 6M (0036_inventory_mvp.sql) — catálogo de almacenes por
 * organización. A diferencia de suppliers/customers, solo ADMIN puede
 * crear (no solo editar) — ver DECISIÓN en la migración.
 */
export interface Warehouse {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  location: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * THÖREN Fase 6M — ledger inmutable de inventario, ÚNICA fuente de verdad
 * de ON HAND (nunca un contador cacheado — ver DECISIÓN "ON HAND es un
 * ledger" en la migración). Sin UPDATE/DELETE posibles desde la app.
 * `purchase_order_id`/`purchase_order_item_id` solo existen para
 * 'recepcion_compra'/'correccion_recepcion' (trazabilidad a la compra de
 * origen). `order_id`/`inventory_reservation_id` (Fase 6O) solo existen
 * para 'surtido_pedido' (trazabilidad al Pedido/reserva de origen). NULL
 * para movimientos manuales; nunca ambos pares de columnas a la vez.
 */
export type InventoryMovementType =
  | "recepcion_compra"
  | "entrada_manual"
  | "salida_manual"
  | "ajuste_positivo"
  | "ajuste_negativo"
  | "correccion_recepcion"
  | "surtido_pedido";

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  recepcion_compra: "Recepción de compra",
  entrada_manual: "Entrada manual",
  salida_manual: "Salida manual",
  ajuste_positivo: "Ajuste positivo",
  ajuste_negativo: "Ajuste negativo",
  correccion_recepcion: "Corrección de recepción",
  surtido_pedido: "Surtido de Pedido",
};

/** Tipos que ADMIN puede registrar manualmente desde /inventario — 'recepcion_compra'/'correccion_recepcion'/'surtido_pedido' los genera el sistema (recepción de PO / surtido de reserva), nunca un formulario manual. */
export const INVENTORY_MANUAL_MOVEMENT_TYPES: InventoryMovementType[] = [
  "entrada_manual",
  "salida_manual",
  "ajuste_positivo",
  "ajuste_negativo",
];

export interface InventoryMovement {
  id: string;
  organization_id: string;
  product_id: string;
  warehouse_id: string;
  quantity_delta: number;
  movement_type: InventoryMovementType;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  order_id: string | null;
  inventory_reservation_id: string | null;
  reference: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
}

/** Resultado de rpc_inventory_stock_levels — ON HAND agregado por producto × almacén (nunca almacenado, siempre derivado de inventory_movements). */
export interface InventoryStockLevel {
  product_id: string;
  warehouse_id: string;
  on_hand: number;
}

/** Resultado de rpc_inventory_incoming_by_product — INCOMING derivado de Purchase Orders activas, nunca una copia manual. */
export interface InventoryIncomingByProduct {
  product_id: string;
  incoming: number;
}

/**
 * Resultado de rpc_inventory_incoming_detail — trazabilidad completa de lo
 * que viene en camino para un producto (Purchase Order, proveedor, Pedido
 * origen, cantidad pendiente, fechas) sin duplicar esos datos dentro de
 * Inventory: se resuelven vía join en la propia RPC.
 */
export interface InventoryIncomingDetail {
  purchase_order_id: string;
  purchase_order_folio: string;
  supplier_id: string;
  supplier_name: string;
  order_id: string;
  order_folio: string;
  quantity_pending: number;
  supplier_commitment_date: string | null;
  estimated_reception_date: string | null;
}

/** Resultado de rpc_inventory_committed_levels — COMMITTED agregado por producto × almacén = SUMA de reservas ACTIVAS (nunca almacenado, siempre derivado de inventory_reservations). */
export interface InventoryCommittedLevel {
  product_id: string;
  warehouse_id: string;
  committed: number;
}

/**
 * THÖREN Fase 6N — reserva explícita de inventario desde un Pedido. La
 * fila NUNCA se borra: liberar marca `released_at`, conservando el
 * historial (ver DECISIÓN en 0037_inventory_reservations.sql). Como mucho
 * una reserva ACTIVA (released_at is null) por (order_id, product_id).
 * `quantity` es el total reservado/comprometido (lo que administra
 * reservar/aumentar/reducir); `fulfilled_quantity` (Fase 6O) es el
 * acumulado ya surtido — nunca lo mismo, ver DECISIÓN en
 * 0038_inventory_fulfillment.sql. Pendiente por surtir = quantity -
 * fulfilled_quantity; eso, no `quantity`, es lo que cuenta para COMMITTED.
 */
export interface InventoryReservation {
  id: string;
  organization_id: string;
  order_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  fulfilled_quantity: number;
  created_by_user_id: string;
  created_by_name: string;
  released_by_user_id: string | null;
  released_by_name: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryReservationEventType = "creada" | "aumentada" | "reducida" | "liberada" | "surtida";

export const INVENTORY_RESERVATION_EVENT_LABELS: Record<InventoryReservationEventType, string> = {
  creada: "Reservada",
  aumentada: "Aumentada",
  reducida: "Reducida",
  liberada: "Liberada",
  surtida: "Surtida",
};

/** Ledger insert-only de cada cambio de una reserva — mismo criterio que order_operational_status_history. */
export interface InventoryReservationEvent {
  id: string;
  reservation_id: string;
  organization_id: string;
  order_id: string;
  product_id: string;
  warehouse_id: string;
  event_type: InventoryReservationEventType;
  previous_quantity: number | null;
  new_quantity: number;
  changed_by_user_id: string;
  changed_by_name: string;
  changed_at: string;
}

/**
 * THÖREN Fase 6P — Entregas e Instalaciones. Una Entrega SOLO consume
 * cantidades YA SURTIDAS (Fase 6O); nunca vuelve a tocar inventario. Sin
 * folio propio: se muestra como "{folio del Pedido}-E{sequence_number}"
 * (ver DECISIÓN en 0039_deliveries.sql) — nunca almacenado, siempre
 * resuelto vía join.
 */
export type DeliveryType = "entrega" | "instalacion" | "entrega_instalacion";

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  entrega: "Entrega",
  instalacion: "Instalación",
  entrega_instalacion: "Entrega + Instalación",
};

export type DeliveryStatus = "programada" | "en_proceso" | "completada" | "cancelada";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  programada: "Programada",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada: "Cancelada",
};

export const DELIVERY_STATUS_BADGE: Record<DeliveryStatus, "neutral" | "accent" | "success" | "danger"> = {
  programada: "neutral",
  en_proceso: "accent",
  completada: "success",
  cancelada: "danger",
};

/** Estados finales — una vez alcanzados, rpc_update_delivery_status rechaza cualquier cambio posterior. */
export const DELIVERY_TERMINAL_STATUSES: DeliveryStatus[] = ["completada", "cancelada"];

export interface Delivery {
  id: string;
  organization_id: string;
  order_id: string;
  sequence_number: number;
  delivery_type: DeliveryType;
  status: DeliveryStatus;
  scheduled_date: string | null;
  actual_datetime: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  responsible_name: string | null;
  installer_name: string | null;
  installation_datetime: string | null;
  installation_notes: string | null;
  notes: string | null;
  received_by_name: string | null;
  customer_observations: string | null;
  completed_at: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

/** Partida de una Entrega — snapshot de order_items (nunca se vuelve a consultar). INMUTABLE una vez creada (ver DECISIÓN en 0039). */
export interface DeliveryItem {
  id: string;
  delivery_id: string;
  catalog_product_id: string;
  model: string;
  description: string | null;
  unit: string | null;
  quantity_delivered: number;
  created_at: string;
}

/** Ledger insert-only de cambios de estado de una Entrega — mismo criterio que order_operational_status_history (0033). */
export interface DeliveryStatusHistoryEntry {
  id: string;
  delivery_id: string;
  previous_status: DeliveryStatus | null;
  new_status: DeliveryStatus;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export type DeliveryFileKind = "foto" | "documento";

/** Evidencia de una Entrega — reutiliza los buckets order-media/order-files existentes (ver DECISIÓN en 0039), nunca un sistema de archivos nuevo. */
export interface DeliveryFile {
  id: string;
  delivery_id: string;
  kind: DeliveryFileKind;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  position: number;
  created_at: string;
}

/**
 * Resultado de rpc_order_delivery_progress — pedido/surtido/entregado/
 * pendiente por producto de catálogo de UN Pedido. `delivered`/
 * `pending_to_deliver` cuentan CUALQUIER Entrega no cancelada (para poder
 * seguir creando entregas sin sobre-reservar el surtido) — NO es lo mismo
 * que "completada" (ver DECISIÓN en 0039_deliveries.sql sobre los dos
 * agregados distintos de "entregado").
 */
export interface OrderDeliveryProgress {
  catalog_product_id: string;
  ordered: number;
  fulfilled: number;
  delivered: number;
  pending_to_deliver: number;
}
