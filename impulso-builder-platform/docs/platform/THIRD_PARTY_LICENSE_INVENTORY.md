# Third-Party License Inventory — Impulso Sticker Builder (Fase 4.2)

> Inventario de todo contenido/código de terceros que termina dentro del paquete comercial (`dist/` de `apps/sticker-builder`, empaquetado por `build:commercial`). Fuente de verdad para `legal/LICENCIAS-DE-TERCEROS.md` dentro del ZIP de entrega (ver Commercial Build Guide).

## 1. Assets creativos (fuentes, iconos, imágenes, plantillas)

**Ninguno.** Auditoría exhaustiva (Fase 4.2, sección 10): cero archivos `.ttf`/`.otf`/`.woff*`/`.png`/`.jpg`/`.svg` en todo el monorepo fuera de `node_modules`/`dist`/`coverage`. La interfaz usa:
- **Tipografía**: `font-family: system-ui, sans-serif` (la fuente del sistema operativo del usuario, nunca un archivo redistribuido).
- **Iconografía**: emoji Unicode nativos (ej. ✏️ en Capas) y SVG inline generados en código (nunca un archivo de icon pack de terceros).
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
