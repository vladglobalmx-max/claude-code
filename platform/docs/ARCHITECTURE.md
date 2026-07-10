# GAIOS Platform — Arquitectura Propuesta (Fase 1 / MVP)

> Entregable previo a código, según la Instrucción Maestra secciones 27-28. Cubre: arquitectura, esquema de base de datos, estructura de carpetas, rutas, componentes, dependencias y riesgos para el primer corte: acceso, layout, sidebar, dashboard, usuarios, roles, unidades de negocio, clientes, oportunidades, agentes, herramientas, administración de prompts.

**Versión:** 0.1 (propuesta) · **Estado:** Pendiente de validación · **Empresa inicial:** Global Supplier MTY

---

## 1. Resumen de arquitectura

| Capa | Elección | Justificación |
|---|---|---|
| Frontend | Next.js 14+ (App Router), React, TypeScript | SSR/RSC para dashboards con datos sensibles, rutas anidadas por rol, un solo repo despliega en Vercel |
| Estilos | Tailwind CSS + design system propio (tokens) | Consistencia rápida sin parecer plantilla genérica |
| Backend | Next.js Route Handlers + Server Actions | Evita exponer un backend separado en la Fase 1; toda lógica sensible (prompts, claves) corre en servidor |
| Base de datos | PostgreSQL vía Supabase | RLS nativo por `company_id`, Auth integrado, Storage integrado, pgvector disponible para Fase 2 (embeddings) |
| Auth | Supabase Auth (email/password) | Sesiones seguras, recuperación de contraseña out-of-the-box, roles vía tabla propia + claims |
| IA | Claude API (Anthropic), llamado **solo desde servidor** | Los prompts maestros y la API key nunca llegan al navegador (requisito explícito) |
| Archivos | Supabase Storage | Buckets por empresa/unidad de negocio, permisos vía RLS en `documents` |
| Hosting | Vercel (app) + Supabase (datos/auth/storage) | Coincide con lo solicitado; despliegue de un solo comando |

**Principio transversal:** toda tabla de negocio lleva `company_id`. Aunque hoy exista una sola empresa (Global Supplier MTY), el sistema queda listo para multiempresa sin migración estructural — solo se activa RLS multi-tenant que ya está diseñada desde el día uno.

**Principio de seguridad de IA:** ningún componente cliente (`"use client"`) llama directamente a Claude. Todas las llamadas pasan por Route Handlers (`/api/ai/...`) que cargan el prompt desde la base de datos (tabla `prompts`), inyectan las variables del formulario, llaman a Claude con la API key desde variables de entorno del servidor, validan la respuesta contra un JSON Schema (Zod) y devuelven al cliente **solo el resultado estructurado** — nunca el prompt del sistema.

---

## 2. Estructura de carpetas

```
platform/
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── middleware.ts                    # protección de rutas + resolución de sesión/rol
├── README.md
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_core_company_users.sql      # companies, business_units, roles, users, user_business_units
│   │   ├── 0002_crm.sql                     # clients, contacts, opportunities, opportunity_stage_history, followups
│   │   ├── 0003_ai_agents_tools_prompts.sql # agents, tools, prompts, prompt_versions
│   │   ├── 0004_conversations_executions.sql# conversations, conversation_messages, tool_executions
│   │   ├── 0005_knowledge_documents.sql     # documents, document_chunks (pgvector, preparado)
│   │   ├── 0006_audit.sql                   # audit_log
│   │   └── 0007_rls_policies.sql            # políticas RLS de todas las tablas anteriores
│   └── seed/
│       └── seed_demo_data.sql               # datos ficticios (sección 23), aislados y borrables
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # layout raíz (fuentes, providers, tema claro/oscuro)
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                   # layout sin sidebar
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx                   # shell autenticado: Sidebar + Header + guard de sesión
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx                 # listado + filtros
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [clientId]/page.tsx      # ficha 360°
│   │   │   ├── opportunities/
│   │   │   │   ├── page.tsx                 # tabla
│   │   │   │   ├── kanban/page.tsx           # vista Kanban por etapa
│   │   │   │   └── [opportunityId]/page.tsx
│   │   │   ├── followups/page.tsx           # hoy / vencidos / próximos / completados
│   │   │   ├── business-units/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx          # página de unidad con sus herramientas
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx                 # selector de agentes (tarjetas)
│   │   │   │   └── [agentId]/page.tsx       # interfaz de conversación
│   │   │   ├── tools/
│   │   │   │   ├── page.tsx                 # biblioteca de herramientas
│   │   │   │   └── [toolSlug]/page.tsx      # formulario + resultado estructurado
│   │   │   ├── knowledge-base/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx               # guard: solo Superadmin / Administrador de IA
│   │   │   │   ├── users/page.tsx
│   │   │   │   ├── roles/page.tsx
│   │   │   │   ├── agents/page.tsx          # CRUD de agentes
│   │   │   │   ├── tools/page.tsx           # CRUD de herramientas
│   │   │   │   ├── prompts/
│   │   │   │   │   ├── page.tsx             # listado + estado
│   │   │   │   │   └── [promptId]/page.tsx  # editor + historial de versiones + prueba
│   │   │   │   └── audit/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       └── ai/
│   │           ├── agents/[agentId]/chat/route.ts
│   │           └── tools/[toolSlug]/run/route.ts
│   │
│   ├── components/
│   │   ├── ui/               # design system: Button, Card, Badge, Modal, Drawer, Table, Kanban,
│   │   │                     # Skeleton, Toast, EmptyState, CommandPalette, FormField
│   │   ├── layout/            # Sidebar, Header, RoleGate
│   │   ├── dashboard/         # SummaryCards, QuickActions, RecentActivity
│   │   ├── clients/           # ClientCard, ClientForm, ClientTimeline
│   │   ├── opportunities/     # OpportunityTable, OpportunityKanbanCard, StageBadge
│   │   ├── followups/         # FollowupList, FollowupForm
│   │   ├── agents/            # AgentCard, ChatWindow, MessageBubble
│   │   ├── tools/             # ToolCard, DynamicToolForm, StructuredResultView
│   │   └── admin/             # PromptEditor, PromptVersionDiff, UserTable
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # cliente de navegador (anon key)
│   │   │   ├── server.ts      # cliente de Server Components/Actions (cookies)
│   │   │   └── admin.ts       # cliente con service role — SOLO importable desde /api y Server Actions
│   │   ├── ai/
│   │   │   ├── claude.ts      # wrapper del SDK de Anthropic, server-only
│   │   │   ├── schemas/       # Zod schemas de salida por herramienta
│   │   │   └── run-tool.ts    # orquesta: carga prompt → arma variables → llama Claude → valida → guarda tool_executions
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   └── permissions.ts # mapa rol → permisos, usado por RoleGate y middleware
│   │   ├── validations/       # Zod schemas de formularios (clientes, oportunidades, etc.)
│   │   └── utils/
│   │
│   ├── hooks/
│   └── types/
│       ├── database.types.ts  # generado con `supabase gen types typescript`
│       └── domain.ts          # tipos de dominio derivados
│
└── public/
    └── icons/
```

**Regla de aislamiento:** `lib/supabase/admin.ts` (service role) y `lib/ai/claude.ts` solo pueden importarse desde archivos dentro de `app/api/**` o Server Actions — nunca desde un componente `"use client"`. Se refuerza con ESLint (`no-restricted-imports`) además de la revisión de código.

---

## 3. Esquema de base de datos (Fase 1)

Todas las tablas de negocio incluyen `company_id uuid not null references companies(id)`. Todas tienen RLS activado (`0007_rls_policies.sql`).

### 3.1 Núcleo: empresa, unidades, usuarios, roles

```sql
companies (
  id uuid pk default gen_random_uuid(),
  name text not null,                  -- "Global Supplier MTY"
  slug text unique not null,
  created_at timestamptz default now()
)

business_units (
  id uuid pk,
  company_id uuid fk -> companies,
  name text not null,                  -- "Thunder Safety Solutions", etc.
  slug text not null,
  description text,
  icon text,
  created_at timestamptz default now(),
  unique (company_id, slug)
)

roles (
  id uuid pk,
  company_id uuid fk -> companies null, -- null = rol de sistema (compartido)
  key text not null,                    -- 'superadmin' | 'director_general' | 'director_comercial' |
                                         -- 'vendedor' | 'marketing' | 'operaciones' | 'admin_ia'
  name text not null,
  description text,
  is_system boolean default false
)

users (
  id uuid pk,                           -- = auth.users.id (Supabase Auth)
  company_id uuid fk -> companies,
  role_id uuid fk -> roles,
  full_name text not null,
  email text not null,
  avatar_url text,
  status text default 'active',         -- active | invited | disabled
  created_at timestamptz default now()
)

user_business_units (                   -- M:N — a qué unidades tiene acceso cada usuario
  user_id uuid fk -> users,
  business_unit_id uuid fk -> business_units,
  primary key (user_id, business_unit_id)
)
```

### 3.2 CRM: clientes, contactos, oportunidades, seguimientos

```sql
clients (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk -> business_units,
  legal_name text, trade_name text, industry text, size text, employees_count int,
  website text, phone text, address text, city text, state text, country text,
  status text default 'active', source text, owner_id uuid fk -> users,
  notes text, created_at timestamptz default now(), updated_at timestamptz default now()
)

contacts (
  id uuid pk, company_id uuid fk, client_id uuid fk -> clients,
  name text not null, position text, email text, phone text, whatsapp text,
  area text, decision_level text
)

opportunities (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk, client_id uuid fk, contact_id uuid fk null,
  name text not null, owner_id uuid fk -> users,
  estimated_value numeric(14,2), estimated_margin numeric(5,2),
  stage text not null default 'prospecto',   -- enum: ver 3.4
  probability int default 10,
  expected_close_date date,
  last_activity_at timestamptz, next_activity_at timestamptz,
  competitors text[], objections text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
)

opportunity_stage_history (
  id uuid pk, opportunity_id uuid fk, from_stage text, to_stage text,
  changed_by uuid fk -> users, changed_at timestamptz default now()
)

followups (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk,
  client_id uuid fk null, contact_id uuid fk null, opportunity_id uuid fk null,
  user_id uuid fk -> users,
  type text not null,                  -- llamada | correo | whatsapp | visita | reunion | cotizacion | recordatorio | revision_tecnica
  scheduled_at timestamptz not null, priority text default 'media',
  status text default 'pendiente',     -- pendiente | completado | vencido | cancelado
  description text, result text, next_action text,
  created_at timestamptz default now()
)
```

### 3.3 IA: agentes, herramientas, prompts (con versionado)

```sql
prompts (
  id uuid pk, company_id uuid fk,
  name text not null, code text not null,     -- code único legible, ej. "TOOL_PREP_VISITA_V1"
  objective text, business_unit_id uuid fk null,
  system_prompt text not null,                -- NUNCA se expone al cliente
  user_prompt_template text not null,         -- con placeholders {{variable}}
  variables jsonb default '[]',               -- [{name, type, required}]
  output_schema jsonb not null,                -- JSON Schema de salida esperada
  model text default 'claude-sonnet-5', temperature numeric(3,2) default 0.4,
  version int not null default 1,
  status text default 'active',                -- active | inactive | draft
  created_by uuid fk -> users,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (company_id, code, version)
)

prompt_versions (                              -- snapshot inmutable en cada cambio
  id uuid pk, prompt_id uuid fk -> prompts, version int not null,
  system_prompt text, user_prompt_template text, variables jsonb,
  output_schema jsonb, model text, temperature numeric(3,2),
  change_note text, changed_by uuid fk -> users, created_at timestamptz default now()
)

agents (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk null,
  name text not null, slug text not null, description text, icon text, objective text,
  system_prompt_id uuid fk -> prompts,
  model text default 'claude-sonnet-5', temperature numeric(3,2) default 0.5,
  tool_ids uuid[] default '{}',
  allowed_roles text[] default '{}',           -- roles con acceso
  status text default 'active', version int default 1,
  updated_at timestamptz default now(),
  unique (company_id, slug)
)

tools (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk null,
  name text not null, slug text not null, description text, category text,
  agent_id uuid fk -> agents null,
  input_schema jsonb not null,                 -- define el formulario dinámico
  output_schema jsonb not null,
  prompt_id uuid fk -> prompts,
  allowed_roles text[] default '{}',
  status text default 'active', version int default 1,
  unique (company_id, slug)
)
```

**Regla de integridad:** un trigger (`prevent_prompt_overwrite`) impide `UPDATE` directo sobre `system_prompt`/`user_prompt_template`/`output_schema` de `prompts` sin antes insertar la fila correspondiente en `prompt_versions`. Así se garantiza el requisito "nunca sobrescribir un prompt sin conservar su versión anterior".

### 3.4 Conversaciones, ejecuciones de herramientas (historial)

```sql
conversations (
  id uuid pk, company_id uuid fk, agent_id uuid fk -> agents, user_id uuid fk -> users,
  client_id uuid fk null, opportunity_id uuid fk null,
  title text, created_at timestamptz default now(), updated_at timestamptz default now()
)

conversation_messages (
  id uuid pk, conversation_id uuid fk, role text not null,  -- user | assistant
  content text not null, attachments jsonb default '[]',
  created_at timestamptz default now()
)

tool_executions (                              -- el "historial" de la sección 17
  id uuid pk, company_id uuid fk, business_unit_id uuid fk,
  tool_id uuid fk -> tools, prompt_id uuid fk -> prompts, prompt_version int,
  user_id uuid fk -> users, client_id uuid fk null, opportunity_id uuid fk null,
  input jsonb not null, output jsonb, status text default 'success',  -- success | error
  error_message text,
  tokens_input int, tokens_output int, cost_estimate numeric(10,4), duration_ms int,
  created_at timestamptz default now()
)
```

### 3.5 Base de conocimiento y auditoría

```sql
documents (
  id uuid pk, company_id uuid fk, business_unit_id uuid fk null,
  name text not null, category text, description text,
  file_path text not null,                     -- ruta en Supabase Storage
  file_type text, tags text[], version int default 1,
  status text default 'active', allowed_roles text[] default '{}',
  uploaded_by uuid fk -> users, created_at timestamptz default now()
)

document_chunks (                              -- preparado para Fase 2 (búsqueda semántica)
  id uuid pk, document_id uuid fk -> documents,
  content text not null, embedding vector(1536), chunk_index int
)                                               -- requiere extensión pgvector; tabla creada pero sin uso activo en MVP

audit_log (
  id uuid pk, company_id uuid fk, user_id uuid fk -> users,
  action text not null,                        -- login | create_user | edit_prompt | change_stage | run_tool | ...
  entity_type text, entity_id uuid, metadata jsonb,
  ip_address text, created_at timestamptz default now()
)
```

**Etapas de oportunidad (`opportunities.stage`, validadas por `CHECK`):** `prospecto`, `contactado`, `calificado`, `diagnostico`, `propuesta`, `negociacion`, `prueba_piloto`, `cierre_ganado`, `cierre_perdido`, `seguimiento_futuro`.

### 3.6 RLS — patrón aplicado a toda tabla con `company_id`

```sql
alter table clients enable row level security;

create policy "select_within_company" on clients
  for select using (company_id = (select company_id from users where id = auth.uid()));

create policy "write_within_company" on clients
  for insert with check (company_id = (select company_id from users where id = auth.uid()));
-- mismo patrón para update/delete, y replicado en las ~15 tablas de negocio
```

El **service role** (usado solo en `lib/supabase/admin.ts`, server-side) omite RLS deliberadamente para operaciones administrativas (crear empresa, crear usuario) — nunca se usa en código accesible al cliente.

---

## 4. Rutas (Fase 1)

| Ruta | Tipo | Acceso | Propósito |
|---|---|---|---|
| `/login` | página | público | Autenticación |
| `/forgot-password`, `/reset-password` | página | público | Recuperación de contraseña |
| `/dashboard` | página | todos los roles | Resumen ejecutivo + accesos rápidos |
| `/clients`, `/clients/new`, `/clients/[id]` | página | Director Comercial, Vendedor, Director General, Superadmin | CRM de clientes |
| `/opportunities`, `/opportunities/kanban`, `/opportunities/[id]` | página | Director Comercial, Vendedor, Director General, Superadmin | Pipeline |
| `/followups` | página | Vendedor, Director Comercial, Operaciones | Seguimientos |
| `/business-units`, `/business-units/[slug]` | página | todos (filtrado por `user_business_units`) | Portal de cada unidad |
| `/agents`, `/agents/[agentId]` | página | según `agents.allowed_roles` | Selector + chat |
| `/tools`, `/tools/[toolSlug]` | página | según `tools.allowed_roles` | Biblioteca + ejecución |
| `/knowledge-base` | página | todos (filtrado por `documents.allowed_roles`) | Documentos |
| `/history` | página | todos (solo su propio historial, salvo Superadmin/Director General) | `tool_executions` + `conversations` |
| `/admin/users`, `/admin/roles` | página | Superadmin | Gestión de usuarios y roles |
| `/admin/agents`, `/admin/tools` | página | Superadmin, Administrador de IA | CRUD de agentes/herramientas |
| `/admin/prompts`, `/admin/prompts/[promptId]` | página | Superadmin, Administrador de IA | Editor + versiones + prueba |
| `/admin/audit` | página | Superadmin | Auditoría |
| `/settings` | página | todos | Perfil propio |
| `POST /api/ai/agents/[agentId]/chat` | route handler | sesión válida + rol permitido | Orquesta conversación con Claude |
| `POST /api/ai/tools/[toolSlug]/run` | route handler | sesión válida + rol permitido | Orquesta ejecución de herramienta con Claude |

`middleware.ts` protege todo `/(app)/**` verificando sesión de Supabase; cada layout de sección (`admin/layout.tsx`) aplica el guard de rol adicional vía `lib/auth/permissions.ts`.

---

## 5. Componentes clave (design system + features)

| Componente | Carpeta | Reutilizado en |
|---|---|---|
| `Sidebar` (adaptable por rol) | `components/layout` | shell `(app)/layout.tsx` |
| `RoleGate` | `components/layout` | cualquier sección restringida |
| `DynamicToolForm` (genera el formulario desde `tools.input_schema`) | `components/tools` | `/tools/[toolSlug]` |
| `StructuredResultView` (renderiza `output_schema` como tarjetas/tablas/badges) | `components/tools` | resultado de herramientas y agentes |
| `ChatWindow` / `MessageBubble` | `components/agents` | `/agents/[agentId]` |
| `OpportunityKanbanCard` + `Kanban` genérico | `components/opportunities`, `components/ui` | `/opportunities/kanban` |
| `PromptEditor` + `PromptVersionDiff` | `components/admin` | `/admin/prompts/[promptId]` |
| `SummaryCards`, `QuickActions` | `components/dashboard` | `/dashboard` |
| `EmptyState`, `SkeletonRow`, `Toast` | `components/ui` | toda la app |

---

## 6. Dependencias propuestas (`package.json`, resumen)

```
next, react, react-dom, typescript
@supabase/supabase-js, @supabase/ssr
@anthropic-ai/sdk                      -- Claude API, uso server-only
zod                                    -- validación de formularios y de output_schema
react-hook-form, @hookform/resolvers
tailwindcss, class-variance-authority, clsx, tailwind-merge
lucide-react                           -- iconografía
recharts                               -- gráficas del dashboard
date-fns
sonner                                 -- toasts
cmdk                                   -- buscador global / command palette
eslint, eslint-config-next, prettier
vitest, @testing-library/react         -- pruebas (a partir de Fase 1.1)
```

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Exposición de la API key de Claude o de los prompts maestros | Aislamiento estricto server-only (`lib/ai/`), lint rule que bloquea su import desde `"use client"` |
| Fuga de datos entre empresas por RLS mal configurada | Política RLS idéntica y probada en las ~15 tablas de negocio; pruebas automatizadas de aislamiento antes de habilitar multiempresa real |
| Respuesta de Claude con JSON inválido o incompleto | Validación Zod contra `output_schema`; un reintento automático con instrucción de corrección; si falla de nuevo, se registra el error y se muestra mensaje controlado (nunca detalle técnico) |
| Sobrescritura accidental de un prompt en producción | Trigger de base de datos que obliga a crear `prompt_versions` antes de cualquier `UPDATE` |
| Costo no controlado de uso de IA | `tool_executions` registra tokens y costo estimado por ejecución desde el día uno; base para límites por rol/unidad en Fase 2 |
| Alcance del MVP se expande durante la construcción | Exclusiones explícitas de la sección 22 se mantienen fuera del Sprint 1 (facturación, ERP, app nativa, agentes autónomos, etc.) |
| Confusión entre "Agentes" (conversacionales) y "Herramientas" (formulario→resultado) | Ambos comparten `prompts` como fuente de verdad, pero son entidades y rutas separadas desde el modelo de datos, evitando que la IA se perciba como "un chatbot con interfaz" |
| Carga de archivos maliciosa o excesiva en `documents` | Validación de tipo MIME y tamaño en el Route Handler antes de subir a Storage; los buckets no son públicos, se sirven vía URL firmada |

---

## 8. Próximo paso

Este documento es la entrega solicitada en la sección 28 ("Entrega primero la arquitectura, el esquema de base de datos y la estructura de carpetas"). Antes de generar el scaffold de código (`platform/package.json`, componentes, migraciones ejecutables) se pide confirmación sobre:

1. ¿La estructura de carpetas y el árbol de rutas propuesto se aprueba tal cual, o hay ajustes?
2. ¿El esquema de datos de la sección 3 cubre lo esperado para Fase 1, o falta algún campo/entidad?
3. Confirmar el nombre del proyecto/carpeta (`platform/`) dentro de este mismo repositorio, o si debe vivir en un repositorio aparte.

Con esa confirmación, el siguiente entregable es el scaffold ejecutable: proyecto Next.js inicializado, migraciones SQL aplicables, design system base, y las 5 herramientas funcionales de la sección 22 conectadas a Claude.
