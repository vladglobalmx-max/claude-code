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

export type ProductType =
  | "proyector_gobo"
  | "luminaria"
  | "equipo_seguridad"
  | "refaccion_accesorio"
  | "otro";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  proyector_gobo: "Proyector / GOBO",
  luminaria: "Luminaria",
  equipo_seguridad: "Equipo de seguridad",
  refaccion_accesorio: "Refacción / Accesorio",
  otro: "Otro",
};

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
  created_at: string;
  updated_at: string;
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
  product_type: ProductType;
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
