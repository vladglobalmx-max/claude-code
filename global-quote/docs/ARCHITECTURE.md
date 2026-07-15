# GLOBAL QUOTE — Documento Maestro de Arquitectura (pre-código)

> Entregable previo a código, conforme a la instrucción final del brief maestro (§29): resumen ejecutivo, arquitectura funcional, arquitectura técnica, roles y permisos, modelo de datos, flujo de cotización, sistema de folios, reglas de margen y autorización, mapa de pantallas y plan de MVP. El código se construye después, módulo por módulo, según el plan de la sección 10.

**Versión:** 0.1 (propuesta) · **Estado:** pendiente de validación por Dirección General
**Empresa:** Global Supplier MTY S.A. de C.V. · San Nicolás de los Garza, Nuevo León, México
**Director General:** Vladimir Eugenio Peña Elizondo

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura funcional](#2-arquitectura-funcional)
3. [Arquitectura técnica](#3-arquitectura-técnica)
4. [Roles y permisos](#4-roles-y-permisos)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Flujo completo de cotización](#6-flujo-completo-de-cotización)
7. [Sistema de folios](#7-sistema-de-folios)
8. [Reglas de margen y autorización](#8-reglas-de-margen-y-autorización)
9. [Mapa de pantallas](#9-mapa-de-pantallas)
10. [Plan del MVP por módulos](#10-plan-del-mvp-por-módulos)

---

## 1. Resumen ejecutivo

GLOBAL QUOTE es el sistema de control comercial de cotizaciones de Global Supplier MTY. Reemplaza la práctica actual de cotizar en documentos sueltos (Word/Excel/PDF manual) por una plataforma centralizada donde:

- **Cada línea de negocio** (TSS, TLL, GFB, TFS, JUN, GTX, GSM) opera con su propio catálogo, folio, plantilla, márgenes mínimos y vendedores autorizados, pero comparte un único motor de reglas, auditoría y base de datos.
- **Los costos y márgenes están protegidos por rol**: un vendedor nunca ve costo ni utilidad monetaria; solo ve el precio de venta y, si se le autoriza, el porcentaje de margen.
- **Ninguna cotización sale de la empresa sin que su margen y su descuento hayan pasado por la regla de autorización correspondiente** — la política de descuentos no es una convención, es un bloqueo técnico.
- **Cada cotización tiene un folio único e irreversible** que sobrevive a cancelaciones, rechazos, vencimientos y nuevas versiones; toda edición posterior al envío crea una versión (`-V1`, `-V2`, ...) sin perder el historial.
- **Una cotización aceptada se convierte en pedido sin recapturar información**, heredando cliente, productos, precios, condiciones y evidencias.
- **Dirección General obtiene, sin pedirlo, un tablero de rentabilidad, pipeline y excepciones** por línea, vendedor y cliente.
- El sistema queda preparado para integrarse a futuro con **GAIOS** (agentes de IA comerciales, automatizaciones) y con un ERP/CRM externo, vía API — sin que esa integración futura obligue a rediseñar el modelo de datos hoy.

El resultado no es un generador de PDFs: es el sistema de registro (*system of record*) de precio, margen y autorización comercial de la empresa. El PDF es solo su salida visible.

### Qué NO incluye la Fase 1 (alcance explícitamente fuera)

Facturación electrónica (CFDI), contabilidad, nómina, inventario en tiempo real contra WMS, ERP completo, firma electrónica avanzada, integración con WhatsApp Business API real, agentes de IA autónomos. Estos quedan enunciados en la Fase 3 (§10.3) como puntos de integración, no como funcionalidad a construir ahora.

---

## 2. Arquitectura funcional

### 2.1 Principio rector

**Separación entre lo que un vendedor puede ver/hacer y lo que el sistema garantiza**, independientemente de la interfaz. La UI oculta campos de costo al vendedor; el backend además los excluye de la respuesta — nunca se confía solo en ocultar en el frontend.

### 2.2 Dominios funcionales

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GLOBAL QUOTE                                 │
│                                                                       │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────────┐  │
│  │ Catálogo       │   │ Comercial     │   │ Control y gobierno    │  │
│  │ - Productos    │   │ - Clientes    │   │ - Autorizaciones       │  │
│  │ - Categorías   │   │ - Contactos   │   │ - Auditoría            │  │
│  │ - Costos       │──▶│ - Cotizaciones│◀──│ - Roles/permisos       │  │
│  │ - Listas de    │   │ - Versiones   │   │ - Folios/series        │  │
│  │   precios      │   │ - Seguimiento │   │ - Plantillas PDF       │  │
│  │ - Proveedores  │   │ - Pedidos     │   │ - Configuración        │  │
│  └───────────────┘   └───────────────┘   └───────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│                    ┌───────────────────┐                             │
│                    │ Indicadores        │                             │
│                    │ - Dashboard DG     │                             │
│                    │ - Reportes         │                             │
│                    └───────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
        ▲                                                    │
        │ multilínea (TSS/TLL/GFB/TFS/JUN/GTX/GSM)            │ API futura
        └────────────────────────────────────────────────────┘
                                                    ┌──────────────────┐
                                                    │ GAIOS / CRM / ERP  │
                                                    └──────────────────┘
```

### 2.3 Reglas de negocio transversales (no negociables)

Estas reglas se implementan como restricciones del sistema, no como buenas prácticas sugeridas:

1. Un vendedor no modifica costos, no altera folios, no borra cotizaciones aprobadas.
2. No se cotiza un producto sin precio vigente ni costo actualizado (bloqueo, no advertencia).
3. No se genera PDF de una cotización que requiere autorización pendiente.
4. Toda edición de una cotización ya **enviada** crea una nueva versión; nunca se sobrescribe la enviada.
5. Todo descuento fuera de política queda registrado con usuario, motivo, margen antes/después y, si aplica, autorizador.
6. Margen ≠ markup. El sistema solo calcula y valida **margen** (utilidad / precio de venta), nunca lo confunde con markup (utilidad / costo).
7. Los registros críticos (cotizaciones aprobadas, folios, autorizaciones) usan baja lógica (`deleted_at`), nunca `DELETE` físico.

### 2.4 Multiempresa / multilínea / multiusuario

El modelo se diseña desde el día uno con `business_unit_id` en toda tabla comercial y `company_id` como techo por si en el futuro Global Supplier MTY opera más de una razón social. Hoy solo existe una empresa y siete líneas; la arquitectura no requiere migración estructural para escalar a una segunda empresa.

---

## 3. Arquitectura técnica

| Capa | Elección | Justificación |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind CSS | SSR/RSC para pantallas con datos sensibles (costos/márgenes) renderizados solo donde el rol lo permite; un solo repo despliega frontend+backend |
| Backend | Next.js Server Actions + Route Handlers, Node.js, TypeScript | Evita exponer un backend aparte en el MVP; toda lógica de folios, márgenes y autorización corre en servidor, nunca en el cliente |
| Base de datos | PostgreSQL | Integridad referencial fuerte, `SERIALIZABLE`/advisory locks para folios consecutivos sin colisión, RLS por línea de negocio |
| ORM | Prisma | Migraciones versionadas, tipado end-to-end, middleware de Prisma para soft delete y auditoría automática |
| Autenticación | Auth.js (NextAuth) con proveedor de credenciales + verificación de correo, 2FA opcional (TOTP) | Estándar, soporta sesiones seguras, RBAC vía callbacks de sesión |
| Almacenamiento de archivos | Cloudflare R2 (o S3-compatible) | Imágenes de producto, PDFs generados, evidencias de cotización, fichas técnicas; URLs firmadas con expiración |
| Generación de PDF | Render HTML→PDF server-side (Playwright/Chromium headless o `@react-pdf` para plantillas tabulares) | Control fino de saltos de página, encabezados repetidos, imágenes, QR; se ejecuta en servidor para no exponer folios/datos antes de tiempo |
| Colas / trabajos programados | Cron job ligero (Vercel Cron o worker dedicado) | Recordatorios de seguimiento, marcado automático de "vencida", generación de reportes agendados |
| Despliegue | Docker para desarrollo local reproducible; Vercel (app) + proveedor Postgres administrado (Neon/RDS) para producción | Coincide con el stack sugerido; permite mover a AWS/Render sin reescritura |

### 3.1 Frontera de seguridad de costos (regla de diseño, no de UI)

```
Cliente (browser)                 Servidor (Route Handler / Server Action)
──────────────────                ────────────────────────────────────────
"use client" components   ──────▶  Valida sesión + rol
  nunca reciben:                   Carga cotización/producto completo (con costo)
  - cost_landed                    Aplica proyección según permiso del rol:
  - cost_base                        - Vendedor  → sin costo, sin utilidad, con % margen SOLO si autorizado
  - margin_amount                    - Gerencia  → % margen, sin monto de utilidad salvo autorización
  - supplier data                    - Admin/DG  → todo
                          ◀──────  Responde el DTO ya proyectado (nunca el objeto completo)
```

Esto se implementa como una capa de **proyección de DTO por rol** en el servicio de cotizaciones (`lib/quotations/project.ts`), no como un `if` disperso en componentes.

### 3.2 Estructura de carpetas propuesta (Fase 1)

```
global-quote/
├── app/                                  # aplicación Next.js (se crea al iniciar Módulo 1 del código)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login, forgot-password, reset-password
│   │   │   └── (app)/
│   │   │       ├── dashboard/
│   │   │       ├── quotations/            # listado, nueva, [id], [id]/versions
│   │   │       ├── approvals/             # panel de autorizaciones pendientes
│   │   │       ├── customers/, contacts/
│   │   │       ├── products/, categories/, price-lists/, suppliers/
│   │   │       ├── business-units/
│   │   │       ├── orders/
│   │   │       ├── followups/
│   │   │       ├── reports/
│   │   │       ├── admin/ users, roles, permissions, sequences, templates,
│   │   │       │          taxes, banks, terms, audit, imports
│   │   │       └── settings/
│   │   │   └── api/
│   │   │       ├── pdf/[quotationId]/route.ts
│   │   │       └── webhooks/
│   │   ├── components/ui, layout, quotations, products, customers, admin
│   │   ├── lib/
│   │   │   ├── quotations/                # folio.ts, margin.ts, project.ts, state-machine.ts
│   │   │   ├── auth/                      # session.ts, permissions.ts
│   │   │   ├── pdf/                       # render.ts, templates/
│   │   │   ├── storage/
│   │   │   ├── audit/
│   │   │   └── validations/               # Zod schemas
│   │   └── types/
│   └── tests/
│       ├── unit/            # folio.ts, margin.ts, state-machine.ts
│       ├── integration/      # API routes + DB
│       └── e2e/              # Playwright: flujo cotización completo
└── docs/
    └── ARCHITECTURE.md       # este documento
```

### 3.3 Variables de entorno (Fase 1)

```
DATABASE_URL=
DIRECT_URL=                      # para migraciones de Prisma en pooling
NEXTAUTH_URL=
NEXTAUTH_SECRET=
SMTP_HOST= / SMTP_USER= / SMTP_PASS=      # verificación de correo, recuperación de contraseña
STORAGE_ENDPOINT= / STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID= / STORAGE_SECRET_ACCESS_KEY=
PDF_RENDERER_URL=                 # si se usa un servicio headless separado
TOTP_ISSUER=                      # 2FA opcional
DEFAULT_TZ=America/Monterrey
```

### 3.4 Riesgos técnicos identificados

| Riesgo | Mitigación |
|---|---|
| Colisión de folios bajo concurrencia (dos vendedores cotizando en la misma línea al mismo tiempo) | Consecutivo generado dentro de una transacción con `SELECT ... FOR UPDATE` sobre `sequence_settings`, nunca calculado en aplicación a partir de un `COUNT(*)` |
| Filtración de costo/margen por un endpoint mal proyectado | Único punto de salida de datos de cotización/producto pasa por `project.ts`; test de contrato que falla el build si un campo de costo aparece en el DTO de rol Vendedor |
| PDF que se desincroniza del dato aprobado (se aprueba con un precio y se genera con otro) | El PDF se genera a partir de una versión inmutable (`quotation_versions`) congelada al momento de aprobar, no de la cotización "viva" |
| Crecimiento de líneas de negocio o campos de producto sin romper catálogo | Atributos variables de producto (kits, configurables, servicios) en tabla de atributos tipada (EAV controlado), no columnas nuevas por tipo |

---

## 4. Roles y permisos

### 4.1 Matriz de permisos (resumen operativo)

| Capacidad | Super Admin | Dirección General | Administración | Gerente de Ventas | Vendedor | Marketing | Consulta |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver costos / márgenes monetarios | ✅ | ✅ | ✅ | Limitado* | ❌ | ❌ | ❌ |
| Crear/editar productos | ✅ | ❌ | ✅ | ❌ | ❌ | Solo fichas comerciales | ❌ |
| Cargar listas de precios | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear cotización | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver todas las cotizaciones | ✅ | ✅ | ✅ | Solo su equipo | Solo propias/asignadas | ❌ | Autorizado |
| Aplicar descuento dentro de su límite | ✅ | ✅ | ✅ | ✅ (rango medio) | ✅ (rango bajo) | ❌ | ❌ |
| Aprobar excepción de margen/descuento | ✅ | ✅ | Según regla | Según regla | ❌ | ❌ | ❌ |
| Generar/descargar PDF | ✅ | ✅ | ✅ | ✅ | Solo si autorizada | ❌ | ❌ |
| Editar cotización ya aprobada | ✅ (con versión) | ❌ | ✅ (con versión) | ❌ | ❌ | ❌ | ❌ |
| Eliminar / cancelar documentos | ✅ | ❌ | Cancelar (no eliminar) | ❌ | ❌ | ❌ | ❌ |
| Configurar folios / series | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configurar roles/permisos | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Consultar auditoría | ✅ | ✅ | Parcial | ❌ | ❌ | ❌ | ❌ |
| Convertir cotización en pedido | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Gerente de Ventas ve **porcentaje** de margen si su rol lo tiene habilitado explícitamente; nunca ve utilidad en moneda ni costo base.

### 4.2 Modelo de autorización

RBAC clásico (`roles`, `permissions`, `role_permissions`) **más** una capa de alcance (`user_business_units`, `user_customers` cuando aplica "clientes asignados") **más** una capa de política numérica configurable (tabla `discount_policies` / `authorization_rules`, ver §8) que no depende del rol sino de umbrales (% descuento, monto total, vigencia, moneda). Un permiso responde "¿puede intentar la acción?"; una política de autorización responde "¿este valor concreto requiere que alguien más lo apruebe?". Son dos capas independientes y ambas se auditan.

### 4.3 Sesiones y acceso

- Sesión expira por inactividad (configurable, default 30 min) y de forma absoluta a las 12 h.
- Bloqueo tras 5 intentos fallidos con backoff progresivo.
- 2FA (TOTP) opcional por usuario, obligatorio para Super Admin y Dirección General (configurable).
- Todo cambio de rol o de línea de negocio asignada se audita con quién lo hizo y cuándo.

---

## 5. Modelo de datos

### 5.1 Diagrama entidad-relación (alto nivel)

```
business_units 1───∞ users (via user_business_units) ∞───1 roles ──∞ role_permissions ──1 permissions
       │
       ├──∞ categories ──∞ products ──∞ product_images / product_documents / product_costs
       │                       │
       │                       └──∞ price_list_items ──1 price_lists
       │
       ├──∞ sequence_settings (folios por línea)
       ├──∞ document_templates
       ├──∞ terms_and_conditions
       └──∞ bank_accounts

customers ──∞ customer_addresses
customers ──∞ contacts
customers ──∞ customer_prices

quotations ─┬─1 business_units
            ├─1 customers, contacts
            ├─1 users (vendedor)
            ├─∞ quotation_items ──1 products
            ├─∞ quotation_versions (snapshot inmutable por versión)
            ├─∞ quotation_approvals
            ├─∞ quotation_status_history
            ├─∞ quotation_followups
            ├─∞ quotation_files
            └─1 orders (0..1, al convertirse)

orders ──∞ order_items

audit_logs ──∞ (polimórfico: referencia cualquier entidad + acción)
```

### 5.2 Tablas y columnas clave (Fase 1 y 2)

> Todas las tablas de negocio incluyen: `id uuid pk`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (soft delete). Se omiten aquí por brevedad y se dan por incluidas.

**`business_units`**
`code` (TSS/TLL/GFB/TFS/JUN/GTX/GSM, unique) · `name` · `logo_url` · `color_primary` · `color_secondary` · `tax_id` (RFC) · `legal_name` · `address` · `bank_account_id` (fk) · `min_margin_default` numeric(5,2) · `folio_numbering_mode` (`annual`|`continuous`) · `folio_reset_rule` · `active` boolean.

**`sequence_settings`**
`business_unit_id` fk · `document_type` (`quotation`|`order`|`credit_note`|`delivery_note`) · `prefix` · `year` · `month` · `last_consecutive` int · `reset_rule` · unique (`business_unit_id`, `document_type`, `year`, `month`).

**`users`**
`email` unique · `password_hash` · `full_name` · `role_id` fk · `active` · `two_factor_enabled` · `discount_limit_pct` numeric(5,2) · `last_login_at` · `failed_login_attempts`.

**`roles`** (`super_admin`, `direccion_general`, `administracion`, `gerente_ventas`, `vendedor`, `marketing`, `consulta`) · `permissions` ── `role_permissions` (m:n).

**`user_business_units`** (m:n usuario ↔ línea autorizada) · `user_customers` (m:n vendedor ↔ cliente asignado, para el caso "no ver clientes de otros vendedores salvo autorización").

**`customers`**
`business_unit_id` (o m:n si un cliente compra a varias líneas) · `legal_name` · `trade_name` · `tax_id` · `country`/`state`/`city`/`zip` · `industry` · `segment` · `assigned_seller_id` fk users · `payment_terms_id` fk · `credit_limit` numeric · `preferred_currency` · `price_list_id` fk · `authorized_discount_pct` · `status`.

**`customer_addresses`**, **`contacts`** (`decision_power` enum, `last_contact_at`, `next_followup_at`).

**`suppliers`**, **`categories`** (auto-referencial para subcategoría).

**`products`**
`business_unit_id` · `internal_sku` unique · `supplier_sku` · `barcode` · `brand` · `category_id` · `subcategory_id` · `name` · `short_description` · `technical_description` · `type` (`standard`|`configurable`|`project`|`kit`|`combo`|`service`|`installation`|`freight`|`promotional`|`custom`|`backorder`) · `uom` · `min_order_qty` · `lead_time_days` · `warranty` · `country_of_origin` · `supplier_id` fk · `purchase_currency` · `status` · `updated_by`.

**`product_costs`** (histórico, una fila por vigencia)
`product_id` fk · `purchase_cost` · `logistics_cost` · `import_expenses` · `landed_cost` (calculada) · `target_margin_pct` · `min_margin_pct` · `effective_from` · `effective_to` (null = vigente) · `updated_by`.

**`product_images`**, **`product_documents`** (ficha técnica, manual, video/enlace).

**`price_lists`** (`code`, `name`, `type`: lista/distribuidor/corporativo/proyecto, `currency`, `valid_from`, `valid_to`).
**`price_list_items`** (`price_list_id`, `product_id`, `list_price`, `special_price`).
**`volume_prices`** (`product_id`, `min_qty`, `unit_price`).
**`customer_prices`** (`customer_id`, `product_id`, `unit_price`, `valid_to`).

**`quotations`**
`folio` unique · `short_folio` · `business_unit_id` · `customer_id` · `contact_id` · `seller_id` · `currency` · `exchange_rate` · `status` (ver §6.1) · `subtotal` · `discount_total` · `freight` · `installation` · `tax_total` · `total` · `margin_pct` (calculado, snapshot) · `valid_until` · `delivery_time` · `payment_terms_id` · `notes` · `template_type` (ver §9.2) · `requires_approval` boolean · `current_version` int.

**`quotation_versions`** (snapshot **inmutable** completo de la cotización + items al momento de envío/aprobación: JSON congelado + referencia) `quotation_id` · `version_number` · `snapshot` jsonb · `created_by` · `reason`.

**`quotation_items`**
`quotation_id` · `product_id` · `description_override` · `qty` · `unit_price` · `discount_pct` · `discount_amount` · `line_total` · `delivery_time_override` · `sort_order`.

**`quotation_approvals`**
`quotation_id` · `rule_triggered` (`discount_over_limit`|`margin_below_min`|`amount_over_threshold`|`currency_usd`|`validity_over_30d`|...) · `requested_by` · `requested_at` · `approver_id` · `decision` (`pending`|`approved`|`rejected`) · `decided_at` · `margin_before` · `margin_after` · `justification`.

**`quotation_status_history`** (`quotation_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `note`).

**`quotation_followups`**
`quotation_id` · `contact_method` · `sent_at` · `opened_at` · `next_followup_at` · `close_probability_pct` · `weighted_amount` (calculado) · `competitor` · `objection` · `loss_reason` · `comments` · `owner_id`.

**`quotation_files`** (evidencias: correo enviado, acuse, comprobante) `quotation_id` · `file_url` · `type` · `uploaded_by`.

**`orders`**
`folio` (`PED-{LINEA}-{AÑO}-{CONSECUTIVO}`) · `quotation_id` fk · hereda cliente/items/condiciones · `status`.
**`order_items`** (espejo de `quotation_items` al momento de conversión).

**`payment_terms`**, **`currencies`**, **`exchange_rates`** (`from`, `to`, `rate`, `date`), **`taxes`** (IVA 16%, exento, tasa 0), **`discounts`** (catálogo de motivos de descuento).

**`audit_logs`**
`entity_type` · `entity_id` · `user_id` · `action` · `field_changed` · `old_value` · `new_value` · `ip_address` · `reason` · `occurred_at` — **append-only**, sin `UPDATE`/`DELETE` permitido a nivel de rol de base de datos.

**`notifications`**, **`company_settings`**, **`document_templates`** (uno por línea × tipo de plantilla, ver §9.2), **`bank_accounts`**, **`terms_and_conditions`** (versionadas, una vigente por línea).

### 5.3 Índices y constraints críticos

- `quotations.folio` — `UNIQUE`, generado solo por la función de folio (§7), nunca editable desde la aplicación tras creación (`CHECK` a nivel de trigger que rechaza `UPDATE` de `folio`).
- `sequence_settings (business_unit_id, document_type, year, month)` — `UNIQUE`, con `SELECT ... FOR UPDATE` en la transacción que incrementa `last_consecutive`.
- `product_costs`: constraint de exclusión (`EXCLUDE USING gist`) para que no existan dos vigencias de costo traslapadas para el mismo producto.
- `quotation_items.discount_pct` — `CHECK (discount_pct >= 0 AND discount_pct <= 100)`.
- Todas las FK con `ON DELETE RESTRICT` salvo relaciones hijas de agregado (`quotation_items`, `order_items`) con `ON DELETE CASCADE` **solo** desde el padre lógico, nunca al revés.
- Soft delete: `deleted_at timestamptz null`; todas las consultas de aplicación filtran `deleted_at IS NULL` vía middleware de Prisma, no manualmente en cada query.

---

## 6. Flujo completo de cotización

### 6.1 Máquina de estados

```
Borrador ──▶ Pendiente de información ──▶ Pendiente de autorización ──▶ Autorizada ──▶ Enviada
                                                     │                                    │
                                                     ▼                                    ▼
                                                 Rechazada                          Vista por cliente
                                                                                          │
                                                                                          ▼
                                                                                  En seguimiento ──▶ Negociación
                                                                                          │                │
                                          ┌───────────────────────────────────────────────┴────────────────┤
                                          ▼                                                                 ▼
                                     Vencida                                                          Aceptada ──▶ Convertida a pedido ──▶ Cerrada ganada
                                          │
                                          ▼
                                     Cancelada                                                        Rechazada por cliente ──▶ Cerrada perdida
```

Reglas de transición (motor de estados, `lib/quotations/state-machine.ts`):

- Solo `Borrador` y `Pendiente de información` son editables libremente.
- Entrar a `Pendiente de autorización` es automático si el motor de reglas (§8) marca la cotización; si no requiere autorización, pasa directo de `Borrador` a `Autorizada` al confirmarse.
- `Autorizada` → `Enviada` genera **la primera versión inmutable** (`quotation_versions`, `version_number = 0` o `1`) y bloquea edición directa.
- Cualquier cambio después de `Enviada` no modifica el registro: crea una **nueva cotización-versión** (`folio-V{n}`) en `Borrador`, ligada a la misma raíz de folio.
- `Vencida` se dispara automáticamente (cron) cuando `now() > valid_until` y el estado sigue en `Enviada`/`Vista por cliente`/`En seguimiento`/`Negociación`.
- `Cancelada` y `Rechazada` **no liberan el folio** (§7).
- `Convertida a pedido` es un estado terminal para la cotización (el pedido vive en `orders`, referenciando el folio origen).

### 6.2 Pasos operativos (del brief, mapeados a acciones del sistema)

1. Seleccionar línea de negocio → filtra catálogo, vendedores autorizados, plantilla y serie de folio.
2. Seleccionar cliente y contacto (o crear prospecto si el rol lo permite).
3. El sistema **crea el folio** al pasar de "nueva" a `Borrador` guardado (no antes, para no desperdiciar consecutivos con borradores nunca guardados — ver §7.4).
4. Agregar productos (con imagen, ficha) → cantidades → el sistema resuelve el precio aplicable (lista > cliente > volumen > especial, ver §5.2) automáticamente; el vendedor no captura precio libre.
5. Aplicar descuento: el sistema calcula margen resultante en tiempo real y compara contra `min_margin_pct` del producto/línea.
6. Agregar flete, instalación, servicios como líneas de tipo `service`/`freight`/`installation`.
7. Aplicar impuestos según catálogo de `taxes` (producto exento se resuelve automáticamente).
8. Configurar moneda; si es distinta a la moneda base de la línea, se congela el tipo de cambio del día (`exchange_rates`) en la cotización.
9. Definir vigencia, tiempo de entrega, condiciones de pago, observaciones, términos (heredados de la línea, editables solo por rol autorizado).
10. Revisar margen consolidado → si algo dispara una regla (§8), el sistema mueve automáticamente a `Pendiente de autorización` y notifica al aprobador correspondiente (panel de pendientes + correo).
11. Aprobador decide (aprobar/rechazar) desde escritorio, móvil o el panel de pendientes; queda registrado con margen antes/después.
12. `Autorizada` → el vendedor genera el PDF (el sistema **bloquea** la generación si el estado no es `Autorizada` o si no requiere autorización y está en `Borrador` confirmado).
13. Envío por correo (integración simple SMTP en Fase 1; WhatsApp queda para Fase 3) con adjunto y registro de `sent_at`.
14. Seguimiento: recordatorios automáticos (1/3/7 días, antes/después de vencimiento).
15. Aceptación → conversión a pedido con un clic, heredando todo (§5.2, `orders`).

---

## 7. Sistema de folios

### 7.1 Formato

**Largo:** `[LÍNEA]-[AÑO]-[MES]-[CONSECUTIVO]-[VENDEDOR]` → `TSS-2026-07-0001-KS`
**Corto:** `[LÍNEA]-[AAMM]-[CONSECUTIVO]` → `TSS-2607-0001`
**Versión:** se anexa al folio largo o corto sin alterarlo → `TSS-2026-07-0001-V1`
**Pedido:** `PED-[LÍNEA]-[AÑO]-[CONSECUTIVO]` → `PED-TSS-2026-0001` (serie independiente, propia tabla `sequence_settings` con `document_type = 'order'`)

### 7.2 Algoritmo de generación (garantía de unicidad e irreversibilidad)

```ts
// lib/quotations/folio.ts (pseudocódigo del contrato, no implementación final)
async function nextFolio(businessUnitId, documentType, sellerCode, tx) {
  const period = documentType === 'order' ? { year } : { year, month }; // según reset_rule de la línea
  const seq = await tx.sequenceSettings.findUniqueOrThrow({
    where: { businessUnitId_documentType_year_month: { businessUnitId, documentType, ...period } },
    // dentro de una transacción con row lock (SELECT ... FOR UPDATE)
  });
  const consecutive = seq.lastConsecutive + 1;
  await tx.sequenceSettings.update({ where: { id: seq.id }, data: { lastConsecutive: consecutive } });
  return formatFolio({ businessUnit, period, consecutive, sellerCode, documentType });
}
```

Puntos de diseño obligatorios:

- El incremento del consecutivo y la creación de la cotización ocurren en **la misma transacción de base de datos**; si la cotización falla al guardarse, la transacción hace rollback y el consecutivo **no se pierde en falso** (no se incrementa fuera de la transacción).
- Un consecutivo, una vez asignado y confirmado (commit exitoso), **nunca se reutiliza**, aunque la cotización se cancele, rechace, venza o se sustituya — el folio queda "quemado" a propósito, como en la papelería fiscal.
- `sequence_settings` es editable por Super Admin **solo** para configurar prefijo, modo de reinicio (anual/continuo) y regla de notas de crédito/pedidos/remisiones — nunca para "corregir" un consecutivo ya emitido (eso rompería la garantía de irreversibilidad); una corrección real se hace con una nota interna auditada, no editando el contador.
- Reglas de reinicio configurables por línea: anual (reinicia en enero), continuo (nunca reinicia), o por rango fiscal si se requiere en el futuro.

### 7.3 Versionado

Cada versión posterior al envío:

- Conserva el folio raíz y consecutivo (no genera un nuevo consecutivo).
- Incrementa `quotations.current_version` y crea una fila en `quotation_versions` con el snapshot **anterior** congelado antes de aplicar el cambio.
- El PDF siempre indica "Versión N" y "Página X de Y"; todas las versiones anteriores siguen siendo consultables (nunca se eliminan).

### 7.4 Cuándo se emite el folio

Para no "quemar" consecutivos con borradores que el vendedor nunca completa, el folio se asigna en el primer `guardar` explícito (no en cada tecleo de un formulario en memoria en el cliente) — es decir, al crear el registro de `Borrador` en base de datos, no antes. Esto es una decisión de producto explícita a validar con Dirección General, ya que el brief pide "irreversible": irreversible se interpreta aquí como *una vez guardado, nunca se reutiliza o edita*, no como *se genera con cada tecla*.

---

## 8. Reglas de margen y autorización

### 8.1 Margen vs. markup (fórmula única del sistema)

```
Precio de venta antes de IVA = Costo aterrizado / (1 - margen deseado)

Ejemplo:  Costo = $1,000   Margen = 30%   →  Precio = 1000 / (1 - 0.30) = $1,428.57
```

El sistema **nunca** ofrece un campo "markup" como entrada de negocio; toda captura y validación de rentabilidad usa margen sobre precio de venta. Un único módulo (`lib/quotations/margin.ts`) centraliza esta fórmula — ningún otro punto del código recalcula margen de forma distinta.

### 8.2 Motor de reglas de autorización (configurable, no hardcodeado en el flujo)

Tabla `authorization_rules`: `rule_type`, `business_unit_id` (nullable = aplica a todas), `threshold_min`, `threshold_max`, `approver_role`, `active`.

| Regla | Umbral | Aprobador |
|---|---|---|
| Descuento por línea/partida | hasta 5% | Vendedor (autolímite, sin trámite) |
| Descuento | 5.01%–10% | Gerente de Ventas |
| Descuento | > 10% | Dirección General |
| Margen por debajo del mínimo del producto | cualquiera | Dirección General |
| Monto total de la cotización | > $500,000 MXN (o equivalente) | Dirección General |
| Crédito especial (fuera de línea de crédito del cliente) | — | Administración |
| Vigencia de la cotización | > 30 días | Según regla configurada (default: Gerente) |
| Moneda USD | cuando la línea lo marque como excepcional | Según configuración por línea |
| Producto sin costo vigente (`product_costs.effective_to` vencido o nulo futuro) | — | **Bloqueo duro**, no autorización — no se puede agregar a la cotización |
| Producto descontinuado (`products.status = 'discontinued'`) | — | **Bloqueo duro** |
| Precio de lista con fecha de actualización vencida (>N días, configurable) | — | Advertencia visible, no bloqueo |

### 8.3 Qué registra cada autorización

`quotation_approvals`: quién solicitó, cuándo, qué regla se disparó, quién decidió, cuándo decidió, **margen antes y después** de cualquier ajuste, y la justificación de texto libre del vendedor. Este registro es inmutable (append-only, igual que `audit_logs`).

### 8.4 Canales de autorización

El panel `/approvals` es la fuente única de verdad; una notificación por correo con enlace profundo (deep link) permite aprobar/rechazar desde teléfono sin instalar nada adicional. La Fase 1 no requiere una app móvil nativa — el enlace firmado y de un solo uso resuelve el caso de uso "aprobar desde el teléfono".

---

## 9. Mapa de pantallas

### 9.1 Navegación principal (sidebar, por rol)

```
Inicio · Dashboard
Cotizaciones          → Listado · Nueva · Detalle · Versiones · Duplicar
Autorizaciones         → Panel de pendientes (solo roles con capacidad de aprobar)
Clientes · Contactos
Productos · Categorías · Listas de precios · Proveedores
Líneas de negocio       (Super Admin / DG)
Pedidos
Seguimientos            → Hoy · Vencidos · Próximos · Completados
Reportes
Plantillas PDF          (Super Admin)
Administración          → Usuarios · Roles · Permisos · Folios/series · Impuestos ·
                          Bancos · Términos y condiciones · Auditoría · Importaciones
Configuración
```

### 9.2 Pantallas críticas del MVP (con su propósito, no solo el nombre)

| Pantalla | Propósito | Rol principal |
|---|---|---|
| `/quotations/new` | Wizard de 4 pasos: Línea+Cliente → Productos → Condiciones → Revisión y envío a autorización | Vendedor, Gerente, Admin |
| `/quotations/[id]` | Detalle con timeline de estado, versiones, autorizaciones, seguimiento, botón "Convertir a pedido" | Todos (proyectado por rol) |
| `/quotations/[id]/pdf` | Vista previa del PDF antes de descargar/enviar (bloqueada si `requires_approval` pendiente) | Todos con permiso de descarga |
| `/approvals` | Bandeja de pendientes con margen antes/después, monto, línea, solicitante, botones aprobar/rechazar + motivo | Gerente, Admin, DG |
| `/products/[id]` | Ficha con tabs: Comercial (Marketing edita) / Costos y márgenes (oculto a Vendedor) / Precios / Imágenes | Admin, Marketing (parcial) |
| `/customers/[id]` | Ficha 360°: datos fiscales, condiciones, historial de cotizaciones y pedidos, contactos | Vendedor (solo asignados), Admin |
| `/dashboard` | KPIs de Dirección General (ver §16 del brief): cotizado, ganado, perdido, conversión, margen promedio, por línea/vendedor | DG, Admin |
| `/admin/sequences` | Configuración de folios por línea: prefijo, modo de reinicio, consecutivo actual (solo lectura del valor, no editable a la baja) | Super Admin |
| `/admin/templates` | Selección de plantilla por línea (ejecutiva/técnica/con imágenes/resumida/detallada) y términos y condiciones vigentes | Super Admin |
| `/admin/audit` | Búsqueda de auditoría por entidad/usuario/fecha | Super Admin, DG (parcial) |

### 9.3 Componentes de UI transversales (design system, Fase 1)

`Sidebar`, `Header` con búsqueda global, `Table` filtrable con estado vacío y skeleton, `Modal`/`Drawer`, `Toast`, `Badge` de estado de cotización (con color por estado), `MarginIndicator` (semáforo: verde por arriba del objetivo, amarillo entre mínimo y objetivo, rojo por debajo del mínimo — visible solo a roles con permiso de margen), `ApprovalRequestBanner` (aviso persistente cuando una cotización está pendiente), `PDFPreview`.

---

## 10. Plan del MVP por módulos

Cada módulo se construye, se prueba y se integra antes de iniciar el siguiente. "Probar" incluye pruebas unitarias del módulo, pruebas de integración contra la base de datos de desarrollo, y una verificación manual del flujo en navegador antes de marcarlo como cerrado.

### Fase 1 — MVP (base operativa)

| # | Módulo | Construir | Probar | Integrar |
|---|---|---|---|---|
| 1 | Cimientos | Repo Next.js+TS+Tailwind, Prisma + Postgres, Auth.js con login/roles, middleware de sesión y RBAC | Unit: `permissions.ts`. Integración: login con cada rol de seed | Base para todos los módulos siguientes |
| 2 | Líneas de negocio + configuración | CRUD de `business_units`, `sequence_settings`, `bank_accounts`, `terms_and_conditions`, `taxes` | Seed de las 7 líneas; test de unicidad de `code` | Todo módulo posterior filtra por línea |
| 3 | Catálogo | CRUD `categories`, `products`, `product_costs` (con vigencias sin traslape), `product_images`, `price_lists`/`price_list_items` | Unit: cálculo de `landed_cost`; constraint de exclusión de vigencias | Cotizaciones (Módulo 5) consume precios de aquí |
| 4 | Clientes y contactos | CRUD `customers`, `customer_addresses`, `contacts`, asignación vendedor↔cliente | Test: un vendedor no ve clientes no asignados | Cotizaciones referencia cliente/contacto |
| 5 | Motor de folios | `sequence_settings` + función transaccional `nextFolio` | Unit: 100 folios concurrentes simulados sin colisión ni reutilización tras rollback | Cotizaciones y Pedidos dependen de este módulo |
| 6 | Cotizaciones (núcleo) | `quotations`, `quotation_items`, wizard de creación, resolución automática de precio aplicable | Integración: crear cotización de extremo a extremo con folio real | — |
| 7 | Margen y autorización | `lib/quotations/margin.ts`, `authorization_rules`, `quotation_approvals`, máquina de estados | Unit: fórmula de margen contra tabla de casos del brief (incluye el ejemplo $1,000/30%→$1,428.57); test que un descuento del 12% dispare aprobación de DG | Bloquea generación de PDF si `requires_approval = true` |
| 8 | Versionado | `quotation_versions`, congelamiento de snapshot al enviar, folio `-V{n}` | Test: editar una cotización `Enviada` genera V1 sin alterar la V0 | Historial visible en `/quotations/[id]` |
| 9 | PDF | Motor de render server-side, plantillas por línea (logo, colores, datos fiscales, QR, folio, versión, paginación) | Test visual: PDF con 50 líneas de producto no rompe encabezados/paginación | Bloqueado por estado de autorización (Módulo 7) |
| 10 | Auditoría | `audit_logs` append-only, middleware de Prisma que registra cambios de campos sensibles | Test: intento de `UPDATE`/`DELETE` directo sobre `audit_logs` falla a nivel de permiso de BD | Transversal a todos los módulos anteriores |

**Criterio de salida de Fase 1:** un Super Admin puede dar de alta las 7 líneas con datos demo, un Vendedor puede crear una cotización en TSS que dispare una autorización por descuento >10%, Dirección General la aprueba desde `/approvals`, el vendedor genera el PDF y el folio/versión quedan correctos y trazables en auditoría.

### Fase 2 — Control comercial

| # | Módulo | Construir | Probar | Integrar |
|---|---|---|---|---|
| 11 | Seguimiento | `quotation_followups`, recordatorios automáticos (cron 1/3/7 días, pre/post vencimiento) | Test: cotización vencida cambia de estado automáticamente | Dashboard (Módulo 13) consume estos datos |
| 12 | Pedidos | `orders`, `order_items`, conversión con un clic heredando todo de la cotización aceptada | Test: pedido conserva folio origen y evidencias | — |
| 13 | Dashboards y reportes | KPIs de §16/§17 del brief, export PDF/Excel/CSV | Test: totales del dashboard cuadran contra suma directa en BD | — |
| 14 | Importaciones | Importador de productos/clientes/precios vía Excel/CSV con vista previa, detección de duplicados, bitácora y respaldo previo | Test: importación con errores no aplica parcialmente (todo o nada) | Catálogo y Clientes |
| 15 | Auditoría avanzada | Búsqueda y filtros en `/admin/audit`, exportación | — | — |

### Fase 3 — Integraciones (fuera del MVP, solo puntos de extensión)

CRM/GAIOS (API de cotizaciones/pedidos de solo lectura para agentes de IA), WhatsApp Business API, correo transaccional enriquecido, facturación (CFDI) tras pedido, inventario en tiempo real, firma electrónica de aceptación de cotización, sincronización de proveedores. Ninguno de estos puntos requiere cambiar el modelo de datos de la Fase 1; se diseñaron `quotations`/`orders` como la fuente de verdad que estas integraciones consumen, no al revés.

---

## Siguiente paso

Validar este documento con Dirección General antes de iniciar el Módulo 1. Una vez aprobado, cada módulo de la Fase 1 se entrega en su propio PR con su propio checklist de pruebas — no se escribe el MVP completo en un solo cambio.
