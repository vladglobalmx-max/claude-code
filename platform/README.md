# GAIOS Platform

Aplicación web empresarial para Global Supplier MTY — agentes de IA, herramientas comerciales, CRM y base de conocimiento sobre Next.js + Supabase + Claude API.

**Estado actual:** MVP Fase 1 construido (código fuente completo, sin conectar a servicios reales todavía). Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para la arquitectura completa.

## Alcance de este scaffold

Construido según la "primera orden de ejecución": acceso, layout, sidebar, dashboard, usuarios, roles, unidades de negocio, clientes, oportunidades, agentes, herramientas y administración de prompts — con las 5 herramientas funcionales de la Fase 1 (investigación de prospectos, preparación de visita, seguimiento comercial, generación de propuesta, análisis de oportunidad) conectadas a Claude de extremo a extremo.

**Deliberadamente fuera de este scaffold** (Instrucción Maestra §22): facturación, contabilidad, inventario, nómina, ERP, app móvil nativa, marketplace, agentes autónomos, automatizaciones externas complejas.

## Requisitos

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para levantar Postgres + Auth + Storage localmente)
- Una API key de Anthropic (Claude) — solo necesaria para probar las herramientas/agentes reales

## Instalación

```bash
cd platform
npm install
cp .env.example .env.local
```

## Base de datos (local)

```bash
supabase start          # levanta Postgres, Auth, Storage y Studio localmente
supabase db reset       # aplica supabase/migrations/*.sql y luego supabase/seed/seed_demo_data.sql
```

`supabase start` imprime la URL y las keys locales (`anon key`, `service_role key`) — cópialas a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key impresa por supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key impresa por supabase start>
ANTHROPIC_API_KEY=<tu API key de Claude>
```

Después de tener el proyecto Supabase conectado, regenera los tipos reales (reemplaza el archivo escrito a mano):

```bash
npm run supabase:types
```

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`.

### Credenciales de demo (`seed_demo_data.sql`)

Contraseña compartida: **`GaiosDemo2026!`**

| Correo | Rol |
|---|---|
| ana.torres@globalsuppliermty.com | Superadministrador |
| carlos.medina@globalsuppliermty.com | Director General |
| laura.gonzalez@globalsuppliermty.com | Director Comercial |
| diego.ramirez@globalsuppliermty.com | Vendedor |
| sofia.hernandez@globalsuppliermty.com | Marketing |

El seed también carga: 5 unidades de negocio, 10 clientes, 5 contactos, 15 oportunidades, 20 seguimientos, 5 agentes, 5 herramientas **funcionales** (con prompts reales conectados a Claude) y 15 herramientas adicionales del catálogo completo en estado `inactive`/`draft` — pendientes de que el Administrador de IA les redacte un prompt real desde `/admin/prompts`, en vez de simular una funcionalidad que no existe.

**Eliminar todos los datos demo antes de producción:**

```sql
delete from companies where slug = 'global-supplier-mty';
-- el resto de las tablas tiene ON DELETE CASCADE hacia companies
```

## Estructura

Ver el árbol completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#2-estructura-de-carpetas). Resumen:

```
platform/
  src/app/(auth)/        login, forgot-password, reset-password
  src/app/(app)/          dashboard, clients, opportunities, followups,
                          business-units, agents, tools, knowledge-base,
                          history, admin/*, settings
  src/app/api/ai/         Route Handlers que llaman a Claude (server-only)
  src/components/         ui/ (design system), layout/, y por feature
  src/lib/                supabase/, ai/, auth/, validations/, utils/
  supabase/migrations/    DDL de las 7 migraciones de la Fase 1
  supabase/seed/          datos de demostración
```

## Seguridad de IA (por diseño, no por convención)

- `src/lib/ai/claude.ts` y `src/lib/supabase/admin.ts` importan el paquete `server-only`: **el build falla** si terminan empaquetados en el bundle del cliente.
- Los componentes de UI (agentes, herramientas) nunca llaman a Claude directamente — siempre pasan por `app/api/ai/**`, que carga el prompt desde la base de datos, lo ejecuta, valida la respuesta contra un schema de Zod, y solo devuelve el resultado estructurado al navegador.
- Ningún prompt del sistema se renderiza en el cliente.

## Próximos pasos sugeridos

1. Conectar un proyecto Supabase real (no local) para staging.
2. Escribir pruebas (Vitest + Testing Library) sobre `run-tool.ts` y `run-agent.ts`.
3. Completar los 15 prompts restantes del catálogo de herramientas (§9) desde `/admin/prompts`.
4. Activar búsqueda semántica sobre `document_chunks` (pgvector) cuando la base de conocimiento tenga contenido real.
