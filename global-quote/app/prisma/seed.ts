import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { RoleCode } from "../src/generated/prisma/enums";

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
      businessUnits: ["TSS", "TLL"],
    },
    {
      email: "diego.ramirez@globalsuppliermty.com",
      fullName: "Diego Ramírez",
      role: "VENDEDOR",
      businessUnits: ["TSS"],
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
