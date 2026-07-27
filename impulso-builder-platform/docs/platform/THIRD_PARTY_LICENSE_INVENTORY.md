# Third-Party License Inventory — THÖREN Sticker Builder (Fase 4.2 + Brand Integration)

> Inventario de todo contenido/código de terceros que termina dentro del paquete comercial (`dist/` de `apps/sticker-builder`, empaquetado por `build:commercial`). Fuente de verdad para `legal/LICENCIAS-DE-TERCEROS.md` dentro del ZIP de entrega (ver Commercial Build Guide).

## 1. Assets creativos (fuentes, iconos, imágenes, plantillas)

**Dos tipografías** (agregadas en el hito Brand Integration — THÖREN, actualiza la auditoría "cero fuentes" de Fase 4.2): archivos `.woff2` autoalojados en `apps/sticker-builder/public/fonts/`, servidos por la propia app (sin CDN de terceros, sin llamada de red):

| Archivo | Fuente | Licencia | Origen |
|---|---|---|---|
| `familjen-grotesk.woff2` | Familjen Grotesk | SIL Open Font License 1.1 | Google Fonts |
| `schibsted-grotesk.woff2` | Schibsted Grotesk | SIL Open Font License 1.1 | Google Fonts |

La OFL 1.1 permite el uso, estudio, modificación y redistribución de la fuente agrupada dentro de software comercial, sin costo ni atribución visible obligatoria en la interfaz. Texto completo: [https://openfontlicense.org](https://openfontlicense.org).

Fuera de estas dos fuentes:
- **Iconografía**: el símbolo de marca (Þ) y el resto de la iconografía son SVG inline generados en código (nunca un archivo de icon pack de terceros) — mismo enfoque de Fase 4.2, sin cambios.
- **Templates/proyecto de ejemplo**: `demoProject.ts`/`builtInTemplates.ts`/`projectPresets.ts` construyen `Rectangle`/`Ellipse`/`Text` 100% programáticamente — ningún asset de imagen incluido.

No hay, por lo tanto, ningún riesgo de licencia de contenido de terceros (Creative Fabrica u otro banco de assets) — no se usó ninguno.

## 2. Dependencias de código (runtime, bundleadas en `dist/`)

| Paquete | Versión (ver `pnpm-lock.yaml`) | Licencia | Uso |
|---|---|---|---|
| `zod` | ^3.23.8 | MIT | Validación/tipos en todo el núcleo (Document Schema, Commercial Schema) |
| `konva` | ^9.3.14 | MIT | Único paquete de render (`@impulso/renderer-konva`) |
| `pdf-lib` | ^1.17.1 | MIT | Generación de PDF (`@impulso/print-engine`, encapsulado detrás de `PdfBackend`) |

Las 3 son MIT — permiten redistribución dentro de un producto comercial sin restricciones más allá de conservar el aviso de copyright/licencia (texto incluido en `legal/LICENCIAS-DE-TERCEROS.md`, generado a partir de este inventario).

## 3. Dependencias de desarrollo/build (NO bundleadas, no llegan al comprador)

`vite`, `tsup`, `typescript`, `vitest`, `playwright`, `turbo`, `fake-indexeddb`, `jsdom` y el resto de `devDependencies` de cada paquete — herramientas de construcción/prueba, nunca parte del `dist/` final. No requieren inventario de cara al comprador (no se redistribuyen), se mencionan aquí solo por completitud de la auditoría.

## Cómo se mantiene este documento

Se revisa cada vez que se agrega una dependencia nueva a cualquier `package.json` cuyo paquete termine en el grafo de dependencias de `apps/sticker-builder` — el build comercial (`build:commercial`) no automatiza esta verificación todavía; es responsabilidad manual del release hasta que exista evidencia de que vale la pena automatizarla.
