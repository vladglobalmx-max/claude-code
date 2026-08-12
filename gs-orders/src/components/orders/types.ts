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

export interface ProductItemDraft {
  key: string;
  model: string;
  description: string;
  quantity: number;
  notes: string;
  image: MediaDraft | null;

  // Especificaciones técnicas del equipo (solo se capturan/muestran cuando
  // el pedido es proyector_gobo).
  power: string;
  lensType: string;
  lensPendingFactory: boolean;

  // Proyección de este producto (solo proyector_gobo).
  projectionDescription: string;
  projectionDescriptionEn: string;
  projectionFile: MediaDraft | null;
  projectionWidth: string;
  projectionHeight: string;
  projectionSizeUnit: SizeUnit;
}

/**
 * Instalación y superficie del pedido (proyector_gobo). Ya no lleva equipo
 * ni proyección — eso ahora vive por producto en ProductItemDraft, porque
 * un pedido puede incluir varios proyectores con especificaciones y
 * proyecciones distintas.
 */
export interface ProjectorDraft {
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
  projector: ProjectorDraft;
}

export function emptyProductItem(): ProductItemDraft {
  return {
    key: crypto.randomUUID(),
    model: "",
    description: "",
    quantity: 1,
    notes: "",
    image: null,
    power: "",
    lensType: "",
    lensPendingFactory: false,
    projectionDescription: "",
    projectionDescriptionEn: "",
    projectionFile: null,
    projectionWidth: "",
    projectionHeight: "",
    projectionSizeUnit: "m",
  };
}

export function emptyProjector(): ProjectorDraft {
  return {
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
    projector: emptyProjector(),
  };
}
