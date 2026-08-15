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

export interface Order {
  id: string;
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
  active: boolean;
  created_at: string;
  updated_at: string;
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
