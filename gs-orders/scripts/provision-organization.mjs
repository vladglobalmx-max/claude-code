// THÖREN — Fase 7B: provisioning interno de una organización nueva
// (Organization B, o cualquier tenant nuevo) — organización + primer admin
// + Business Unit inicial, en una sola alta atómica. Se ejecuta LOCALMENTE
// con TUS credenciales (nunca las pegues en un chat) — mismo criterio que
// upload-cotizia-pdfs.mjs. Herramienta interna de plataforma, NO
// autoservicio: no expone ningún endpoint HTTP, requiere la service_role
// key (nunca la anon key).
//
// Uso:
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   SITE_URL=https://thoren.mx \
//   node scripts/provision-organization.mjs \
//     --org-name "Acme Corp" \
//     --org-slug "acme-corp" \
//     --admin-email admin@acme.com \
//     --admin-name "Jane Doe" \
//     --bu-name "Acme Principal" \
//     --bu-code "acme_principal" \
//     --trade-name "Acme" \
//     --tax-id "ACM010101AAA" \
//     --currency USD \
//     --timezone "America/Mexico_City"
//
// --trade-name/--tax-id/--currency/--timezone son OPCIONALES (THÖREN 0084):
// trade_name/tax_id quedan NULL si se omiten; currency cae a MXN; timezone
// cae al default de la columna (America/Monterrey) si se omite o viene
// vacío. currency debe ser exactamente MXN o USD (mismo dominio que
// sales_orders/quotes) — rpc_provision_organization lo valida en DB.
//
// SITE_URL es OBLIGATORIA (antes era opcional — ese fue exactamente el bug
// que dejaba la invitación cayendo al login en vez de /set-password): se usa
// como redirectTo del correo de invitación (mismo mecanismo que
// createUserAccess en configuracion/usuarios/actions.ts, cuyo getSiteUrl()
// SIEMPRE arma redirectTo sin condicionarlo a ninguna env var — esta env var
// es el equivalente de ese helper para un script de línea de comandos, que
// no tiene acceso a los headers de una petición HTTP). Sin ella, GoTrue cae
// a su Site URL default configurado en el proyecto de Supabase, que apunta
// al login — nunca a /set-password.
//
// QUÉ HACE:
//   1) Crea/invita el usuario de Auth del primer admin (GoTrue envía el
//      correo de invitación real — mismo flujo que createUserAccess).
//   2) Llama a rpc_provision_organization() (0052/0084, restringida a
//      service_role) que crea, en UNA sola transacción de Postgres: la
//      organización (incluidos trade_name/tax_id/currency/timezone),
//      user_profiles (admin), organization_members (admin), la Business
//      Unit inicial, y la Person del admin — todo o nada.
//   3) Si el paso 2 falla, revierte el usuario de Auth creado en el paso 1
//      (mismo patrón de compensación que insertProfileAndMembershipOrCompensate)
//      — nunca deja un tenant a medias.
//
// QUÉ NO HACE (fuera de alcance, a propósito):
//   No crea almacenes ni configuración de folios de cotización (no son
//   obligatorios para operar). No resuelve la restricción de dominio de
//   correo (7C). No expone ningún endpoint HTTP. No construye un panel de
//   administración — es una herramienta de línea de comandos. No configura
//   módulos habilitados por organización (0084) — la organización nueva
//   nace con TODOS los módulos toggleables habilitados (default-on); el
//   propio admin nuevo los ajusta después desde Configuración → Organización.

import { createClient } from "@supabase/supabase-js";

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    args[key] = value;
    i += 1;
  }
  return args;
}

const REQUIRED_ARGS = ["org-name", "org-slug", "admin-email", "admin-name", "bu-name", "bu-code"];

export function validateArgs(args) {
  const missing = REQUIRED_ARGS.filter((key) => !args[key]);
  if (missing.length > 0) {
    return `Faltan argumentos: ${missing.map((key) => `--${key}`).join(", ")}`;
  }
  return null;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SITE_URL = process.env.SITE_URL;

  if (!SUPABASE_URL || !SERVICE_KEY || !SITE_URL) {
    console.error("Faltan variables de entorno. Requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL.");
    console.error(
      "SITE_URL es obligatoria (antes era opcional): sin ella, la invitación cae al Site URL default de Supabase Auth (login) en vez de /set-password."
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const validationError = validateArgs(args);
  if (validationError) {
    console.error(validationError);
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Creando usuario de Auth para ${args["admin-email"]}...`);
  const inviteOptions = { redirectTo: `${SITE_URL}/set-password` };
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    args["admin-email"],
    inviteOptions
  );
  if (inviteError || !invited?.user) {
    console.error("No se pudo crear/invitar el usuario de Auth:", inviteError?.message ?? "sin usuario devuelto");
    process.exit(1);
  }
  const authUserId = invited.user.id;
  console.log(`Usuario de Auth creado: ${authUserId}`);

  console.log("Provisionando organización...");
  const { data, error } = await admin.rpc("rpc_provision_organization", {
    p_organization_name: args["org-name"],
    p_organization_slug: args["org-slug"],
    p_trade_name: args["trade-name"] ?? null,
    p_tax_id: args["tax-id"] ?? null,
    p_currency: args["currency"] ?? "MXN",
    p_timezone: args["timezone"] ?? null,
    p_admin_user_id: authUserId,
    p_admin_name: args["admin-name"],
    p_admin_email: args["admin-email"],
    p_business_unit_name: args["bu-name"],
    p_business_unit_code: args["bu-code"],
  });

  if (error) {
    console.error("Provisioning falló:", error.message);
    console.error("Revirtiendo usuario de Auth para no dejar un tenant a medias...");
    const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      console.error("ADVERTENCIA: no se pudo revertir el usuario de Auth huérfano:", deleteError.message);
      console.error(`Elimínalo manualmente desde el dashboard de Auth: ${authUserId}`);
    } else {
      console.log("Usuario de Auth revertido correctamente. Ningún dato quedó a medias.");
    }
    process.exit(1);
  }

  const row = Array.isArray(data) ? data[0] : data;
  console.log("Organización provisionada correctamente:");
  console.log(`  organization_id:   ${row.organization_id}`);
  console.log(`  business_unit_id:  ${row.business_unit_id}`);
  console.log(`  admin user_id:     ${authUserId}`);
  console.log("El admin recibirá un correo de invitación para definir su contraseña.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
