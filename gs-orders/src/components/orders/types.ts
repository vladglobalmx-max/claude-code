import type {
  HeightUnit,
  Orientation,
  OrderStatus,
  ProductType,
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
 * catalog-product-picker.tsx). Solo incluye catálogo activo.
 */
export interface CatalogProductOption {
  id: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  power: string | null;
  color: string | null;
  technicalNotes: string | null;
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
  clientName: string;
  supplierName: string;
  productType: ProductType;
  status: OrderStatus;
  generalNotes: string;
  vendorNotes: string;
  vendorNotesEn: string;
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
    clientName: "",
    supplierName: "",
    productType: "proyector_gobo",
    status: "borrador",
    generalNotes: "",
    vendorNotes: "",
    vendorNotesEn: "",
    items: [emptyProductItem()],
    images: [],
    files: [],
  };
}
