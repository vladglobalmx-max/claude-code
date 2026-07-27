# Known Limitations — Impulso Sticker Builder Professional v1.0.0

Documento interno de referencia para soporte/negocio. Es la contraparte de `docs/06-requisitos-y-limitaciones.md` (la versión dirigida al comprador, dentro del paquete) — mismo contenido de fondo, con una limitación adicional de conocimiento interno para soporte al final.

## Limitaciones por diseño (decisiones deliberadas de v1.0.0, no bugs)

- **Sin backend, sin cuentas, sin activación en línea.** Licenciamiento `delivery-only` (ver `commercial-product.json`) — el archivo descargado en sí es la licencia. Documentado en `LICENCIA-DE-USO.md`.
- **Sin sincronización entre dispositivos.** Cada instalación guarda sus proyectos localmente (IndexedDB del navegador). Mover proyectos entre computadoras requiere "Exportar respaldo" / "Importar proyecto".
- **Sin actualización automática.** Actualizar es una acción manual desde la biblioteca de Gumroad del comprador.
- **Un solo idioma de interfaz: español.**
- **Exportación de impresión en RGB, no CMYK/ICC certificado.** Suficiente para la mayoría de imprentas de stickers; documentado como algo a confirmar con la imprenta si exigen un perfil específico.

## Limitaciones técnicas verificadas (no bugs, pero con impacto real)

- **Solo navegadores basados en Chromium (Chrome/Edge/Brave) están verificados.** Firefox/Safari no fueron parte de la matriz de verificación de esta versión.
- **El launcher de Windows depende de tener Python instalado por separado** (no es un instalador todo-en-uno). Se comunica con un mensaje claro si falta, en vez de fallar en silencio.
- **Puerto fijo 4173 para el servidor local del launcher.** Si otro proceso (de una instalación anterior de Impulso que quedó corriendo, u otra app) ya ocupa ese puerto, el launcher puede fallar a arrancar o quedar sirviendo contenido obsoleto — el comprador necesita cerrar el proceso anterior manualmente. Documentado en `docs/05-problemas-frecuentes-y-soporte.md` dentro del paquete.

## Hallazgo sin resolver de la validación de RC1 (referencia interna para soporte)

- **Miniatura de un proyecto no se regenera en un caso aislado.** Durante la validación manual de comprador, un proyecto de prueba específico (que pasó por un historial inusualmente largo de ediciones, cierres/reaperturas y reconstrucciones del paquete a lo largo de la sesión de validación) quedó con la miniatura de su tarjeta en "Mis proyectos" rota, sin que la generación de thumbnail lanzara ningún error verificable en consola. No se reprodujo en ningún proyecto nuevo ni en ningún proyecto recién importado desde un respaldo (ver `BUYER_VALIDATION_REPORT.md`, sección de bugs menores). Es puramente cosmético — el proyecto en sí abre, edita y exporta con normalidad. Si un comprador reporta una miniatura rota persistente, este documento es la referencia; no se encontró la causa raíz exacta con la evidencia disponible durante RC1.

## Deuda técnica de producto (fuera del alcance de v1.0.0, ver Roadmap)

Cualquier decisión de arquitectura futura (entitlements/licensing técnico, cuentas/auth, cloud sync, telemetría, marketplace, DRM, Mockup Engine, nuevos builders) sigue evaluándose contra el criterio YAGNI adoptado en Fase 4.2: "¿esto ayuda a vender/entregar/usar la primera copia?" — ver `docs/product/04-Roadmap.md`. Ninguna de estas líneas está planeada para una v1.x inmediata.
