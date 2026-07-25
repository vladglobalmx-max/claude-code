# Commercial Walkthrough Verification — Impulso Sticker Builder Professional v1.0.0 (Fase 4.2)

Prueba de recorrido completo contra el `.zip` real (`impulso-sticker-builder-v1.0.0.zip`, `buildId: 1.0.0+ccc194c5074b`), ejecutado con el launcher real (`ABRIR-IMPULSO-MAC-LINUX.command`) y Chromium real vía Playwright — no contra `vite dev`/`vite preview`. Cero mocks en la aplicación misma.

## Checklist (25 puntos)

| # | Paso | Resultado |
|---|---|---|
| 1 | Descomprimir el `.zip` produce la estructura documentada en `PACKAGING_GUIDE.md` | ✅ Verificado (ver `COMMERCIAL_BUILD_GUIDE.md`) |
| 2 | Doble clic en el launcher levanta un servidor real en el puerto 4173 | ✅ Verificado — `curl` HTTP 200 mientras el launcher real corre |
| 3 | El launcher abre el navegador automáticamente (o dice cómo hacerlo manualmente) | ✅ Verificado — mensaje de fallback probado en este mismo entorno (sin `xdg-open`/`open` disponibles) |
| 4 | Cerrar el launcher apaga el servidor sin dejar procesos huérfanos | ✅ Verificado — `curl` falla tras terminar el proceso |
| 5 | Primera carga muestra la bienvenida | ✅ Verificado |
| 6 | La bienvenida se cierra con "Comenzar" | ✅ Verificado |
| 7 | La bienvenida NO reaparece tras recargar la página | ✅ Verificado (gateada por `localStorage`) |
| 8 | "Estado comercial" muestra edición/versión/canal reales y honestos (nunca "activado") | ✅ Verificado — texto exacto capturado |
| 9 | Crear un proyecto nuevo (tamaño personalizado) funciona | ✅ Verificado |
| 10 | El editor carga con el canvas y la barra de exportación | ✅ Verificado (`#export-btn` presente) |
| 11 | El guardado automático corre sin acción explícita | ✅ Verificado — indicador pasa a "Guardado" |
| 12 | Volver a "Mis proyectos" muestra el proyecto guardado | ✅ Verificado — 1 tarjeta presente |
| 13 | "Exportar respaldo" dispara una descarga real | ✅ Verificado — evento `download` capturado con nombre de archivo real |
| 14 | Importar un respaldo válido restaura un proyecto completo (incluidas imágenes), SIEMPRE como una entrada nueva e independiente | ✅ Verificado — cobertura unitaria (`projectBackup.test.ts`, 8 tests) + round-trip real exportar→importar con imagen real, launcher real y Chromium real contra el `.zip` reconstruido tras el fix de RC1 (ver sección "Re-verificación RC1" abajo): 2 tarjetas tras importar, no 1 |
| 15 | Exportación rápida (PNG/SVG) funciona sin conexión | ✅ Verificado en la suite E2E general (`export-visual.spec.ts`, 3 escenarios, corre contra el mismo build de producción) |
| 16 | Exportación para impresión (los 3 perfiles) funciona sin conexión | ✅ Verificado — 51/51 escenarios E2E en verde (incluye los 19+ escenarios de `production-export.spec.ts`), todos contra un build de producción real |
| 17 | Preflight bloquea exportaciones inválidas con mensaje claro | ✅ Verificado (parte de la suite E2E general, sin cambios de comportamiento en Fase 4.2) |
| 18 | Comportamiento 100% offline (creación/guardado/exportación) | ✅ Verificado en sesión previa de esta misma fase con `context.setOffline(true)` contra el build empaquetado, cero errores de red/consola |
| 19 | Ningún harness de Epic 9 presente ni accesible en el paquete | ✅ Verificado — `find -iname "*harness*"` sin resultados |
| 20 | Ningún archivo de desarrollo/secreto en el paquete | ✅ Verificado — escaneo de higiene de `build-commercial.mjs` + revisión manual (`COMMERCIAL_SECURITY_CHECKLIST.md`) |
| 21 | El manifest embebido coincide con `commercial-product.json` fuente (capabilities/edición/canal) | ✅ Verificado — validación build-time obligatoria (`validate:manifest`) antes de cada build |
| 22 | Checksums (`CHECKSUMS.sha256`) corresponden al `.zip` generado | ✅ Verificado — recalculado y comparado manualmente |
| 23 | Reproducibilidad: mismo commit produce el mismo bundle de JS | ✅ Verificado — dos builds consecutivos, mismo hash SHA-256 del bundle |
| 24 | Documentación del comprador enlaza y describe correctamente cada función real | ✅ Revisado contra la UI real (nombres de botones/pasos verificados textualmente) |
| 25 | Cero errores de consola/página durante todo el recorrido | ✅ Verificado — `[]` en el walkthrough automatizado y en la verificación offline previa |

**25/25 verificados.** Ninguno es una suposición razonable sin comprobar — cada fila tiene una ejecución real detrás (Playwright/Chromium real, launcher real, o suite de tests real), consistente con la disciplina de todo Epic 9/Fase 4.1/4.2.

## Bug real encontrado durante esta prueba (ya corregido, ver CHANGELOG y UX Audit 0010)

El primer intento de este recorrido, ejecutando el launcher REAL contra el `.zip` REAL (en vez de servir la carpeta manualmente), falló de inmediato: los launchers buscaban una subcarpeta `app/` que el paquete real nunca tuvo. Corregido en ambos launchers; este documento refleja el estado YA corregido (re-verificado después del fix, no antes).

## Re-verificación RC1 — segundo bug real encontrado y corregido

Durante la validación de Release Candidate 1.0 se ejecutó por primera vez el round-trip COMPLETO de "Importar proyecto" (exportar → importar de vuelta) contra el `.zip` real con un proyecto que SEGUÍA existiendo en la Workspace — escenario nunca antes ejecutado end-to-end (los tests unitarios previos solo cubrían importar hacia una Workspace vacía). Resultado: 1 sola tarjeta tras importar (se esperaban 2) — "Importar proyecto" sobrescribía en silencio el proyecto existente en vez de agregar uno nuevo. Corregido (ver CHANGELOG `[0.17.1]`) aplicando `cloneProjectWithNewIds` al proyecto importado. Re-verificado con el mismo round-trip real (launcher real, Chromium real, imagen real insertada) contra el `.zip` reconstruido: 2 tarjetas tras importar, cero errores de consola.

## Protocolo de usuario no técnico (diseño, sin usuario real en esta fase)

La autorización de Fase 4.2 pide el *diseño* de un protocolo de prueba con una persona no técnica, no ejecutarlo con una persona real todavía (eso corresponde a una validación de mercado posterior a la publicación). Protocolo propuesto:

### Perfil del participante
Alguien que vende o quiere vender stickers (Etsy, ferias, redes sociales), sin experiencia en programación ni en herramientas de diseño profesional (Illustrator/Photoshop). Sin haber visto Impulso antes.

### Setup
- Entregarle únicamente el `.zip` descargado (simular la entrega real de Gumroad) y `LEEME-PRIMERO.md` como único punto de partida — sin explicación verbal previa.
- Observador presente, pero sin intervenir salvo que el participante quede completamente bloqueado más de 3 minutos.

### Tareas a pedir (sin explicar cómo)
1. "Abre el programa." (mide: ¿encuentra el launcher solo? ¿lee `LEEME-PRIMERO.md` primero o intenta abrir `index.html`?)
2. "Crea un sticker circular de unos 5cm." (mide: ¿encuentra "Nuevo proyecto"? ¿entiende tamaño personalizado vs. plantilla?)
3. "Agrégale un texto y una imagen." (mide: fricción con el Inspector/herramientas)
4. "Ahora prepáralo para mandarlo a imprimir en hojas de varias copias." (mide: ¿encuentra "Exportar para impresión" vs. "Exportar"? ¿entiende los 3 perfiles sin ayuda?)
5. "Guarda una copia de seguridad de tu proyecto en tu escritorio." (mide: ¿encuentra "Exportar respaldo"? ¿entiende para qué sirve sin leer la guía?)
6. "Cierra todo y vuelve a abrirlo — ¿sigue ahí tu proyecto?" (mide: confianza en la persistencia sin haber leído nada sobre autosave)

### Qué medir
- Tiempo hasta la primera acción exitosa (abrir la app).
- Número de veces que consulta la documentación vs. explora por su cuenta.
- Puntos de abandono o frustración explícita ("no sé qué hacer aquí").
- Vocabulario que usa espontáneamente vs. el vocabulario de la UI (¿dice "línea de corte" o "el borde"?).

### Qué NO es objetivo de este protocolo
No mide performance, no mide calidad de impresión real (eso requiere una imprenta física, fuera de alcance de cualquier fase de software), no compara contra competidores.

Este protocolo queda documentado y listo para ejecutarse quien decida hacerlo — no se ejecutó con una persona real en Fase 4.2, por alcance explícito de la autorización.
