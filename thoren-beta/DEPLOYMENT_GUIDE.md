# THÖREN Beta — Guía de despliegue

**Naturaleza de este documento:** guía operativa para instalar, ejecutar, desplegar y mantener `thoren-beta` como una aplicación web pública e independiente, sin ninguna dependencia de Claude, de un Artifact, ni de ningún otro repositorio. Objetivo: cualquier persona puede abrir THÖREN desde un navegador con solo un enlace.

---

## 1. Instalación

Requisitos: Node.js 18+ (probado con Node 22) y npm.

```bash
git clone <url-de-este-repositorio>
cd thoren-beta        # o la ruta donde viva esta carpeta si el repo es más grande
npm install
```

Eso es todo. No hace falta ninguna otra carpeta, paquete, ni acceso a otro repositorio — `thoren-beta` incluye su propia copia vendorizada del Motor Creativo (`src/vendor/engine/`, ver §6).

## 2. Ejecutar en local

```bash
npm run dev
```

Abre `http://localhost:5173` (Vite confirma el puerto real en la terminal). La experiencia completa funciona ahí mismo, sin build.

## 3. Probar el build de producción antes de desplegar

```bash
npm run build      # genera dist/
npm run preview    # sirve esa build optimizada, normalmente en http://localhost:4173
```

Verificar en `npm run preview`, con un recorrido manual real: conversación inicial → tres propuestas → selección → revelación → "Obtener" (descarga un `.svg` real) → confirmación → pregunta de impresión. Repetir la URL con `?beta=true` y confirmar que aparece el panel de telemetría y el botón "Beta Reset" (ver §7).

## 4. Desplegar en Vercel

### Opción A — desde el dashboard de Vercel (recomendada)

1. Sube este repositorio a GitHub (o el proveedor git que uses) si todavía no está ahí.
2. En Vercel: **Add New… → Project**, selecciona el repositorio.
3. Si `thoren-beta` vive dentro de un repositorio más grande (monorepo), fija **Root Directory** = `thoren-beta` en la configuración del proyecto.
4. Vercel detecta el framework "Vite" automáticamente (`vercel.json`, incluido en este repositorio, ya lo fija explícitamente por si el autodetect fallara: `buildCommand: npm run build`, `outputDirectory: dist`).
5. **Deploy.** Vercel entrega un dominio gratuito del tipo `https://thoren-beta.vercel.app` — ese es el enlace que se puede compartir de inmediato.

### Opción B — desde la CLI de Vercel

```bash
npm i -g vercel     # si no la tienes instalada
cd thoren-beta
vercel              # primera vez: responde las preguntas (nombre de proyecto, etc.)
vercel --prod       # despliegue de producción
```

### Variables de entorno

**Ninguna.** Esta Beta no tiene backend, no llama a ninguna API externa y no usa claves de ningún tipo — el Motor Creativo corre íntegramente en el navegador de la persona, de forma determinista (sin IA generativa).

## 5. Actualizar futuras versiones

Cada `git push` a la rama conectada en Vercel dispara un nuevo deploy automáticamente (comportamiento por defecto de Vercel, no requiere configuración adicional). Para una actualización manual puntual:

```bash
git pull
npm install   # solo si package.json cambió
npm run build # verificación local antes de confiar en el deploy remoto
git push
```

Vercel mantiene el historial de deploys anteriores — cualquier deploy previo puede promoverse de vuelta a producción desde el dashboard ("Instant Rollback") si una actualización introduce un problema.

## 6. Mantener sincronizada la copia vendorizada del Motor Creativo

`src/vendor/engine/` es una **copia congelada** del código fuente del Motor Creativo (paquetes `@impulso/document-schema`, `@impulso/creative-engine` y la porción SVG de `@impulso/export-engine`) tomada al migrar esta Beta fuera del monorepo de desarrollo. Es intencional: hace que `thoren-beta` no dependa de ningún otro repositorio.

**Consecuencia a tener presente:** si en el futuro se autoriza una fase de expansión del Motor Creativo (nuevas recetas, ocasiones, arquetipos — ver `THOREN_PRODUCT_BACKLOG_V2.md` §5-6 del proyecto THÖREN, todavía no autorizada), esa copia vendorizada **no se actualiza sola**. Actualizarla es un paso manual: copiar de nuevo los archivos fuente relevantes sobre `src/vendor/engine/` y volver a correr `npm run build`/`npm run test` para confirmar que nada se rompió. Esto no bloquea nada hoy — la Beta actual está congelada funcionalmente y no se le agregan capacidades — pero es el costo de mantenimiento real de haber optado por independencia total en vez de una dependencia cruzada de repositorios.

## 7. Modo beta (`?beta=true`)

El enlace normal (sin nada después de la URL) muestra exactamente la experiencia diseñada, sin ningún elemento adicional visible. Agregar `?beta=true` revela, sin alterar la experiencia principal:

- Un panel en la esquina superior derecha con versión, fecha de build y tiempo transcurrido.
- Un botón "Beta Reset" para reiniciar la experiencia sin recargar la página — útil para probar con varios participantes seguidos.

Ninguno de los dos aparece en el enlace público que se comparte para pruebas reales.

## 8. Cambiar de dominio / configurar `beta.thoren.ai`

1. En el proyecto de Vercel: **Settings → Domains → Add**.
2. Escribe `beta.thoren.ai` y confirma.
3. Vercel muestra el registro DNS exacto a crear (normalmente un `CNAME` apuntando a `cname.vercel-dns.com`, o un registro `A` si prefieres apuntar el subdominio directamente). El valor exacto lo genera Vercel en el momento — copiarlo tal cual aparece en el dashboard, no adivinarlo.
4. En el proveedor DNS donde esté gestionado el dominio `thoren.ai`, crear ese registro para el subdominio `beta`.
5. Esperar la propagación DNS (minutos a un par de horas, según el proveedor) — Vercel marca el dominio como "Valid Configuration" automáticamente en cuanto lo detecta, y emite el certificado HTTPS solo.
6. A partir de ahí, `https://beta.thoren.ai` y `https://thoren-beta.vercel.app` sirven exactamente el mismo deploy — no hace falta elegir uno u otro, ambos funcionan en paralelo salvo que se retire explícitamente el dominio `.vercel.app` desde el mismo panel.

## 9. Checklist de verificación tras cualquier deploy

- [ ] `npm install` sin errores, desde una copia limpia del repositorio.
- [ ] `npm run build` genera `dist/` sin advertencias nuevas.
- [ ] `npm run preview` (o la URL real ya desplegada): recorrido completo manual de punta a punta, incluida una descarga real de `.svg`.
- [ ] Probado en al menos: un navegador de escritorio, un iPhone real o simulado, un Android real o simulado.
- [ ] La URL pública, sin parámetros, no muestra panel de beta ni botón de reset.
- [ ] La misma URL con `?beta=true` sí los muestra, y "Beta Reset" reinicia correctamente.
- [ ] El enlace de producción probado enviándolo a un dispositivo distinto al que lo generó — la prueba real de "cualquier persona con el enlace, sin cuenta de ningún tipo".
