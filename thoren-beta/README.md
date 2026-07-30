# THÖREN — Beta de experiencia

Beta funcional del prototipo navegable de THÖREN 2.0 (Concepto E), lista para compartir con Vladimir y con al menos un usuario externo. Es exactamente la misma experiencia validada en el prototipo — el mismo ritmo, las mismas pausas, transiciones, revelación, silencios y microinteracciones — empaquetada como una aplicación real, instalable con un solo comando y desplegable en Vercel.

No introduce funciones nuevas, no cambia el flujo ni la filosofía. Deriva directamente de `THOREN_EXPERIENCE_BLUEPRINT.md` y `THOREN_INTERACTION_SYSTEM.md` (en `impulso-builder-platform/docs/product/`).

## Requisitos

- Node.js 18 o superior (probado con Node 22).
- npm (incluido con Node).

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

**Ninguna.** Esta beta no tiene backend, no llama a ninguna API externa y no usa claves de ningún tipo — todo el contenido es estático/simulado en el navegador, tal como pidió el plan de validación (sin motores reales, sin IA real).

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

## Estructura del proyecto

```
thoren-beta/
├── index.html          # documento único, con las 6 pantallas de la experiencia
├── src/
│   ├── main.js          # toda la lógica de estado, ritmo y transiciones
│   └── style.css        # todos los estilos, tokens de marca, modo claro/oscuro
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── vite.config.js       # inyecta versión y fecha de build para el panel ?beta=true
└── vercel.json          # configuración explícita de build para Vercel
```
