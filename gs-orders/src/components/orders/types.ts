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
}

export interface ProjectorDraft {
  model: string;
  quantity: string;
  power: string;
  lensType: string;
  lensPendingFactory: boolean;
  description: string;
  file: MediaDraft | null;
  width: string;
  height: string;
  sizeUnit: SizeUnit;
  installationHeight: string;
  installationHeightUnit: HeightUnit;
  installationDistance: string;
  orientation: Orientation | "";
  use: UseEnvironment | "";
  surfaceType: SurfaceType | "";
  surfaceMaterial: SurfaceMaterial | "";
  surfaceNotes: string;
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
  };
}

export function emptyProjector(): ProjectorDraft {
  return {
    model: "",
    quantity: "",
    power: "",
    lensType: "",
    lensPendingFactory: false,
    description: "",
    file: null,
    width: "",
    height: "",
    sizeUnit: "m",
    installationHeight: "",
    installationHeightUnit: "m",
    installationDistance: "",
    orientation: "",
    use: "",
    surfaceType: "",
    surfaceMaterial: "",
    surfaceNotes: "",
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
    items: [emptyProductItem()],
    images: [],
    files: [],
    projector: emptyProjector(),
  };
}
