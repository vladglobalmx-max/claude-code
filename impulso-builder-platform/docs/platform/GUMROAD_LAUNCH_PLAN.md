# Gumroad Launch Plan — THÖREN Sticker Builder v1.0.0 (Fase 4.2)

Copy comercial, recomendación de precio y checklist de publicación. **Este documento no publica nada por sí mismo** — la autorización de Fase 4.2 prohíbe explícitamente publicar en Gumroad durante esta fase; queda listo para que un humano lo use en el momento en que se autorice la publicación.

## 1. Recomendación de precio V1

**Precio recomendado: USD $29 (pago único), con un precio de lanzamiento de USD $19 durante las primeras 2 semanas o los primeros 50 compradores (lo que ocurra primero).**

Justificación:
- **Comparables de mercado** (orden de magnitud, no cotización verificada — mismo criterio que `COST_MODEL.md`): herramientas de escritorio/web enfocadas en preparación de archivos para impresión (bleed, marcas de corte, imposición en hoja) para vendedores independientes/Etsy suelen ubicarse entre $20-60 USD en pago único cuando no son suites generalistas de diseño. Herramientas generalistas de diseño (Canva Pro, Kittl) son suscripción y no comparables directas — THÖREN compite en la categoría "impresión lista para producción", no en la de "editor gráfico genérico".
- **Sin recurrencia de ingreso**: al ser pago único sin suscripción (decisión ya tomada, ADR-0028/29), el precio debe reflejar el valor completo de por vida del producto, no un valor mensual fraccionado.
- **Primer producto de la marca**: sin reputación previa ni reseñas, un precio de lanzamiento más bajo ($19) reduce la fricción de la primera decena de compradores y genera las primeras reseñas/testimonios reales antes de subir al precio de catálogo ($29).
- **Margen sobre Gumroad**: Gumroad cobra comisión por transacción (variable según plan, no cotizada aquí) — a $19-29, el margen neto sigue siendo saludable incluso después de la comisión, dado que el costo marginal de entregar una copia adicional es $0 (descarga digital, sin backend).
- **Sin descuentos posteriores agresivos**: evitar entrar en una espiral de descuentos permanentes que dañe la percepción de valor — el precio de lanzamiento tiene fecha de fin clara, no es "siempre en oferta".

**No se recomienda** un modelo freemium o de "paga lo que quieras" para V1 — no hay infraestructura de entitlements diferenciados todavía (ver `LICENSING_THREAT_MODEL.md`), y complicaría la primera venta sin necesidad.

## 2. Copy de la página de producto (Gumroad, en español)

### Título
THÖREN Sticker Builder — Diseña y exporta stickers listos para imprenta

### Subtítulo / tagline
Editor de stickers con exportación profesional a PDF: sangrado, marcas de corte e imposición en hoja. Sin cuenta, sin suscripción, funciona offline.

### Descripción (cuerpo)

```
¿Diseñas stickers para vender (Etsy, ferias, tu propia tienda) y necesitas
archivos que tu imprenta pueda usar sin devolvértelos por errores técnicos?

THÖREN Sticker Builder es un editor de stickers completo que
además sabe preparar archivos de verdad para producción:

✦ Editor completo — formas, texto, imágenes, capas, alineación, plantillas
  listas, grid y guías inteligentes.

✦ Exportación profesional para impresión — sangrado (bleed), marcas de
  corte, imposición en hoja (varias copias por hoja, tú eliges cantidad y
  tamaño), y una revisión automática (Preflight) que te avisa ANTES de
  exportar si algo no está listo para producción.

✦ Exportación rápida — PNG (transparente o con fondo, hasta 4x de
  resolución) o SVG editable, para cuando solo necesitas una imagen.

✦ Tuyo para siempre — pago único, sin suscripción mensual. Sin cuenta que
  crear, sin conexión a internet requerida después de la descarga. Tus
  proyectos se guardan en tu propia computadora, nunca en un servidor
  ajeno.

✦ Tus diseños son tuyos — vende los stickers que crees, sin regalías ni
  restricciones sobre tu propio trabajo.

Incluye: launcher de un clic (Windows/Mac/Linux), documentación completa
en español, y soporte por correo.

Requiere: Google Chrome, Microsoft Edge o Brave. Ver requisitos completos
dentro del paquete.
```

### Bullets cortos (para el resumen lateral de Gumroad)
- Pago único — sin suscripción
- Exportación profesional para impresión (bleed, marcas de corte, imposición)
- Funciona 100% offline
- Sin cuenta necesaria
- Tus diseños, tus derechos comerciales
- Soporte por correo en español

### Etiquetas/categoría sugeridas
Diseño gráfico, Herramientas para creadores, Impresión, Stickers, Software

## 3. Assets de la página de producto (pendientes, requieren decisión humana/creativa fuera de alcance de esta fase)

- Captura de pantalla del editor con un diseño de ejemplo.
- Captura del wizard de "Exportar para impresión" (paso de Preview o Preflight).
- Un GIF/video corto (15-30s) mostrando el flujo completo: crear → diseñar → exportar para impresión.
- Ninguno de estos assets se generó en esta fase (fuera de alcance: "sin publicar en Gumroad" implica no producir material de marketing final todavía) — este documento deja el copy listo; los assets visuales son un paso posterior explícito.

## 4. Checklist de publicación (a ejecutar cuando se autorice publicar)

- [ ] Confirmar que `pnpm build:commercial` corrió sobre el commit exacto que se va a publicar (verificar `buildId` en `version.json` contra `git rev-parse HEAD`).
- [ ] Verificar `CHECKSUMS.sha256` del `.zip` que se va a subir.
- [ ] Correr la Prueba de recorrido completo en Chromium (task 201) sobre el `.zip` final, no sobre una build de desarrollo.
- [ ] Subir el `.zip` a Gumroad como el archivo del producto.
- [ ] Pegar el copy de la sección 2 en la página de producto.
- [ ] Configurar el precio: $19 USD (lanzamiento) con nota de que subirá a $29 USD — o $29 USD directo si se decide omitir el precio de lanzamiento.
- [ ] Confirmar el email de soporte configurado en Gumroad coincide con `commercial-product.json` → `support.email` (`soporte@bookfluence.shop`).
- [ ] Subir `docs/NOTAS-DE-VERSION.md` (contenido de la v1.0.0) como descripción de "qué incluye esta versión".
- [ ] Verificar que Gumroad está configurado para entrega automática de archivo (sin pasos manuales de fulfillment).
- [ ] Publicar en modo "no listado" primero y hacer una compra de prueba propia antes de listar públicamente.
- [ ] Recién entonces: listar públicamente / anunciar.

Ningún ítem de esta checklist se ejecutó en esta fase — es una guía lista para cuando se autorice explícitamente la publicación (fuera del alcance de Fase 4.2).
