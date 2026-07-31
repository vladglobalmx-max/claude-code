# THÖREN — Beta de experiencia

Beta funcional del prototipo navegable de THÖREN 2.0 (Concepto E), lista para compartir con Vladimir y con al menos un usuario externo. Es exactamente la misma experiencia validada en el prototipo — el mismo ritmo, las mismas pausas, transiciones, revelación, silencios y microinteracciones — empaquetada como una aplicación real, instalable con un solo comando y desplegable en Vercel.

No introduce funciones nuevas, no cambia el flujo ni la filosofía. Deriva directamente de `THOREN_EXPERIENCE_BLUEPRINT.md` y `THOREN_INTERACTION_SYSTEM.md` (en `impulso-builder-platform/docs/product/`).

**Desde Fase 3 (Experience Integration, ver `CHANGELOG_FASE3.md`), ninguna propuesta es estática.** Cada propuesta que ves proviene del Motor Creativo real (`@impulso/creative-engine`, aprobado en Fase 1/Fase 2) — la experiencia es la misma, pero el contenido detrás ya es genuino.

## Requisitos

- Node.js 18 o superior (probado con Node 22).
- npm (incluido con Node).
- **El repositorio completo clonado**, no solo esta carpeta: `thoren-beta` consume el código fuente real de `@impulso/creative-engine` desde `../impulso-builder-platform/packages/` (directorio hermano en el mismo repositorio) vía un alias de Vite — ver "Cómo vive el Motor Creativo detrás de esta Beta" más abajo.

## 1. Ejecutar en local

```bash
npm install
npm run dev
```

Esto abre un servidor local en **http://localhost:5173** (Vite lo confirma en la terminal — si el puerto está ocupado, usa el que Vite indique). Abre esa URL en el navegador para vivir la experiencia completa.

## 2. Build de producción (opcional, para probar antes de desplegar)

```bash
npm run build
npm run preview
```

`npm run preview` sirve la build ya optimizada, normalmente en **http://localhost:4173**.

## 3. Publicar en Vercel

**Opción A — desde el dashboard de Vercel:**
1. "Add New… → Project" y selecciona este repositorio/carpeta (`thoren-beta`).
2. Vercel detecta automáticamente el framework "Vite" (hay un `vercel.json` que lo fija explícitamente, por si el autodetect fallara).
3. Build Command: `npm run build` — Output Directory: `dist` (ya configurado en `vercel.json`, no hace falta tocarlo).
4. Deploy.

**Opción B — desde la CLI de Vercel:**
```bash
npm i -g vercel   # si no la tienes instalada
cd thoren-beta
vercel            # sigue las preguntas (primera vez)
vercel --prod     # despliegue de producción
```

### Variables de entorno

**Ninguna.** Esta beta no tiene backend, no llama a ninguna API externa y no usa claves de ningún tipo — el Motor Creativo real corre íntegramente en el navegador de la persona (nunca en un servidor), sin IA generativa (es determinista, ver Fase 2).

## Cómo vive el Motor Creativo detrás de esta Beta

`vite.config.js` resuelve `@impulso/creative-engine` y `@impulso/document-schema` directamente contra el código fuente TypeScript de `impulso-builder-platform/packages/` (viven como carpetas hermanas dentro de este mismo repositorio) — Vite lo transpila igual que cualquier otro módulo, sin build intermedio ni copia manual. `@impulso/export-engine` se resuelve contra un shim propio en `src/vendor/` que reexporta únicamente `buildSvgDocument` (el camino SVG, independiente de Konva) desde su archivo real, para no arrastrar `@impulso/renderer-konva`/Konva al bundle del navegador. `node:crypto` (que `creative-engine` usa en Node/Vitest) se resuelve, solo en el navegador, contra un shim que llama a `crypto.randomUUID()` nativo. Ninguno de los tres paquetes del monorepo se modifica — ver `CHANGELOG_FASE3.md` para el detalle completo y su justificación.

## 4. Modo beta (`?beta=true`)

El enlace normal que le compartes a Vladimir o a un usuario externo (la URL de producción, sin nada después) muestra **exactamente** la experiencia diseñada — sin ningún elemento adicional visible.

Agregar `?beta=true` a la URL (por ejemplo, `https://tu-deploy.vercel.app/?beta=true`) revela, de forma discreta y sin alterar la experiencia principal:

- Un panel pequeño en la esquina superior derecha con: número de versión, fecha de compilación, y tiempo transcurrido (se actualiza cada segundo).
- Un botón **"Beta Reset"** en la esquina inferior derecha — solo reinicia la experiencia a la pantalla inicial, para volver a probarla con otro participante sin recargar la página.

Ninguno de los dos existe en el DOM de forma visible sin el parámetro — quien use el enlace normal jamás los ve.

## 5. Checklist de despliegue

- [ ] `npm install` sin errores.
- [ ] `npm run build` genera `dist/` sin advertencias nuevas.
- [ ] `npm run preview` recorrido completo manual: conversación inicial → propuestas → selección → revelación → obtener (descarga un `.svg` real) → confirmación → pregunta de impresión.
- [ ] Probado en al menos: un navegador de escritorio, un iPhone real o simulado, un Android real o simulado, y una tablet (o el modo responsive del navegador en esos anchos).
- [ ] `https://tu-deploy.vercel.app/` (sin parámetros) — no muestra panel de beta ni botón de reset.
- [ ] `https://tu-deploy.vercel.app/?beta=true` — sí muestra ambos, y "Beta Reset" reinicia correctamente.
- [ ] Lighthouse (Performance / Accessibility / Best Practices / SEO) corrido contra la URL desplegada — objetivo >95 / >95 / >95 / >90 (en local, antes de desplegar, se midió 100/100/100/100 en desktop y mobile).
- [ ] El enlace de producción probado enviándolo a un dispositivo distinto al que lo generó.

## Nota sobre auditoría de dependencias

`npm audit` reporta una vulnerabilidad conocida de Vite/esbuild (`GHSA-67mh-4wv8-2f99`) que afecta **únicamente al servidor de desarrollo local** (`npm run dev`), no a la build de producción que se despliega en Vercel. No se forzó la actualización a la versión mayor siguiente de Vite para no arriesgar cambios de comportamiento fuera del alcance de esta beta (ver regla de `THOREN_USABILITY_TEST_PLAN.md`: nada se modifica sin evidencia que lo justifique).

## Pruebas

```bash
npm run test           # suite completa (vitest)
npm run test:coverage  # con cobertura
```

`engine.js` y `telemetry.js` están cubiertos al 100% por pruebas que llaman al Motor Creativo **real** (no simulado) — ver `src/engine.test.js`. `main.js` (la orquestación del DOM) se verifica mediante un recorrido real en Chromium (Playwright), documentado en `CHANGELOG_FASE3.md`, no con pruebas unitarias — es la estrategia correcta para lógica de interacción, no una omisión.

## Estructura del proyecto

```
thoren-beta/
├── index.html          # documento único, con las 6 pantallas de la experiencia
├── src/
│   ├── main.js              # orquestación del DOM: pantallas, ritmo, transiciones
│   ├── engine.js            # adaptador del Motor Creativo real + instrumentación
│   ├── telemetry.js         # eventos/tiempos internos, silenciosos salvo ?beta=true
│   ├── engine.test.js        # pruebas de integración contra @impulso/creative-engine real
│   ├── telemetry.test.js
│   ├── vendor/
│   │   ├── exportEngineSvgOnly.js  # shim: solo buildSvgDocument, sin Konva
│   │   └── nodeCryptoShim.js       # shim: node:crypto -> crypto.randomUUID() del navegador
│   └── style.css        # todos los estilos, tokens de marca, modo claro/oscuro
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── vite.config.js       # alias al Motor Creativo real + versión/fecha de build + vitest
├── vercel.json          # configuración explícita de build para Vercel
└── CHANGELOG_FASE3.md   # qué cambió y qué no cambió en la integración
```
