import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { RoleCode } from "../src/generated/prisma/enums";
import { computeLandedCost, computeSalePriceFromMargin } from "../src/lib/catalog/margin";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "GlobalQuote2026!";

const BUSINESS_UNITS = [
  { code: "TSS", name: "Thunder Safety Solutions" },
  { code: "TLL", name: "Thunder LED Lights" },
  { code: "GFB", name: "Got Fresh Breath México" },
  { code: "TFS", name: "The Fire Spot" },
  { code: "JUN", name: "Juno Promotional" },
  { code: "GTX", name: "GTX Systems" },
  { code: "GSM", name: "Global Supplier General" },
] as const;

const ROLES: { code: RoleCode; name: string; description: string }[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Administrador",
    description: "Acceso total al sistema: usuarios, folios, plantillas, auditoría.",
  },
  {
    code: "DIRECCION_GENERAL",
    name: "Dirección General",
    description: "Ve toda la operación, costos y márgenes; autoriza excepciones.",
  },
  {
    code: "ADMINISTRACION",
    name: "Administración",
    description: "Administra clientes, productos, precios y aprueba cotizaciones.",
  },
  {
    code: "GERENTE_VENTAS",
    name: "Gerente de Ventas",
    description: "Ve y aprueba cotizaciones de su equipo dentro de su rango.",
  },
  {
    code: "VENDEDOR",
    name: "Vendedor",
    description: "Crea cotizaciones de sus clientes asignados; sin acceso a costos.",
  },
  {
    code: "MARKETING",
    name: "Marketing",
    description: "Administra fichas comerciales e imágenes de producto.",
  },
  {
    code: "CONSULTA",
    name: "Consulta",
    description: "Solo visualiza la información expresamente autorizada.",
  },
];

const DEMO_USERS: { email: string; fullName: string; role: RoleCode; businessUnits: string[] }[] =
  [
    {
      email: "ana.torres@globalsuppliermty.com",
      fullName: "Ana Torres",
      role: "SUPER_ADMIN",
      businessUnits: BUSINESS_UNITS.map((bu) => bu.code),
    },
    {
      email: "direccion.general.demo@globalsuppliermty.com",
      fullName: "Dirección General (demo)",
      role: "DIRECCION_GENERAL",
      businessUnits: BUSINESS_UNITS.map((bu) => bu.code),
    },
    {
      email: "laura.gonzalez@globalsuppliermty.com",
      fullName: "Laura González",
      role: "ADMINISTRACION",
      businessUnits: BUSINESS_UNITS.map((bu) => bu.code),
    },
    {
      email: "carlos.medina@globalsuppliermty.com",
      fullName: "Carlos Medina",
      role: "GERENTE_VENTAS",
      businessUnits: ["TSS", "TLL", "GFB"],
    },
    {
      email: "diego.ramirez@globalsuppliermty.com",
      fullName: "Diego Ramírez",
      role: "VENDEDOR",
      businessUnits: ["TSS", "GFB"],
    },
    {
      email: "sofia.hernandez@globalsuppliermty.com",
      fullName: "Sofía Hernández",
      role: "MARKETING",
      businessUnits: BUSINESS_UNITS.map((bu) => bu.code),
    },
    {
      email: "consulta.demo@globalsuppliermty.com",
      fullName: "Usuario de Consulta",
      role: "CONSULTA",
      businessUnits: BUSINESS_UNITS.map((bu) => bu.code),
    },
  ];

// ---------------------------------------------------------------------------
// Catalogo demo Modulo 3 (alcance basico), linea GFB — Got Fresh Breath Mexico.
// Ver docs/ARCHITECTURE.md §6/§7/§8. Precios calculados con el motor de
// margen (src/lib/catalog/margin.ts), salvo GFB-ENJ-004: se deja con un
// precio "viejo" a proposito para demostrar la bandera de margen por debajo
// del minimo (§8.2 — requeriria autorizacion de Direccion General).
// ---------------------------------------------------------------------------

const GFB_ROOT_CATEGORIES = [
  "Enjuagues bucales",
  "Aerosoles bucales",
  "Pastillas y chicles",
  "Higiene complementaria",
] as const;

const GFB_SUBCATEGORIES: { name: string; parent: string }[] = [
  { name: "Enjuagues sin alcohol", parent: "Enjuagues bucales" },
  { name: "Enjuagues con flúor", parent: "Enjuagues bucales" },
];

type GfbProductSeed = {
  sku: string;
  name: string;
  shortDescription: string;
  category: string;
  uom: string;
  purchaseCost: number;
  logisticsCost: number;
  importExpenses: number;
  targetMarginPct: number;
  minMarginPct: number;
  /** Si se define, se usa este precio de lista en vez del calculado por margen objetivo. */
  staleListPrice?: number;
};

const GFB_PRODUCTS: GfbProductSeed[] = [
  {
    sku: "GFB-ENJ-001",
    name: "Enjuague Bucal Menta Intensa 500ml",
    shortDescription: "Enjuague bucal sin alcohol, sabor menta intensa.",
    category: "Enjuagues sin alcohol",
    uom: "PZA",
    purchaseCost: 28,
    logisticsCost: 2,
    importExpenses: 0,
    targetMarginPct: 35,
    minMarginPct: 25,
  },
  {
    sku: "GFB-ENJ-002",
    name: "Enjuague Bucal Fresa Menta 500ml",
    shortDescription: "Enjuague bucal sin alcohol, sabor fresa menta.",
    category: "Enjuagues sin alcohol",
    uom: "PZA",
    purchaseCost: 26,
    logisticsCost: 2,
    importExpenses: 0,
    targetMarginPct: 35,
    minMarginPct: 25,
  },
  {
    sku: "GFB-ENJ-003",
    name: "Enjuague Bucal Flúor Protector 250ml",
    shortDescription: "Enjuague bucal con flúor, protección anticaries.",
    category: "Enjuagues con flúor",
    uom: "PZA",
    purchaseCost: 18,
    logisticsCost: 1.5,
    importExpenses: 0,
    targetMarginPct: 32,
    minMarginPct: 22,
  },
  {
    sku: "GFB-ENJ-004",
    name: "Enjuague Bucal Profesional 1L",
    shortDescription: "Enjuague bucal con flúor, presentación profesional 1L.",
    category: "Enjuagues con flúor",
    uom: "PZA",
    purchaseCost: 55,
    logisticsCost: 4,
    importExpenses: 0,
    targetMarginPct: 30,
    minMarginPct: 25,
    staleListPrice: 70, // margen resultante ~15.7%, por debajo del 25% minimo (a proposito).
  },
  {
    sku: "GFB-SPR-001",
    name: "Spray Bucal Menta Extrafuerte 15ml",
    shortDescription: "Spray bucal de bolsillo, menta extrafuerte.",
    category: "Aerosoles bucales",
    uom: "PZA",
    purchaseCost: 9,
    logisticsCost: 0.8,
    importExpenses: 0.5,
    targetMarginPct: 45,
    minMarginPct: 30,
  },
  {
    sku: "GFB-SPR-002",
    name: "Spray Bucal Citrus Fresh 15ml",
    shortDescription: "Spray bucal de bolsillo, sabor cítrico.",
    category: "Aerosoles bucales",
    uom: "PZA",
    purchaseCost: 9.5,
    logisticsCost: 0.8,
    importExpenses: 0.5,
    targetMarginPct: 45,
    minMarginPct: 30,
  },
  {
    sku: "GFB-SPR-003",
    name: "Spray Bucal Portátil Mint Ice 20ml",
    shortDescription: "Spray bucal portátil, mint ice.",
    category: "Aerosoles bucales",
    uom: "PZA",
    purchaseCost: 11,
    logisticsCost: 1,
    importExpenses: 0.5,
    targetMarginPct: 42,
    minMarginPct: 30,
  },
  {
    sku: "GFB-PAS-001",
    name: "Pastillas Mentoladas sin Azúcar 40pz",
    shortDescription: "Pastillas mentoladas sin azúcar, presentación 40 piezas.",
    category: "Pastillas y chicles",
    uom: "PZA",
    purchaseCost: 7,
    logisticsCost: 0.5,
    importExpenses: 0,
    targetMarginPct: 40,
    minMarginPct: 28,
  },
  {
    sku: "GFB-PAS-002",
    name: "Chicles Sabor Menta sin Azúcar 30pz",
    shortDescription: "Chicles sin azúcar, sabor menta, presentación 30 piezas.",
    category: "Pastillas y chicles",
    uom: "PZA",
    purchaseCost: 6.5,
    logisticsCost: 0.5,
    importExpenses: 0,
    targetMarginPct: 40,
    minMarginPct: 28,
  },
  {
    sku: "GFB-PAS-003",
    name: "Pastillas Sabor Canela 40pz",
    shortDescription: "Pastillas mentoladas sabor canela, presentación 40 piezas.",
    category: "Pastillas y chicles",
    uom: "PZA",
    purchaseCost: 7.2,
    logisticsCost: 0.5,
    importExpenses: 0,
    targetMarginPct: 38,
    minMarginPct: 28,
  },
  {
    sku: "GFB-HIL-001",
    name: "Hilo Dental Encerado 50m",
    shortDescription: "Hilo dental encerado, rollo de 50 metros.",
    category: "Higiene complementaria",
    uom: "PZA",
    purchaseCost: 5,
    logisticsCost: 0.3,
    importExpenses: 0,
    targetMarginPct: 45,
    minMarginPct: 30,
  },
  {
    sku: "GFB-HIL-002",
    name: "Cepillo Dental Suave",
    shortDescription: "Cepillo dental de cerdas suaves.",
    category: "Higiene complementaria",
    uom: "PZA",
    purchaseCost: 4,
    logisticsCost: 0.3,
    importExpenses: 0,
    targetMarginPct: 45,
    minMarginPct: 30,
  },
];

const GFB_PRICE_LIST = { code: "GFB-LISTA-GENERAL", name: "Lista General GFB" };

async function seedGfbCatalog() {
  const gfb = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });

  const categoryIdByName = new Map<string, string>();

  for (const name of GFB_ROOT_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { businessUnitId_name: { businessUnitId: gfb.id, name } },
      update: {},
      create: { businessUnitId: gfb.id, name },
    });
    categoryIdByName.set(name, category.id);
  }

  for (const { name, parent } of GFB_SUBCATEGORIES) {
    const category = await prisma.category.upsert({
      where: { businessUnitId_name: { businessUnitId: gfb.id, name } },
      update: { parentId: categoryIdByName.get(parent) },
      create: { businessUnitId: gfb.id, name, parentId: categoryIdByName.get(parent) },
    });
    categoryIdByName.set(name, category.id);
  }

  const priceList = await prisma.priceList.upsert({
    where: { code: GFB_PRICE_LIST.code },
    update: { name: GFB_PRICE_LIST.name },
    create: { ...GFB_PRICE_LIST, businessUnitId: gfb.id, currency: "MXN" },
  });

  for (const item of GFB_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { internalSku: item.sku },
      update: {
        name: item.name,
        shortDescription: item.shortDescription,
        categoryId: categoryIdByName.get(item.category),
      },
      create: {
        internalSku: item.sku,
        name: item.name,
        shortDescription: item.shortDescription,
        businessUnitId: gfb.id,
        categoryId: categoryIdByName.get(item.category),
        uom: item.uom,
      },
    });

    const landedCost = computeLandedCost(item);

    const existingCost = await prisma.productCost.findFirst({
      where: { productId: product.id, effectiveTo: null },
    });
    if (!existingCost) {
      await prisma.productCost.create({
        data: {
          productId: product.id,
          purchaseCost: item.purchaseCost,
          logisticsCost: item.logisticsCost,
          importExpenses: item.importExpenses,
          landedCost: landedCost.toNumber(),
          targetMarginPct: item.targetMarginPct,
          minMarginPct: item.minMarginPct,
        },
      });
    }

    const listPrice =
      item.staleListPrice ??
      computeSalePriceFromMargin({ landedCost, marginPct: item.targetMarginPct })
        .toDecimalPlaces(2)
        .toNumber();

    await prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId: priceList.id, productId: product.id } },
      update: { listPrice },
      create: { priceListId: priceList.id, productId: product.id, listPrice },
    });
  }

  console.log(`Catálogo GFB: ${GFB_PRODUCTS.length} productos con costo y precio de lista.`);
}

async function main() {
  console.log("Seeding GLOBAL QUOTE — Módulo 1 (business units, roles, usuarios demo)");

  for (const bu of BUSINESS_UNITS) {
    await prisma.businessUnit.upsert({
      where: { code: bu.code },
      update: { name: bu.name },
      create: { code: bu.code, name: bu.name },
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const demoUser of DEMO_USERS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: demoUser.role } });

    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { fullName: demoUser.fullName, roleId: role.id },
      create: {
        email: demoUser.email,
        fullName: demoUser.fullName,
        passwordHash,
        roleId: role.id,
      },
    });

    for (const buCode of demoUser.businessUnits) {
      const businessUnit = await prisma.businessUnit.findUniqueOrThrow({
        where: { code: buCode },
      });
      await prisma.userBusinessUnit.upsert({
        where: { userId_businessUnitId: { userId: user.id, businessUnitId: businessUnit.id } },
        update: {},
        create: { userId: user.id, businessUnitId: businessUnit.id },
      });
    }
  }

  console.log(`Listo. ${DEMO_USERS.length} usuarios demo con contraseña compartida: ${DEMO_PASSWORD}`);

  await seedGfbCatalog();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
