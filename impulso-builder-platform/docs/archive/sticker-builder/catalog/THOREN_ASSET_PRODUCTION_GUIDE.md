> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# THÖREN Asset Production Guide v1.0

**Alcance: exclusivamente documentación de proceso.** Este documento no modifica la arquitectura (`TEMPLATE_LIBRARY_ARCHITECTURE.md`), no modifica el roadmap (`ROADMAP_TEMPLATE_SYSTEM.md`), no modifica ningún archivo de código. Documenta el pipeline oficial que transforma un template ya diseñado (una entrada de `TEMPLATE_BATCH_XX.md`, con sus 12 secciones ya aprobadas) en un producto comercial real, publicable en la Template Library de THÖREN y en canales externos (Gumroad, Marketplace).

Este documento asume como contexto ya aprobado y congelado: `TEMPLATE_LIBRARY_ARCHITECTURE.md` (modelo de datos), `THOREN_DESIGN_LANGUAGE_GUIDE.md` (identidad visual), y la estructura de 12 secciones ya usada en Batch 01-05. No repite esas decisiones — las usa como insumo de entrada del pipeline aquí descrito.

---

## 0. Qué resuelve este documento

Hasta este punto, cada documento de batch (`TEMPLATE_BATCH_01.md` a `TEMPLATE_BATCH_05.md`) responde la pregunta "¿cómo debe verse y comunicarse este template?" — una pregunta de diseño y de producto. Este documento responde una pregunta distinta: **"¿qué pasos concretos, en qué orden, con qué archivos y qué validaciones, convierten esa especificación en un asset real que un usuario puede abrir en THÖREN y un comprador puede adquirir en Gumroad?"** — una pregunta de producción y operación.

La sección 12 (Production Checklist) de cada template ya lista **qué** debe estar listo. Este documento explica **cómo** llegar a que cada casilla de esa checklist pueda marcarse honestamente, y en qué orden hacerlo para no producir trabajo fuera de secuencia (ej. no tiene sentido producir el thumbnail antes de que el SVG final exista).

---

## 1. Las 6 etapas del pipeline

```
Etapa 1          Etapa 2           Etapa 3              Etapa 4            Etapa 5             Etapa 6
Especificación → Producción de   → Ensamblado en      → Validación QA   → Metadata y        → Empaquetado
  aprobada         assets visuales    THÖREN (Project)      (checklist)      catálogo             comercial
```

Cada etapa tiene una entrada, una salida y un dueño de decisión claro. Ninguna etapa empieza sin que la anterior haya producido su salida completa — este documento existe precisamente para prevenir el patrón de "empezar el mockup antes de que el SVG esté aprobado" que generaría retrabajo.

---

## 2. Etapa 1 — Especificación aprobada (entrada del pipeline)

**Entrada**: ninguna — es el punto de partida.
**Salida**: una entrada de `TEMPLATE_BATCH_XX.md` con sus 12 secciones completas y ya aprobadas por el flujo de revisión de lotes ya establecido.
**Dueño de la decisión**: quien aprueba cada batch (el mismo flujo de "esperarás aprobación antes de continuar" ya vigente).

Esta etapa no es parte del trabajo de producción de assets en sí — se documenta aquí solo para dejar explícito que **ningún asset se produce a partir de una sección 1-10 que no esté ya aprobada**. Producir sobre una especificación no aprobada implica el riesgo de rehacer trabajo si el diseño cambia durante revisión.

---

## 3. Etapa 2 — Producción de assets visuales

**Entrada**: secciones 2 (Dirección de Arte), 4 (Elementos), 5 (Assets necesarios) y 8 (Prompt para IA) del template aprobado.
**Salida**: el set de archivos de assets gráficos individuales (SVG vectoriales, texturas) que la sección 5 de cada template ya enumera.
**Dueño de la decisión**: quien produce el asset (diseñador humano o generación asistida por IA seguida de limpieza vectorial humana).

### 3.1 Ruta de producción según el tipo de asset

| Tipo de asset (según §5 de cada template) | Ruta de producción recomendada |
|---|---|
| Ilustración de línea fina / gráfico de alto contraste / pictograma (Niveles 1-4 de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §4.1) | Generar con el prompt de §8 del template → trazar a SVG limpio → verificar contra la regla de nivel de reducción de la familia correspondiente |
| Símbolo normado (Nivel 5 — advertencia, frágil, hazmat) | **Nunca generar por IA desde cero.** Partir de la referencia oficial de la convención (norma de transporte de mercancías peligrosas, símbolo ISO de manejo frágil) y solo vectorizar/limpiar — la sección 10 de esos templates ya advierte que la desviación de convención es el error más grave posible del catálogo |
| Texturas (papel, kraft, tinta de sello, metal cepillado) | Generar con el prompt de §8 → verificar tileable real (sin costuras visibles) → ajustar a la intensidad de opacidad documentada en §2 del template y en `THOREN_DESIGN_LANGUAGE_GUIDE.md` §7 |
| Templates sin assets gráficos (ej. Serum, Spa, Etiqueta Neutral, Bálsamo Labial, Precio y Oferta) | Esta etapa se salta — la sección 5 de esos templates ya declara explícitamente "ninguno" |

### 3.2 Validación de salida de esta etapa

Antes de avanzar a Etapa 3, cada asset debe pasar:
- **Fidelidad al prompt/referencia**: el asset producido corresponde a lo descrito en §8, no a una interpretación libre.
- **Limpieza vectorial**: SVG sin puntos redundantes, curvas suaves, listo para reescalar sin pérdida (crítico porque el mismo asset se usa a 20mm y potencialmente en un mockup mucho mayor).
- **Consistencia de set**: cuando el template requiere un set (frutas de mermelada, íconos de aceite esencial, símbolos de hazmat), todas las piezas del set deben compartir grosor de trazo y nivel de detalle — exactamente la validación que la sección 10 de esos templates ya exige.

**Nomenclatura de archivo de asset** (para evitar ambigüedad al entregar a producción real):
`THOREN-Asset-<IDTemplate>-<TipoAsset>-<Descripcion>.svg` (ej. `THOREN-Asset-1.1-Icono-GranoCafe.svg`, `THOREN-Asset-1.4-Fruta-Fresa.svg`).

---

## 4. Etapa 3 — Ensamblado en THÖREN (Project real)

**Entrada**: los assets de Etapa 2 + las secciones 3 (Layout) y 9 (Exportación) del template.
**Salida**: un `Project` real de THÖREN (el mismo modelo de `document-schema` que ya usa toda la aplicación) con sus `Page`/`Document` configurados exactamente según el layout aprobado, listo para guardarse como contenido de un template del catálogo.

### 4.1 Qué se construye, en términos del sistema real

Un template de catálogo, una vez ensamblado, es exactamente lo mismo que `TemplateContent` ya define en `packages/template-library`: **`{ project: Project, thumbnail?: Blob }`** — no existe un formato de archivo especial para "templates de catálogo" distinto del `Project` que cualquier usuario edita en THÖREN. Esto significa que ensamblar un template de este catálogo es, en la práctica, el mismo flujo que un usuario real sigue al crear un proyecto desde cero y usar "Guardar como plantilla" — con la diferencia de que aquí el punto de partida es la especificación de diseño de 12 secciones, no una idea libre del usuario.

### 4.2 Pasos de ensamblado

1. Configurar la página (`Page`) con el tamaño exacto de §9 (Exportación) y el `STANDARD_BLEED`/`STANDARD_SAFE_AREA` ya definidos en `packages/print-engine/src/profiles.ts` — nunca un tamaño de página aproximado.
2. Insertar los elementos de texto de §4 (Elementos) con la tipografía y jerarquía exactas de §2 (Dirección de Arte) — usando las familias tipográficas reales ya disponibles en el editor.
3. Insertar los assets de Etapa 2 como objetos de imagen/vector, posicionados según la retícula de §3 (Layout).
4. Verificar en el editor mismo (Preflight, ya construido en el motor de impresión) que ningún objeto cruza el área segura — el mismo chequeo real (`checkSafeAreaForPage`) que ya usa la aplicación para cualquier proyecto de usuario, no una revisión visual aproximada.
5. Guardar el `Project` resultante como el contenido base del template.

### 4.3 Validación de salida de esta etapa

- El Preflight real del motor (no una inspección visual) confirma cero invasiones de área segura.
- El tamaño de página coincide exactamente con §9 del template, sin redondeos manuales.
- La jerarquía tipográfica visual coincide con §2 — validación humana, ya que esto no es programáticamente verificable por el motor.

---

## 5. Etapa 4 — Validación QA (Production Checklist)

**Entrada**: el `Project` ensamblado de Etapa 3.
**Salida**: la sección 12 (Production Checklist) del template correspondiente, con las casillas de "Diseño" y "Producción" marcadas honestamente, y el bloque "QA" completo.
**Dueño de la decisión**: revisor de calidad (puede ser la misma persona que ensambló, pero como paso explícito separado, no como parte del mismo impulso de trabajo — la separación de roles reduce el sesgo de "ya lo hice, seguro está bien").

### 5.1 Cómo verificar cada casilla de QA

| Casilla de la checklist (§12) | Cómo se verifica en la práctica |
|---|---|
| Legibilidad | Exportar el `Project` a PNG al tamaño real de impresión (usando el export-engine ya existente) y revisar a distancia de uso real documentada en §10 del template (ej. "a 30cm", "a 1 metro") |
| Contraste | Verificar contraste de color texto/fondo contra la paleta de §2 — especialmente crítico en los templates de familia Técnico Funcional donde el contraste es funcional, no estético |
| Escalabilidad | Confirmar que los SVG de Etapa 2 no pierden nitidez al reescalar (nunca assets rasterizados donde el template pide vectorial) |
| Consistencia con la colección | Comparar contra el checklist de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §10 (las 10 preguntas de consistencia) — no una impresión subjetiva |
| Cumple estándar THÖREN | La prueba de validación específica ya escrita en la sección 10 (Nivel de calidad) de ese template individual — cada template define su propia prueba concreta (ej. "cubrir con la mano el nombre del producto", "imprimir una prueba física a 25mm real") |

### 5.2 Regla de bloqueo

Si cualquier casilla de QA falla, el template **regresa a Etapa 2 o 3** (según cuál sea la causa raíz) — nunca avanza a Etapa 5 con una casilla de QA sin marcar. La Etapa 5 (metadata/catálogo) asume que el contenido ya es correcto; retrasar la detección de un problema de diseño hasta después de catalogado multiplica el costo de corregirlo.

---

## 6. Etapa 5 — Metadata y catálogo

**Entrada**: el `Project` validado de Etapa 4 + las secciones 1 (Concepto), 7 (Thumbnail) y los campos de clasificación ya presentes en `TEMPLATE_CATALOG_v1.md` (Categoría, Forma, Nivel de dificultad, Tags, Público objetivo).
**Salida**: un `TemplateDescriptor` completo y su `thumbnail: Blob`, listos para persistirse en el `TemplateStore` (`packages/template-library`, sobre `storage-kit`).

### 6.1 Mapeo de campos (de la especificación de diseño al modelo de datos real)

| Campo de `TemplateDescriptor` (`TEMPLATE_LIBRARY_ARCHITECTURE.md` §1.3) | De dónde sale |
|---|---|
| `name` | Nombre comercial (§11 del template) o el nombre técnico del catálogo, según dónde se publique (ver §7.2 de este documento) |
| `description` | Descripción corta de `TEMPLATE_CATALOG_v1.md` |
| `tags` | Tags de `TEMPLATE_CATALOG_v1.md` + palabras clave SEO de §11 (subconjunto relevante, no las 15-25 completas — esas viven en el listing comercial, no en el tag interno) |
| `category` (extensión) | Categoría de `TEMPLATE_CATALOG_v1.md` |
| `shape` (extensión) | Forma de `TEMPLATE_CATALOG_v1.md` |
| `difficulty` (extensión) | Nivel de dificultad de `TEMPLATE_CATALOG_v1.md` |
| `targetAudience` (extensión) | Público objetivo de `TEMPLATE_CATALOG_v1.md` |
| `suggestedColors` (extensión) | Colores sugeridos de `TEMPLATE_CATALOG_v1.md` |
| `builtIn` | `false` para todo template de este catálogo comercial (los únicos `builtIn: true` son los 3 templates de fábrica ya existentes — círculo, círculo, rectángulo) |

### 6.2 Producción del thumbnail real

El thumbnail no es una captura de pantalla improvisada — se produce con el mismo render headless que ya usa `export-engine` para generar PNG (`renderer-konva`, función de render sin interfaz), aplicado al `Project` de la Etapa 3, siguiendo el encuadre y fondo sólido descritos en §7 (Thumbnail) del template.

**Nomenclatura de archivo de thumbnail**: `THOREN-Thumb-<IDTemplate>-<NombreCorto>.png` (ej. `THOREN-Thumb-1.1-CafeOrigenUnico.png`), resolución mínima 400×400px para que se vea nítido en cualquier densidad de pantalla de la grilla de la Template Library.

### 6.3 Producción del mockup comercial

El mockup (§6 de cada template) es un artefacto **distinto** del thumbnail — vive en el material de marketing/Gumroad, no en el `TemplateDescriptor` interno de la aplicación. Se produce por fotografía real o render 3D siguiendo exactamente la dirección de luz/ángulo/props ya documentada en §6 del template y en `THOREN_DESIGN_LANGUAGE_GUIDE.md` §6 (convención por familia de lenguaje visual).

**Nomenclatura de archivo de mockup**: `THOREN-Mockup-<IDTemplate>-<NombreCorto>-<Numero>.jpg` (ej. `THOREN-Mockup-1.1-CafeOrigenUnico-01.jpg`), resolución mínima 2000px en el lado mayor (uso en landing page y Gumroad a alta resolución).

---

## 7. Etapa 6 — Empaquetado comercial

**Entrada**: el `TemplateDescriptor` + thumbnail de Etapa 5, el mockup de §6.3, y la sección 11 (Commercial Sheet) del template.
**Salida**: el template publicado internamente en la Template Library de THÖREN, y/o el listing externo en Gumroad/Marketplace, según el canal de destino.

### 7.1 Dos destinos posibles, mismo contenido base

Todo template de este catálogo tiene, en principio, dos destinos de publicación posibles (no mutuamente excluyentes):

1. **Template Library interna de THÖREN**: el `TemplateDescriptor` se persiste en el `TemplateStore` y aparece en la galería de "Nuevo proyecto" de cualquier usuario con acceso al catálogo v1.1 (ver `ROADMAP_TEMPLATE_SYSTEM.md`).
2. **Listing comercial externo** (Gumroad, o el futuro Marketplace de v2.0 condicionado a evidencia — ver `ROADMAP_TEMPLATE_SYSTEM.md`): usa directamente el contenido de la sección 11 (Commercial Sheet) como copy, sin reescritura — Elevator Pitch como descripción corta, Beneficio principal + Ideal para como cuerpo de la página, Palabras clave SEO como metadata de búsqueda, Call to Action como cierre.

### 7.2 Checklist de empaquetado (mapea 1:1 con el bloque "Comercial" de §12 de cada template)

| Casilla de §12 | Qué significa completarla en la práctica |
|---|---|
| Gumroad | Listing creado usando el Commercial Sheet como copy, con el mockup de Etapa 5.3 como imagen principal |
| Marketplace | `CommercialProduct` con `productType: "template-pack"` configurado (reutilizando el modelo ya existente en `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`) — aplica solo si/cuando el Marketplace de v2.0 esté autorizado a construirse |
| Landing Page | Sección o entrada correspondiente en el material de marketing de THÖREN, usando el mockup + Elevator Pitch |
| SEO | Palabras clave de §11 incorporadas al metadata de la página/listing correspondiente |
| Social Media | Al menos 1 pieza de contenido (mockup + Call to Action) preparada para publicación en redes |

### 7.3 Regla de versión y trazabilidad

Cada template publicado registra, como mínimo: la versión del template (`v1.0` para todo el catálogo actual), la fecha de "Production Status: Concept Design Completed" → fecha real de publicación (el lapso entre ambas es información operativa útil), y el ID de catálogo (`1.1`, `2.3`, etc.) como referencia estable entre este pipeline, `TEMPLATE_CATALOG_v1.md` y el `TemplateDescriptor.id` real.

---

## 8. Estructura de carpetas de entrega

Siguiendo el mismo criterio ya usado en `FASE5_TECHNICAL_DELIVERY_SPEC_v1.0.md` para la entrega de recursos de video (una convención de carpetas ya validada en este proyecto), la producción de assets de catálogo usa esta estructura:

```
thoren-template-production/
  01-Assets-Vectoriales/
    THOREN-Asset-1.1-Icono-GranoCafe.svg
    THOREN-Asset-1.4-Fruta-Fresa.svg
    ...
  02-Texturas/
    THOREN-Textura-1.1-GranoPapel.png
    ...
  03-Proyectos/
    THOREN-Project-1.1-CafeOrigenUnico.json
    ...
  04-Thumbnails/
    THOREN-Thumb-1.1-CafeOrigenUnico.png
    ...
  05-Mockups/
    THOREN-Mockup-1.1-CafeOrigenUnico-01.jpg
    ...
  06-QA/
    THOREN-QA-1.1-Checklist.md   (copia de la sección 12 del template, con casillas marcadas y fecha)
```

Esta estructura existe para que, cuando la producción real de los 63 templates comience, no haya ambigüedad sobre dónde vive cada archivo — el mismo principio que ya guió la especificación técnica de entrega de Fase 5.

---

## 9. Roles y hand-off

| Rol | Responsable de | Entrega a |
|---|---|---|
| Diseño (Etapa 1) | Aprobar la especificación de 12 secciones | Producción de assets |
| Producción de assets (Etapa 2) | Generar/limpiar SVG y texturas fieles al prompt y a la familia de lenguaje visual | Ensamblado |
| Ensamblado (Etapa 3) | Construir el `Project` real en THÖREN, correr Preflight | QA |
| QA (Etapa 4) | Verificar checklist de calidad, bloquear si falla | Metadata/Catálogo (o devolver a Ensamblado/Producción) |
| Catálogo (Etapa 5) | Poblar `TemplateDescriptor`, producir thumbnail real | Empaquetado comercial |
| Comercial (Etapa 6) | Publicar en canales usando el Commercial Sheet como copy fuente | — (fin del pipeline) |

Estos roles pueden recaer en la misma persona en un equipo pequeño — el documento separa las etapas por **tipo de decisión**, no necesariamente por persona distinta; lo importante es que cada etapa se ejecute como un paso consciente y verificable, no como continuidad automática de la anterior.

---

## 10. Gobernanza del documento

- Este documento describe un proceso — se actualiza cuando el proceso real cambia (ej. si `export-engine` agrega un nuevo formato de salida, o si se agrega un canal comercial nuevo), no en cada lote de templates producidos.
- No reemplaza ni contradice `TEMPLATE_LIBRARY_ARCHITECTURE.md` (arquitectura de datos), `THOREN_DESIGN_LANGUAGE_GUIDE.md` (identidad visual, congelado) ni `ROADMAP_TEMPLATE_SYSTEM.md` (cuándo se construye cada cosa) — es el documento operativo que conecta la especificación de diseño (batches) con el sistema de datos real (`template-library`) y con la publicación comercial.
- No es una autorización de producción real. Igual que el resto del trabajo de Epic 9, este documento es especificación de proceso — ningún asset fue producido, ningún archivo de código fue tocado.
