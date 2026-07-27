# Release Notes — Impulso Sticker Builder Professional v1.0.0

Versión: **1.0.0**
Edición: Professional (pago único)
Canal: Gumroad
Commit: `6e1f02e254cc2be55e9982c73c005788f1d62cdf`
Build ID: `1.0.0+6e1f02e254cc`
Fecha de generación del paquete final: 2026-07-27

Esta es la primera versión comercial de Impulso Sticker Builder — el resultado de las Fases 4.1/4.2 (arquitectura y empaquetado comercial) y de la validación de Release Candidate 1.0, que incluyó una validación manual de comprador en vivo (no solo pruebas automatizadas) directamente sobre el ZIP de distribución, en la máquina real del comprador.

## Qué incluye v1.0.0

- Editor completo de stickers: texto, imágenes (PNG/SVG), formas, capas, alineación, Grid/Snap, deshacer/rehacer.
- Biblioteca de assets y de plantillas, con plantillas propias del comprador ("Guardar como plantilla").
- Exportación rápida a PNG y SVG.
- "Exportar para impresión": flujo profesional de 7 pasos con perfiles (Digital PNG, Print PDF, Sticker Sheet/imposición), sangrado, marcas de corte, líneas de troquelado (die-cut), y Preflight con validación explicada en texto (no solo color).
- Guardado automático + guardado manual, con indicador de estado siempre visible.
- Recuperación de cambios sin guardar tras un cierre inesperado.
- Respaldo y restauración de proyectos (formato JSON autocontenido, incluye binarios de assets).
- 100% local/offline: sin backend, sin cuentas, sin telemetría — toda la información vive en el navegador del comprador (IndexedDB).
- Documentación completa para el comprador en español (instalación, exportación, impresión, actualización/respaldo, problemas frecuentes, requisitos y limitaciones) + documentos legales (licencia de uso, privacidad, licencias de terceros).

## Corregido durante la validación de Release Candidate 1.0

Todo lo siguiente fue encontrado durante validaciones reales (no solo suites automatizadas) y quedó corregido y reverificado antes de este release:

- **Crítico** — Imágenes importadas podían quedar mal posicionadas o desbordando el sticker (mezcla de unidades física/canónica al insertar objetos). Corregido y verificado con el escenario exacto reportado.
- **Crítico** — Las imágenes de un proyecto podían desaparecer (quedar como placeholder) al reabrirlo desde "Mis proyectos" tras cerrar la aplicación por completo. Corregido precargando los binarios de imagen antes del primer render del editor.
- **Crítico** — El botón principal del asistente "Exportar para impresión" podía renderizarse invisible (texto blanco sobre fondo blanco) por un conflicto de especificidad CSS.
- **Crítico** — Importar un respaldo de proyecto podía sobrescribir en silencio un proyecto ya existente con el mismo id, en vez de crear uno nuevo.
- **Menor** — El foco inicial del diálogo de bienvenida mostraba el contorno crudo por defecto del navegador en vez de un estilo coherente con el resto de la app.
- **Menor** — Un proyecto recién importado desde un respaldo no generaba una miniatura para su tarjeta en "Mis proyectos" (quedaba con el ícono de imagen rota hasta el primer guardado manual).

Ver `apps/sticker-builder/CHANGELOG.md` para el detalle técnico completo de cada corrección, con la causa raíz y la verificación específica de cada una.

## Limitaciones conocidas

Ver `KNOWN_LIMITATIONS_v1.0.0.md` para la lista completa y honesta de lo que v1.0.0 no hace todavía.

## Validación

- Verificación automatizada completa (typecheck + tests unitarios + E2E) en verde en los 23 paquetes del monorepo.
- Validación manual de comprador en vivo, ejecutada personalmente por el propietario del producto sobre el ZIP de distribución real, en su propia máquina — no en el entorno de desarrollo. Ver `BUYER_VALIDATION_REPORT.md` para el reporte completo.

## Soporte

`soporte@bookfluence.shop` — objetivo de respuesta: 2-3 días hábiles (ver `docs/05-problemas-frecuentes-y-soporte.md` dentro del paquete).
