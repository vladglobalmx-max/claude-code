# @impulso/document-schema

> FOUNDATION 1 de Impulso Builder Platform. El contrato oficial de datos de todo proyecto Impulso. TypeScript puro — cero dependencias de renderizado.

**Estado:** completo. No implementa Engine, Renderer, History Engine, Persistence ni Plugins — eso es explícitamente el alcance de micro-sprints futuros, no de este.

---

## 1. Árbol completo del paquete

```
packages/document-schema/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                          (este documento)
└── src/
    ├── index.ts                       # API pública — único punto de entrada externo
    │
    ├── primitives/                    # Bloques sin ningún conocimiento de dominio
    │   ├── identifiers.ts             # ProjectId/DocumentId/PageId/LayerId/ObjectId/AssetId (branded)
    │   ├── geometry.ts                # Point, Size, Rect, Transform
    │   └── json.ts                    # JsonValue (tipo recursivo JSON-safe)
    │
    ├── common/                        # Reutilizados por Project/Document/Page/Layer/Object
    │   ├── metadata.ts                # Metadata (nombre, tags, role, visible, locked, timestamps)
    │   ├── pluginData.ts              # PluginData (bolsa namespaced por plugin)
    │   └── customProperties.ts        # CustomProperties (bolsa libre del usuario)
    │
    ├── style/
    │   └── style.ts                   # Style (fill, stroke, opacity, blendMode, shadow)
    │
    ├── asset/
    │   └── asset.ts                   # Asset (referencia a imagen/fuente, no el binario)
    │
    ├── object/                        # Los seis tipos universales de Object
    │   ├── base.ts                    # SceneObjectBase (campos comunes a todo Object)
    │   ├── rectangle.ts
    │   ├── ellipse.ts
    │   ├── path.ts                    # PathSegment + PathObject (vector propio, no SVG)
    │   ├── image.ts
    │   ├── text.ts
    │   ├── group.ts                   # re-exporta GroupObject (ver object.ts)
    │   └── object.ts                  # GroupObject + unión discriminada SceneObject
    │
    ├── layer/
    │   └── layer.ts                   # Layer (contenedor ordenado de Objects)
    │
    ├── page/
    │   └── page.ts                    # Page (lienzo con tamaño/unidad propios)
    │
    ├── history/
    │   └── history.ts                 # HistoryEntry / DocumentHistory (dato puro, sin lógica de undo/redo)
    │
    ├── version/
    │   ├── constants.ts               # CURRENT_SCHEMA_VERSION, MINIMUM_SUPPORTED_SCHEMA_VERSION
    │   └── migration.ts               # Migration, MIGRATIONS, runMigrations, UnsupportedSchemaVersionError
    │
    ├── document/
    │   └── document.ts                # Document (la unidad que se versiona/migra)
    │
    ├── project/
    │   └── project.ts                 # Project (la raíz persistida)
    │
    ├── serialization/
    │   ├── core.ts                    # validate/serialize/deserialize/clone GENÉRICOS (cualquier esquema)
    │   ├── documentSerialization.ts    # envoltura de Document con migración
    │   └── projectSerialization.ts     # envoltura de Project con migración
    │
    └── testUtils/
        └── fixtures.ts                 # Document/Project mínimos válidos, usados por varios tests

    (cada *.ts de arriba tiene su *.test.ts junto a él — 17 archivos de test, 80 tests, 100% cobertura)
```

---

## 2. Explicación de la arquitectura

### 2.1 Jerarquía de entidades

```
Project
 └─ Document                  (versionado: schemaVersion, documentVersion)
     └─ Page[]                (un lienzo con tamaño/unidad propios)
         └─ Layer[]           (contenedor ordenado de Objects — como una capa de Photoshop)
             └─ SceneObject[] (Rectangle | Ellipse | Path | Image | Text | Group)
                                Group, a su vez, contiene SceneObject[] — es el único recursivo
```

`Style`, `Asset`, `Metadata`, `PluginData`, `CustomProperties` no son un nivel de esta jerarquía: son **bloques transversales** que Project/Document/Page/Layer/Object comparten (Metadata/PluginData/CustomProperties en los cinco niveles; Style y Asset solo donde aplican).

`History` y `Version` tampoco son "un nivel" — son **el mecanismo de versionado** que envuelve a `Document`: `Document.history` guarda la bitácora, y `runMigrations` (en `version/migration.ts`) es lo que permite que un `Document` guardado con un `schemaVersion` viejo siga siendo válido hoy.

### 2.2 Por qué "un sistema genérico" de Objects

Los seis tipos (`rectangle`, `ellipse`, `path`, `image`, `text`, `group`) son los únicos que este paquete conoce. **No existe un tipo `"sticker"` ni `"die-cut"` en el Document Schema.** Lo específico de un módulo se expresa con `metadata.role` sobre un tipo genérico:

```ts
// La línea de corte de Sticker Builder NO es un tipo nuevo de Object.
// Es un "path" cerrado con un metadato de rol.
{
  type: "path",
  segments: [...],
  closed: true,
  metadata: { role: "die-line", ... },
  pluginData: { "sticker-builder": { bleedMm: 3, material: "vinyl-glossy" } },
}
```

Esto es lo que hace posible que un futuro Planner Builder o Coloring Book Builder reutilicen exactamente el mismo Document Schema sin ramificarlo: cualquier Renderer que sepa dibujar un `path` ya sabe dibujar una línea de corte, sin necesitar código específico de Sticker Builder.

### 2.3 Cómo se garantiza "sin Konva, React, Next, Browser APIs, Canvas, SVG o DOM" — no solo se promete

- **`package.json`**: la única dependencia de runtime es `zod`. No hay React, Konva, ni ninguna librería de UI/render en `dependencies` ni `devDependencies` de producción.
- **`tsconfig.json` → `lib: ["ES2022"]`** (sin `"DOM"`): si algún archivo intentara usar `window`, `document`, `HTMLElement` o `Blob`, el *type-check* falla — no depende de que nadie se acuerde de la regla.
- **`vitest.config.ts` → `environment: "node"`** (no `"jsdom"`): los tests corren sin ningún global de navegador disponible.
- **Los paths vectoriales son un formato propio** (`PathSegment`, un array de `{ type, point... }`), no la mini-gramática de strings "d" de SVG — aunque esa sintaxis es solo texto y no arrastraría un renderer real, el encargo fue explícito en no importar nada que pueda leerse como "SVG".
- **Los Asset son referencias, no binarios**: `AssetSchema` guarda `id`/`mimeType`/`width`/`height`, nunca un `Blob` (que es un tipo del DOM) ni un `ArrayBuffer` de imagen.

### 2.4 SOLID / cohesión / acoplamiento, aplicados concretamente

- **Un solo `Metadata`, no cuatro casi iguales.** Project/Document/Page/Layer/Object comparten el mismo esquema. Alternativa descartada: un `ProjectMetadata`, `LayerMetadata`, etc. — más "específico" pero con 90% de campos duplicados; se prefirió una única fuente de verdad (`visible`/`locked` se ignoran donde no aplican, documentado explícitamente en el código).
- **Cuatro funciones de serialización genéricas (`validateWithSchema`, `serializeWithSchema`, `deserializeWithSchema`, `cloneWithSchema`), no doce bespoke.** Cualquier entidad usa las mismas cuatro funciones + su propio esquema Zod exportado. Document y Project tienen además una envoltura propia porque son las únicas dos entidades cuyo `schemaVersion` requiere migración antes de validar — el resto (Style, Asset, Layer, Page...) no necesita eso.
- **Funciones puras, sin estado oculto.** `runMigrations` no lee un `Date.now()` ni un ID generado internamente; recibe todo lo que necesita como argumento (incluyendo `migrations`/`targetVersion` inyectables), lo cual también es lo que permite testear el pipeline de migración sin mutar constantes reales del paquete.
- **Inmutabilidad:** no hay setters ni métodos de mutación en ninguna entidad. "Cambiar" un documento siempre significa "construir un nuevo objeto" (`{ ...doc, ... }`) — el paquete ni siquiera ofrece la posibilidad de mutar in-place.
- **La única `class` del paquete es `UnsupportedSchemaVersionError`**, porque así es como TypeScript/JavaScript modela errores lanzables (`instanceof`, `stack`) — no una clase de dominio. Todo lo demás son funciones y objetos Zod.

---

## 3. Ejemplos de uso

Los ejemplos "de verdad" viven en `src/examples/basicUsage.test.ts` — son tests ejecutables, no prosa que pueda quedar desactualizada. Construyen un Project completo (fondo, imagen referenciada por asset, y una línea de corte modelada como `path` + `metadata.role`), lo validan, lo serializan/deserializan y lo clonan, usando exclusivamente la API pública (`src/index.ts`).

```ts
import {
  ProjectIdSchema, DocumentIdSchema, PageIdSchema, LayerIdSchema, ObjectIdSchema,
  CURRENT_SCHEMA_VERSION, validateProject, serializeProject, deserializeProject,
} from "@impulso/document-schema";

const project = {
  id: ProjectIdSchema.parse("project_demo"),
  moduleId: "sticker-builder",           // el schema no sabe qué es esto; solo lo transporta
  document: {
    id: DocumentIdSchema.parse("document_demo"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    documentVersion: 1,
    pages: [{
      id: PageIdSchema.parse("page_demo"),
      size: { width: 76, height: 76 },
      unit: "mm",
      layers: [{
        id: LayerIdSchema.parse("layer_demo"),
        objects: [{
          id: ObjectIdSchema.parse("background"),
          type: "rectangle",
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          size: { width: 76, height: 76 },
          cornerRadius: 8,
          style: { fill: "#fef08a", strokeWidth: 0, opacity: 1, blendMode: "normal" },
          metadata: { tags: [], visible: true, locked: false, createdAt: "...", updatedAt: "..." },
          pluginData: {},
          customProperties: {},
        }],
        metadata: { tags: [], visible: true, locked: false, createdAt: "...", updatedAt: "..." },
        pluginData: {},
        customProperties: {},
      }],
      metadata: { tags: [], visible: true, locked: false, createdAt: "...", updatedAt: "..." },
      pluginData: {},
      customProperties: {},
    }],
    metadata: { name: "Sticker circular de logo", tags: [], visible: true, locked: false, createdAt: "...", updatedAt: "..." },
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
  },
  metadata: { name: "Mi primer sticker", tags: [], visible: true, locked: false, createdAt: "...", updatedAt: "..." },
  pluginData: {},
  customProperties: {},
};

validateProject(project);            // lanza si algo no cumple el esquema
const json = serializeProject(project);
const restored = deserializeProject(json); // aplica migraciones si hiciera falta, luego valida
```

## 4. Ejemplos de serialización

Cualquier entidad puede usar las cuatro funciones genéricas de `serialization/core.ts` con su propio esquema:

```ts
import { StyleSchema, validateWithSchema, serializeWithSchema, deserializeWithSchema, cloneWithSchema } from "@impulso/document-schema";

const style = validateWithSchema(StyleSchema, { fill: "#00ff00", opacity: 0.5 });
const json = serializeWithSchema(StyleSchema, style);
const restored = deserializeWithSchema(StyleSchema, json);
const clone = cloneWithSchema(StyleSchema, style); // igual por valor, distinta referencia
```

`Document` y `Project` usan sus propias envolturas (`serializeDocument`/`deserializeDocument`, `serializeProject`/`deserializeProject`) porque además corren el pipeline de migración antes de validar — ver `src/serialization/documentSerialization.test.ts` y `projectSerialization.test.ts` para el round-trip completo.

## 5. Ejemplos de migración

`CURRENT_SCHEMA_VERSION` es `1` hoy — no existe todavía una v2 real, así que `MIGRATIONS` está vacío a propósito (no se inventan migraciones especulativas). El **mecanismo** sí está completo y probado inyectando migraciones falsas en los tests (`version/migration.test.ts`, y el escenario de extremo a extremo en `examples/basicUsage.test.ts`):

```ts
import { runMigrations, type Migration } from "@impulso/document-schema";

// El día que exista una v2 real (ej. Page renombra "size" a "canvasSize"),
// se agrega UN objeto a MIGRATIONS con esta forma:
const v1ToV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  migrate: (raw) => {
    const pages = raw.pages as Array<Record<string, unknown>>;
    return { ...raw, pages: pages.map(({ size, ...rest }) => ({ ...rest, canvasSize: size })) };
  },
};

// deserializeDocument/deserializeProject aplican automáticamente todas las
// migraciones necesarias, en cadena, antes de validar:
const migrated = runMigrations(rawOldDocument, { migrations: [v1ToV2], targetVersion: 2 });
```

Si falta un eslabón de la cadena, o el documento es más viejo que `MINIMUM_SUPPORTED_SCHEMA_VERSION`, `runMigrations` lanza `UnsupportedSchemaVersionError` con un mensaje específico — nunca falla en silencio ni produce un documento a medio migrar.

---

## 6. Riesgos detectados

1. **`z.union` en vez de `z.discriminatedUnion` para `SceneObject`.** Zod no permite que `discriminatedUnion` incluya un miembro envuelto en `z.lazy` (necesario para romper el ciclo de `Group`), así que la unión recursiva usa `z.union`. Efecto práctico: los mensajes de error de Zod al fallar la validación de un Object son algo menos específicos (agregan los errores de los 6 intentos en vez de señalar directo "el discriminante 'triangle' no existe"). No afecta la corrección — todos los tests de rechazo pasan — pero si la ergonomía de errores importa más adelante (ej. mostrarle al usuario final por qué su documento no cargó), vale la pena revisar si versiones más nuevas de Zod (v4) resuelven esta limitación.
2. **`PluginData` es `Record<string, unknown>` sin validar su contenido.** Es intencional (cada plugin valida su propio payload), pero significa que el Document Schema por sí solo no puede detectar que un plugin guardó datos corruptos en su propia sección — ese chequeo tendrá que vivir en el Engine o en el plugin mismo.
3. **No hay un límite de profundidad para `Group` anidado.** Un documento con miles de grupos anidados recursivamente es válido según el esquema, pero podría ser costoso de recorrer para el Engine/Renderer. No se agregó un límite artificial porque no hay evidencia todavía de que sea un problema real (ver "no agregar funcionalidad no solicitada").
4. **`exactOptionalPropertyTypes` no está activado en `tsconfig.base.json`.** Se evaluó activarlo (mayor precisión de tipos para campos opcionales) pero es conocido por generar fricción con Zod en varias combinaciones de `.optional()`/`.default()`. Se dejó fuera para no introducir inestabilidad de tipos sin un beneficio claro todavía.

## 7. Posibles mejoras futuras

*(Ninguna de estas se implementó — están fuera de alcance de este micro-sprint; se listan para que la Engine/History Engine futura las tenga en cuenta.)*

- Un validador de integridad referencial (que todo `assetId` referenciado por un `ImageObject` exista en la lista de Assets del Document) — hoy el schema no lo exige porque estructuralmente cruza dos partes distintas del árbol y el Engine es quien tiene el contexto completo para decidir qué hacer si falta.
- Migrar de Zod v3 a v4 si soluciona la limitación de `discriminatedUnion` + `lazy` (§6.1).
- Un esquema explícito de "patch" para `HistoryEntry.patch` (hoy es `JsonValue` opaco a propósito) una vez la History Engine defina su formato real de undo/redo.
- Helpers de construcción (builders) para las entidades más verbosas (`Metadata`, `SceneObjectBase`) si en la práctica escribir estos objetos a mano en el Engine resulta repetitivo — no se agregaron ahora para no anticipar una necesidad que todavía no se sintió.
