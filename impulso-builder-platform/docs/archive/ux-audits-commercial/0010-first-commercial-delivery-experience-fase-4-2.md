> **Auditoría archivada (Consolidación documental THÖREN, 2026-07-31).** Auditoría de la experiencia de compra/entrega comercial de Sticker Builder como producto independiente — ya no se vende de forma independiente tras `../../product/THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegra como registro histórico. Ver [`../README.md`](../README.md) para el índice vigente de auditorías UX.

# UX Audit 0010 — First Commercial Delivery Experience (Fase 4.2)

> Auditoría de cierre de Fase 4.2, mismo proceso que 0001-0009. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance, distinto a las auditorías anteriores:** no es el editor en sí (ya auditado exhaustivamente en 0001-0009) — es la experiencia de un **comprador real, no técnico**, desde que descarga el `.zip` de Gumroad hasta que tiene su primer proyecto guardado. Evaluado sobre el paquete real producido por `pnpm build:commercial` (`impulso-sticker-builder-v1.0.0.zip`), no sobre `vite dev`/`vite preview`.

---

## 1. El recorrido completo, paso a paso

1. Descomprimir el `.zip` → ve `LEEME-PRIMERO.md`, dos launchers, y las carpetas `docs/`/`legal/` en la raíz, sin ruido de archivos de desarrollo.
2. Abrir `LEEME-PRIMERO.md` → lista clara y corta de qué leer y en qué orden, con el launcher correcto destacado según su sistema.
3. Doble clic en el launcher → una ventana de terminal se abre (visible, no oculta) y el navegador abre `http://localhost:4173/` automáticamente.
4. Primera pantalla: la bienvenida (`welcomeDialog.ts`) — título con el nombre real del producto y versión, 3 líneas de "para qué sirve esto y cómo empezar", email de soporte, un solo botón "Comenzar".
5. Cierra la bienvenida → llega a "Mis proyectos" (vacío), ve "Estado comercial" al pie: `Impulso Sticker Builder Professional · Versión 1.0.0 · Edición comercial (pago único) · Distribuido mediante gumroad`.
6. Crea un proyecto nuevo, diseña algo, ve "Guardando…" → "Guardado" sin acción explícita.
7. Exporta (rápido o para impresión) — ambos caminos ya auditados en 0001-0009, sin cambios de comportamiento en esta fase.

## 2. Lo que funciona bien

- **Cero fricción antes de "puedo empezar a diseñar"** — sin registro, sin login, sin pantalla de licencia que aceptar de forma bloqueante (el EULA vive en `legal/`, disponible pero no interpuesto como un muro de clics antes de usar la app — decisión deliberada, consistente con "no basta con crear arquitectura, tiene que ser real y usable").
- **La bienvenida es honesta sobre lo que es "comprado"** — nunca dice "licencia activada" ni implica una verificación que no existe; dice exactamente "edición comercial (pago único)", que es la verdad completa de `licensingMode: "delivery-only"`.
- **El "Estado comercial" es descubrible pero no invasivo** — un texto pequeño al pie de "Mis proyectos", no un banner ni un modal recurrente. Un comprador que nunca lo lee no pierde nada; uno que lo busca ("¿esto es la versión que compré?") lo encuentra de inmediato.
- **El launcher deja visible la ventana de terminal en vez de ocultarla** — podría parecer "menos pulido" que una app de escritorio nativa, pero es la decisión honesta correcta: un comprador que la cierra por error entiende inmediatamente por qué la app dejó de responder (la ventana sigue ahí, con su mensaje), en vez de preguntarse qué proceso invisible se rompió.
- **Backup/restauración da una salida de emergencia real** — un comprador que se pone nervioso por "¿y si pierdo todo esto?" tiene una respuesta concreta y ya funcional (`Exportar respaldo`), no una promesa a futuro.

## 3. Bug real encontrado y corregido durante esta auditoría (no una fricción — un bloqueo total)

Al ejecutar el paso 3 del recorrido (doble clic en el launcher real, contra el `.zip` real producido por `build:commercial`, no contra una carpeta servida manualmente) el launcher fallaba de inmediato: buscaba una subcarpeta `app/` que nunca existió en el paquete real (el script de empaquetado siempre copió `index.html`/`assets/` a la raíz, junto a los launchers). Ninguna verificación anterior de esta fase lo había detectado porque todas habían servido la carpeta del paquete manualmente con `python3 -m http.server`, nunca ejecutando el `.command`/`.bat` real. Corregido en ambos launchers (sirven ahora su propio directorio) y re-verificado con el launcher real + Chromium real: carga sin errores, servidor se apaga limpio al cerrar. Ver CHANGELOG para el detalle técnico. Este es exactamente el tipo de hallazgo que esta auditoría existe para atrapar — un recorrido de UX real encontró un bug que una verificación puramente técnica (servir la carpeta a mano) no podía revelar.

## 4. Fricciones reales encontradas (honestas, no inventadas para parecer exhaustivos)

- **La dependencia de Python en Windows es una fricción real de primer contacto** para quien no lo tiene instalado — el mensaje de error es claro y accionable (link a python.org), pero sigue siendo un paso extra antes de la primera ejecución exitosa, en una categoría de compradores (diseñadores, no desarrolladores) donde "instalar Python" no es un concepto familiar. Documentado honestamente como limitación en `06-requisitos-y-limitaciones.md`, no oculto — pero sigue siendo fricción real, no resuelta.
- **La advertencia de macOS ("desarrollador no identificado")** en el primer doble clic del `.command` es un momento de duda genuina para un comprador no técnico — "¿es esto seguro?" — mitigado por instrucciones explícitas en `05-problemas-frecuentes-y-soporte.md`, pero el momento de fricción en sí (el diálogo del sistema operativo) no se puede eliminar sin firma de código (fuera de alcance de V1, ver Technical Debt).
- **Ningún indicador visual conecta la ventana de terminal con "esto es normal, no un error"** en el primer instante en que aparece — la documentación lo explica DESPUÉS (el comprador ya la vio antes de leer nada). Un comentario impreso por el propio launcher en la terminal ("Impulso está corriendo — no cierres esta ventana") mitigaría esto sin requerir que el comprador ya sepa buscar la documentación primero.

## 5. Quick Wins (menos de 30 minutos cada uno)

1. Que los launchers impriman un mensaje amigable en la terminal antes de abrir el navegador (ej. "Impulso Sticker Builder está corriendo en http://localhost:4173 — no cierres esta ventana mientras lo uses"), en vez de solo el output crudo de `python -m http.server`.
2. Enlazar `05-problemas-frecuentes-y-soporte.md` (la sección de macOS) directamente desde un comentario en el propio `.command`, para quien lo abra en un editor de texto por curiosidad/desconfianza antes de ejecutarlo.

## 6. Cambios medianos (para una fase futura, no bloqueantes para V1)

- Un instalador nativo que no dependa de Python del sistema (Electron/Tauri o equivalente) eliminaría de raíz la fricción de Windows — evaluado y diferido explícitamente (ver Technical Debt), no es una omisión.
- Firma de código de ambos launchers, si el volumen de ventas lo justifica.

## 7. Fuera de alcance de esta auditoría (evaluado ya, o correctamente diferido)

- La experiencia del editor en sí (creación, edición, exportación) — ya cubierta exhaustivamente por 0001-0009, sin cambios de comportamiento en Fase 4.2.
- Checkout/pago en Gumroad — Fase 4.2 no publica ni construye esa superficie (ver `GUMROAD_LAUNCH_PLAN.md` para el copy/checklist, listo pero sin ejecutar).
- Onboarding para una edición "standard" recortada — no existe todavía (V1 es una sola edición, `"professional"`).

---

**Conclusión honesta:** la primera experiencia de un comprador es funcional, honesta y sin fricción en el editor mismo. Las dos fricciones reales identificadas (Python en Windows, advertencia de macOS) son limitaciones de plataforma ya documentadas, no defectos ocultos ni sorpresas — un comprador que lea `LEEME-PRIMERO.md` primero llega al editor sin sorpresas negativas.
