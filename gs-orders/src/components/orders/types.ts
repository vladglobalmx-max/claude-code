import type {
  HeightUnit,
  Orientation,
  OrderStatus,
  SizeUnit,
  SurfaceMaterial,
  SurfaceType,
  UseEnvironment,
} from "@/types/domain";

export interface MediaDraft {
  key: string;
  path: string;
  name: string;
  type: string;
  size: number;
  previewUrl: string | null;
  caption?: string;
  uploading?: boolean;
}

/**
 * Producto del catálogo administrable, ya con la imagen resuelta a una URL
 * firmada — para mostrar en el selector de Nuevo Pedido / Editar (ver
 * catalog-product-picker.tsx).
 *
 * Fase 6F (homologación con el Quote Builder de Fase 6D): `model`/`brand`
 * reutilizan las columnas reales del Catálogo Maestro (0030); `unit` se
 * usa para autocompletar order_items.unit; `productTypeName` y
 * `businessUnitNames` son solo metadata para mostrar/filtrar en el
 * picker — `businessUnitNames` nunca se copia a order_items, es
 * display únicamente (mismo criterio que Product Type en Quotes, Fase 6D).
 * `businessUnitIds` es la elegibilidad real (0 = TODAS, 1+ = solo esas).
 *
 * La lista de productos que llega aquí NO se limita a `active = true`:
 * las páginas de Nuevo/Editar Pedido incluyen también, cuando aplica, el
 * o los productos inactivos que un Order YA tiene asociados (ver
 * DECISIÓN "producto histórico inactivo", Fase 6F) — `active` viaja
 * explícito para que el picker pueda ocultar exclusivamente los inactivos
 * de la lista de SELECCIÓN nueva sin perder la capacidad de mostrar
 * correctamente una línea ya existente.
 */
export interface CatalogProductOption {
  id: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  model: string | null;
  brand: string | null;
  unit: string | null;
  productTypeName: string | null;
  power: string | null;
  color: string | null;
  technicalNotes: string | null;
  active: boolean;
  businessUnitIds: string[];
  businessUnitNames: string[];
  imagePath: string | null;
  imagePreviewUrl: string | null;
}

export interface ProductItemDraft {
  key: string;
  model: string;
  description: string;
  quantity: number;
  notes: string;
  image: MediaDraft | null;
  referenceImages: MediaDraft[];

  // Referencia opcional (trazabilidad) al producto del catálogo elegido y
  // color del producto (solo aplica a productos no proyector/GOBO). Elegir
  // un producto del catálogo copia sus datos aquí una sola vez (snapshot);
  // nunca se vuelve a consultar el catálogo para este producto.
  catalogProductId: string | null;
  color: string;

  /**
   * Datos operativos por línea (0029, Fase 6F). `unit` se autocompleta
   * desde product_catalog.unit al elegir del catálogo (sigue editable);
   * `customerRequirements` es captura operativa manual, nunca se infiere
   * del catálogo.
   */
  unit: string;
  customerRequirements: string;

  // Especificaciones técnicas del equipo (potencia aplica a cualquier
  // producto; lente/pendiente-de-fábrica solo cuando el pedido es
  // proyector_gobo).
  power: string;
  lensType: string;
  lensPendingFactory: boolean;

  // Proyección de este producto (solo proyector_gobo). Puede tener varias
  // imágenes (ver 0007_item_installation_and_multi_images.sql).
  projectionDescription: string;
  projectionDescriptionEn: string;
  projectionImages: MediaDraft[];
  projectionWidth: string;
  projectionHeight: string;
  projectionSizeUnit: SizeUnit;

  // Instalación y superficie de este producto (solo proyector_gobo). Un
  // mismo pedido puede tener proyectores instalados en condiciones
  // distintas.
  installationHeight: string;
  installationHeightUnit: HeightUnit;
  installationDistance: string;
  orientation: Orientation | "";
  use: UseEnvironment | "";
  surfaceType: SurfaceType | "";
  surfaceMaterial: SurfaceMaterial | "";
  surfaceNotes: string;
  surfaceNotesEn: string;
}

export interface OrderFormState {
  orderDate: string;
  salespersonId: string;
  /**
   * Fase 6F — antes no existía en el Order Form (orders.business_unit_id
   * siempre quedaba NULL para un pedido manual, ver DECISIÓN "Business
   * Unit nula" de 0032). "" = sin elegir; el picker de catálogo exige una
   * Business Unit seleccionada antes de habilitarse (Fase 6F §4). A
   * diferencia de salespersonId/orderDate, business_unit_id NO se congela
   * al generar folio — rpc_update_order ya lo permite editar (0022,
   * "ausente ≠ null"), así que sigue editable en modo edición.
   */
  businessUnitId: string;
  clientName: string;
  supplierName: string;
  // Código de product_types.code (administrable, ver 0010_product_types.sql) — ya no un literal fijo.
  productType: string;
  status: OrderStatus;
  generalNotes: string;
  vendorNotes: string;
  vendorNotesEn: string;
  /**
   * Fase 6K (0034) — fechas compromiso de cumplimiento logístico, captura
   * manual (nunca inferidas). "" = sin capturar. Sobrescritura directa en
   * rpc_update_order (no aplica "ausente ≠ null" — son campos escalares,
   * no relaciones — ver DECISIÓN en la migración).
   */
  supplierCommitmentDate: string;
  estimatedReceptionDate: string;
  scheduledDeliveryDate: string;
  actualCompletionDate: string;
  items: ProductItemDraft[];
  images: MediaDraft[];
  files: MediaDraft[];
}

export function emptyProductItem(): ProductItemDraft {
  return {
    key: crypto.randomUUID(),
    model: "",
    description: "",
    quantity: 1,
    notes: "",
    image: null,
    referenceImages: [],
    catalogProductId: null,
    color: "",
    unit: "",
    customerRequirements: "",
    power: "",
    lensType: "",
    lensPendingFactory: false,
    projectionDescription: "",
    projectionDescriptionEn: "",
    projectionImages: [],
    projectionWidth: "",
    projectionHeight: "",
    projectionSizeUnit: "m",
    installationHeight: "",
    installationHeightUnit: "m",
    installationDistance: "",
    orientation: "",
    use: "",
    surfaceType: "",
    surfaceMaterial: "",
    surfaceNotes: "",
    surfaceNotesEn: "",
  };
}

export function emptyOrderForm(defaultDate: string): OrderFormState {
  return {
    orderDate: defaultDate,
    salespersonId: "",
    businessUnitId: "",
    clientName: "",
    supplierName: "",
    productType: "proyector_gobo",
    status: "borrador",
    generalNotes: "",
    vendorNotes: "",
    vendorNotesEn: "",
    supplierCommitmentDate: "",
    estimatedReceptionDate: "",
    scheduledDeliveryDate: "",
    actualCompletionDate: "",
    items: [emptyProductItem()],
    images: [],
    files: [],
  };
}
