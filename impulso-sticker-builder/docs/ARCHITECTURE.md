# Impulso Sticker Builder — Arquitectura (Fase 0)

> Estado: **diseño únicamente**. Ningún código de producto ha sido escrito todavía. Este documento es el entregable de la Fase 0 y la base de referencia para todas las fases posteriores.

## 0. Alcance y decisiones ya tomadas

| Pregunta | Decisión |
|---|---|
| Propósito del producto | **Solo herramienta de diseño**: editor visual que exporta el sticker listo para imprenta (PNG/SVG/PDF con línea de corte). No incluye checkout, pagos ni fulfillment de impresión — eso ocurre fuera del sistema. |
| Usuarios | **B2C y B2B** desde el día uno: personas individuales diseñando para sí mismas, y organizaciones/equipos con marca propia (brand kit) diseñando en conjunto. |
| Stack tecnológico | **Independiente**, definido desde cero para este producto (no hereda la stack de `platform/` en este repo). |
| Repositorio | **Nuevo, separado** de este monorepo. Este documento vive aquí temporalmente solo como registro de la Fase 0. |
| Explícitamente fuera de alcance (por ahora) | Checkout/pagos, integración con proveedores de impresión, white-label embebido para terceros, la "Impulso Builder Platform" completa (multi-módulo). |

---

## 1. Visión técnica en una frase

Un editor 2D **vector-first** (no solo raster) porque el entregable final de un sticker no es una imagen bonita en pantalla, sino un **archivo imprimible con una línea de corte (die-line) geométricamente precisa** — eso condiciona casi todas las decisiones de este documento.

---

## 2. Tecnologías

### Frontend
- **React 18 + TypeScript**
- **Next.js (App Router)** como shell de la app: SSR/SEO para marketing, login y dashboard; el editor en sí se monta como un árbol cliente pesado dentro de una ruta (`/editor/[projectId]`).
- **Fabric.js** como motor de canvas. Se prefiere sobre Konva.js porque sus objetos son ciudadanos de primera clase tanto en canvas como en **SVG** (import/export nativo), lo cual encaja mejor con la necesidad de producir vectores limpios para impresión, en vez de tener que "reconstruir" vectores a partir de un canvas raster.
- **Zustand + Immer** para estado del editor (capas, historial undo/redo, selección) — más liviano que Redux para un árbol de estado que muta con cada arrastre del mouse.
- **Tailwind CSS** para la UI de paneles/toolbars (no para el canvas en sí).
- **Radix UI** (o similar headless) para primitivos accesibles: menús, popovers, sliders de color.

### Backend
- **NestJS (Node.js + TypeScript)** como API principal. Se elige sobre meter todo en API routes de Next.js porque la lógica de organizaciones/roles, versionado de proyectos y export jobs es sustancial y se beneficia de módulos, guards e inyección de dependencias — y porque mantiene el backend reutilizable si en el futuro otro módulo de Impulso Builder Platform necesita el mismo servicio de proyectos/exportación.
- **Prisma ORM** sobre **PostgreSQL**.
- **BullMQ + Redis** para la cola de trabajos de exportación (ver §4.4).
- **Worker de exportación** (proceso Node separado) que consume la cola y genera los archivos finales de alta resolución.

### Datos y almacenamiento
- **PostgreSQL** (relacional, con columnas JSONB para el documento de diseño — ver §6).
- **S3-compatible object storage** (Cloudflare R2 o AWS S3) para assets subidos por usuarios y archivos exportados.
- **Redis** para cola de jobs y cache de sesiones/rate limiting.

### Autenticación
- **Clerk** (o **Auth.js** como alternativa open-source si se prefiere no depender de un servicio de terceros). Se recomienda Clerk porque trae soporte nativo de **organizaciones/equipos** (necesario para B2B) sin tener que construirlo a mano.

### Procesamiento gráfico (server-side)
- **potrace** (o equivalente): tracing de raster → vector, para cuando un usuario sube una imagen bitmap y se necesita generar automáticamente una línea de corte.
- **Clipper (offsetting de polígonos)**: para generar el die-line como un offset geométrico del contorno del artwork (con margen de sangrado configurable).
- **sharp**: procesamiento raster (miniaturas, PNG de alta resolución).
- **pdf-lib / svg2pdf.js**: ensamblado del PDF final (con capas separadas: arte + línea de corte).

### Calidad, CI/CD y observabilidad
- **Vitest + Testing Library** (frontend), **Jest** (NestJS, es el default del framework).
- **Playwright** para e2e del editor (arrastrar, redimensionar, exportar).
- **GitHub Actions** para CI. Deploy: frontend en Vercel; API/worker en un proveedor con contenedores de larga duración (Railway/Fly.io/ECS) — Vercel no es apto para el worker de export por sus límites de tiempo de ejecución.
- **Sentry** (errores) + **PostHog** (analítica de producto, clave para iterar UX de un editor).

---

## 3. Estructura de carpetas

Monorepo con **pnpm workspaces + Turborepo**, aunque hoy solo exista un módulo — así `packages/editor-core` queda aislado y reusable si más adelante se embebe en otro contexto, sin una extracción dolorosa después.

```
impulso-sticker-builder/
├── apps/
│   ├── web/                      # Next.js: marketing, auth, dashboard, editor
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (marketing)/
│   │       │   ├── (auth)/
│   │       │   ├── (dashboard)/
│   │       │   │   ├── projects/
│   │       │   │   └── organization/
│   │       │   └── editor/[projectId]/
│   │       ├── components/       # UI específica de la app (no del design system)
│   │       └── lib/
│   ├── api/                      # NestJS
│   │   └── src/
│   │       └── modules/
│   │           ├── auth/
│   │           ├── organizations/
│   │           ├── projects/
│   │           ├── assets/
│   │           ├── templates/
│   │           └── exports/
│   └── export-worker/            # Consumidor BullMQ: render final PNG/SVG/PDF
│       └── src/
├── packages/
│   ├── editor-core/              # Motor de canvas, capas, historial, die-cut — desacoplado de React donde es posible
│   ├── ui/                       # Design system compartido (botones, paneles, color picker)
│   ├── types/                    # Tipos TS + esquemas Zod compartidos (Project, Layer, Asset, Organization...)
│   └── config/                   # eslint/tsconfig/tailwind compartidos
├── infra/
│   └── docker-compose.yml        # Postgres + Redis + MinIO (S3 local) para desarrollo
├── docs/
│   └── ARCHITECTURE.md           # este documento
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 4. Componentes principales

### 4.1 Editor Canvas (`packages/editor-core` + `apps/web/editor`)
Superficie de edición interactiva: formas, texto, imágenes, paneles de capas, alineación/snapping, zoom/pan, historial undo/redo persistido.

### 4.2 Motor de contorno / die-cut
El diferenciador real del producto frente a un editor gráfico genérico:
- Contorno automático por offset geométrico alrededor del artwork (Clipper), con margen configurable (sangrado).
- Edición manual del contorno cuando el automático no es suficiente.
- Formas preestablecidas (círculo, rectángulo, rectángulo redondeado, forma libre/custom shape).

### 4.3 Biblioteca de assets
Uploads del usuario (raster/vector), clipart/plantillas curadas, gestión de fuentes tipográficas. Incluye tracing automático (potrace) al subir una imagen raster que necesite convertirse en contorno vectorial.

### 4.4 Pipeline de exportación
El render final de alta resolución (300+ DPI, PDF en CMYK con capa de línea de corte separada) es costoso en CPU/tiempo — se ejecuta **asíncronamente** vía cola (BullMQ) y un worker dedicado, nunca en el hilo de la petición HTTP. El cliente recibe un `ExportJob` con estado (`queued → processing → done/failed`) y hace polling o recibe un webhook/socket cuando termina.

### 4.5 Gestión de proyectos y workspaces
Guardar/cargar proyectos, carpetas, versiones/revisiones, organizaciones y miembros con roles (B2B: owner/admin/editor/viewer).

### 4.6 Autenticación y organizaciones
Cuentas individuales (B2C) + organizaciones con equipos (B2B), vía Clerk.

### 4.7 Brand Kit (B2B)
Logo, paleta de colores y fuentes de la organización, reutilizables en cualquier diseño del equipo para mantener consistencia de marca.

### 4.8 Admin/backoffice (ligero)
Moderación de assets públicos y gestión del catálogo de plantillas por parte del equipo de Impulso — no es un panel de administración de negocio (sin facturación, sin pedidos).

---

## 5. Flujo del usuario

**B2C:**
Landing → registro (o modo invitado) → elegir plantilla o lienzo en blanco → diseñar (formas/texto/imágenes, tamaño y forma del sticker) → previsualizar con guías de sangrado y línea de corte → exportar (PNG/SVG/PDF) → opcionalmente guardar el proyecto en su cuenta.

**B2B:**
Registro → crear organización → invitar miembros del equipo → biblioteca de plantillas y brand kit compartidos (logo, colores, fuentes) → diseñar usando el brand kit → exportar en lote / archivos listos para imprenta → descargar (el envío a un proveedor de impresión es manual, fuera del sistema por ahora).

**Usuario recurrente:**
Login → dashboard (proyectos propios y de organización) → abrir proyecto existente → seguir editando → duplicar/versionar → exportar de nuevo.

---

## 6. Modelo de datos

Postgres relacional, con JSONB para el documento de diseño (el árbol de capas del canvas es intrínsecamente de forma libre y versionado, no encaja bien en tablas normalizadas).

```
User
  id, email, name, auth_provider_id, created_at

Organization
  id, name, slug, plan, created_at

OrganizationMember
  organization_id, user_id, role  # owner | admin | editor | viewer

Folder
  id, owner_type (user|organization), owner_id, name, parent_folder_id

Project
  id, owner_type (user|organization), owner_id, folder_id,
  name, current_version_id, created_at, updated_at

ProjectVersion
  id, project_id, design_json (JSONB: capas/formas/texto/tamaño de canvas),
  thumbnail_url, created_by, created_at

StickerSpec
  id, project_id, shape (circle|rect|custom), width_mm, height_mm,
  material, die_line_svg, bleed_mm

Asset
  id, owner_type, owner_id, type (image|vector|font),
  url, thumbnail_url, metadata (JSONB: dimensiones, mime), created_at

Template
  id, category, name, thumbnail_url, design_json, is_public, created_by

BrandKit
  id, organization_id, logo_asset_id, colors (JSONB), fonts (JSONB)

ExportJob
  id, project_version_id, format (png|svg|pdf), status (queued|processing|done|failed),
  output_url, requested_by, created_at
```

**Por qué `ProjectVersion` como tabla separada:** permite historial de revisiones persistido entre sesiones (no solo undo/redo en memoria del cliente), autosave seguro sin corromper el estado "actual", y es la base para features futuras como comparar versiones o restaurar una anterior.

---

## 7. Explicación técnica — decisiones clave y su porqué

1. **Vector-first, no raster-first.** Un sticker físico necesita una línea de corte geométricamente exacta. Tratar el canvas como "solo píxeles" y reconstruir el vector al final es frágil; por eso Fabric.js (objetos con representación SVG nativa) y el motor de contorno (§4.2) son de primera clase desde el diseño, no un parche al exportar.

2. **NestJS separado de las API routes de Next.js.** La lógica de organizaciones/roles multi-tenant, versionado de proyectos y orquestación de exports es suficientemente compleja como para beneficiarse de una estructura modular con DI y guards, en vez de acumularse como route handlers sueltos. Adicionalmente, deja el backend listo para ser consumido por otro módulo si la futura Impulso Builder Platform lo necesita, sin acoplarlo al frontend de este módulo.

3. **Cola + worker para exportación, no síncrono.** Renderizar un PDF en CMYK a 300+ DPI con capas separadas puede tardar varios segundos — inaceptable dentro del timeout de una petición HTTP normal, y particularmente incompatible con los límites de ejecución de funciones serverless (Vercel). De ahí que el worker corra en un proceso de larga duración aparte.

4. **Monorepo con `packages/editor-core` aislado**, aunque hoy solo haya un módulo: evita que el motor de canvas quede enterrado dentro de la app de Next.js, de forma que si en el futuro se necesita reutilizar (otro módulo de la plataforma, un modo embebido) no haya que extraerlo bajo presión.

5. **Postgres + JSONB en vez de un documento NoSQL puro:** se necesita integridad relacional fuerte para ownership, organizaciones y permisos (multi-tenant B2B), pero el documento de diseño en sí (capas del canvas) cambia de forma constantemente — JSONB da lo mejor de ambos sin forzar un esquema rígido sobre datos inherentemente flexibles.

6. **Clerk para auth/organizaciones:** dado que B2B requiere equipos con roles desde el día uno, construir eso a mano (invitaciones, roles, sesiones por organización) es trabajo no diferenciador; se prefiere un servicio que ya lo resuelve.

---

## 8. Explícitamente fuera de alcance de este módulo (por ahora)

- Checkout, pagos, carritos de compra.
- Integración con proveedores de impresión / fulfillment.
- Modo embebido / white-label para que terceros lo integren en su propia marca.
- Cualquier otro módulo de "Impulso Builder Platform" — este documento cubre **solo** Sticker Builder.

---

## 9. Siguiente paso

Este documento cierra la **Fase 0 (arquitectura)**. La **Fase 1** no comienza automáticamente — se espera confirmación explícita antes de escribir la primera línea de código.
