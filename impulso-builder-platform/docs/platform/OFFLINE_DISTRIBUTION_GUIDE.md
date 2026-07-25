# Offline Distribution Guide — Impulso Sticker Builder (Fase 4.2)

Documento técnico. Referencia interna del equipo — para la guía dirigida al comprador ver `apps/sticker-builder/commercial-assets/docs/01-como-empezar.md` y `06-requisitos-y-limitaciones.md`.

## Por qué el paquete no es "solo abrir index.html"

Se verificó empíricamente (no por inferencia) que abrir `dist/index.html` directamente con doble clic (`file://`) falla en Chromium: el navegador bloquea por política CORS la carga de módulos ES (`<script type="module">`) cuando el documento se sirve desde `file://` — es una restricción de seguridad del navegador, no un bug de la aplicación. Además, el build de Vite por defecto usa rutas absolutas (`base: "/"`) para los assets, que también rompen bajo `file://` porque no hay origen real que las resuelva.

Ambos problemas desaparecen si la app se sirve mediante un servidor HTTP real, aunque sea local y efímero.

## La solución: launcher + servidor HTTP local en el puerto fijo 4173

Cada paquete comercial incluye dos launchers en su raíz (ver `commercial-assets/launchers/`):
- `ABRIR-IMPULSO-WINDOWS.bat`
- `ABRIR-IMPULSO-MAC-LINUX.command`

Ambos hacen lo mismo: levantan un servidor HTTP estático (`python -m http.server 4173` / `python3 -m http.server 4173`) sirviendo la carpeta del paquete, abren el navegador por defecto en `http://localhost:4173/`, y mantienen el proceso vivo mientras la ventana de terminal esté abierta.

**¿Por qué el puerto 4173 específicamente, y por qué debe ser siempre el mismo?** IndexedDB (donde vive `ProjectStore`/`AssetBinaryStore`, es decir, todos los proyectos guardados del comprador) está particionado por origen completo: protocolo + host + **puerto**. Si una versión futura de Impulso usara un puerto distinto, el comprador "perdería" (en realidad: dejaría de ver) todos sus proyectos guardados al actualizar, porque estarían en el origen `localhost:4173` mientras la nueva versión corre en, por ejemplo, `localhost:5000`. Fijar el puerto en 4173 en todas las versiones (el mismo que ya usa `vite preview` en el flujo de desarrollo/E2E) es lo que garantiza continuidad de datos entre actualizaciones sin necesitar ningún mecanismo de migración.

## Verificación real hecha (no solo diseño en el papel)

- Se sirvió el build empaquetado real con `python3 -m http.server` (un servidor genuinamente distinto a `vite preview`, para no validar el mismo camino dos veces) y se condujo con Playwright/Chromium real: la Workspace carga, "Nuevo proyecto" funciona, exportar funciona, cero errores de consola.
- Se verificó el comportamiento **realmente offline** con `context.setOffline(true)` de Playwright contra ese mismo servidor: creación de proyecto, guardado automático, persistencia tras navegar, y apertura del diálogo de exportación — todo funciona sin red, cero errores de consola/red.
- Se encontró y corrigió un bug real en el launcher de macOS/Linux: `trap "kill $PID" EXIT` por sí solo no mataba de forma confiable el servidor en segundo plano cuando el script recibía `SIGTERM` (ej. al cerrar la terminal de golpe) — verificado con una reproducción basada en `timeout` que confirmó un servidor huérfano todavía respondiendo después de que el script "terminara". Se corrigió agregando una función `cleanup()` atrapada en `EXIT INT TERM HUP`, y se volvió a correr la misma reproducción para confirmar "sin servidor huérfano" tras el fix.

## Re-verificación — Release Candidate 1.0

Validado empíricamente (no solo por el argumento del puerto fijo): se creó y guardó un proyecto real vía el launcher, se dejó apagar el servidor por completo (proceso terminado), y se volvió a levantar el launcher en un proceso de servidor nuevo — el proyecto seguía visible en "Mis proyectos" sin ninguna acción de recuperación. Esto es exactamente lo que ocurre al actualizar Impulso a una versión nueva (nuevo paquete, mismo puerto 4173).

## Limitación conocida y documentada: Python

Ambos launchers dependen de tener Python instalado (`python`/`py -3` en Windows, `python3`/`python` en macOS/Linux) para levantar el servidor HTTP. macOS y la mayoría de distribuciones Linux lo traen preinstalado; Windows no. El launcher de Windows detecta la ausencia y muestra un mensaje claro con un link a python.org en vez de fallar en silencio o colgarse — esto es una limitación aceptada de la V1, documentada honestamente en `06-requisitos-y-limitaciones.md`, no un defecto oculto. Un instalador nativo que empaquete su propio runtime (sin depender de Python del sistema) queda fuera de alcance de esta fase — ver Roadmap, fases 4.3+.

## Qué NO hace esta solución

- No instala nada de forma permanente en el sistema del comprador (no hay registro de Windows, no hay servicio en segundo plano que sobreviva al cierre de la terminal).
- No requiere puertos privilegiados ni permisos de administrador.
- No abre el puerto 4173 a la red — `http.server` por defecto escucha en todas las interfaces, pero el uso normal (abrir el navegador local) nunca expone el servicio más allá de la sesión activa del comprador; no hay garantía de aislamiento de red incluida en V1 (ver Commercial Security Checklist, task 197, para el detalle de este supuesto).
