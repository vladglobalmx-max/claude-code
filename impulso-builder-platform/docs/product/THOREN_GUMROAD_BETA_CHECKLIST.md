# THÖREN — Checklist de Publicación No Listada en Gumroad (Beta Comercial)

Checklist ordenado y ejecutable para publicar el paquete comercial en Gumroad en modo **no listado**, exclusivamente para la Beta Comercial (`THOREN_BETA_COMMERCIAL_PLAN.md`). Ningún ítem de este checklist se ha ejecutado todavía — está listo para que el usuario lo siga paso a paso.

**Regla que gobierna todo este checklist**: nada se publica en modo público/listado durante la beta. El objetivo es que solo las personas con el enlace privado + código de descuento puedan acceder — nunca alguien que llegue por búsqueda, categoría de Gumroad, o recomendación del sitio.

---

## 1. Preparación del archivo comercial correcto

- [ ] Confirmar que el working tree está limpio: `git status` sin cambios sin commitear (el `buildId` debe reflejar exactamente el commit que se publica — ver `COMMERCIAL_BUILD_GUIDE.md`).
- [ ] Confirmar en qué commit exacto se está parado: `git rev-parse HEAD`.
- [ ] Ejecutar el build comercial: `cd apps/sticker-builder && pnpm build:commercial`.
- [ ] Confirmar que el build terminó sin errores (los 5 pasos: validación de manifest, compilación, armado de paquete, escaneo de higiene, compresión + checksum — ver `COMMERCIAL_BUILD_GUIDE.md`).
- [ ] Confirmar que se generó `dist-commercial/thoren-sticker-builder-v1.0.0.zip` y `dist-commercial/CHECKSUMS.sha256`.

## 2. Verificación de versión y contenido

- [ ] Abrir `dist-commercial/thoren-sticker-builder-v1.0.0/commercial-product.json` y confirmar: `productVersion: "1.0.0"`, `channel: "gumroad"`, `buildMetadata.commit` coincide con el `git rev-parse HEAD` del paso 1.
- [ ] Verificar el checksum del `.zip` contra `CHECKSUMS.sha256`: `sha256sum -c CHECKSUMS.sha256` (o el equivalente de tu sistema).
- [ ] Confirmar que el escaneo de higiene del build no reportó ningún archivo prohibido (`.env`, `.git`, `node_modules`, `.DS_Store`) dentro del paquete — si el build llegó hasta el final sin error, ya pasó este escaneo automáticamente.
- [ ] Descomprimir el `.zip` en una carpeta aparte y confirmar visualmente que incluye: `index.html`, `assets/`, `ABRIR-IMPULSO-WINDOWS.bat`, `ABRIR-IMPULSO-MAC-LINUX.command`, `LEEME-PRIMERO.md`, `docs/`, `legal/`.

## 3. Creación o actualización del producto en Gumroad

- [ ] Si es la primera vez: crear un producto nuevo en Gumroad, tipo "archivo digital".
- [ ] Si ya existe un borrador del producto de una fase anterior (Fase 4.2/RC1): abrirlo y actualizar el archivo subido al `.zip` recién generado (nunca reutilizar un `.zip` de una build anterior).
- [ ] Pegar el título y subtítulo ya definidos en `GUMROAD_LAUNCH_PLAN.md` §2 ("THÖREN Sticker Builder — Diseña y exporta stickers listos para imprenta").
- [ ] Pegar la descripción completa de `GUMROAD_LAUNCH_PLAN.md` §2 — **sin modificarla para mencionar que es una beta** (ver punto 10, qué no debe publicarse todavía).
- [ ] Subir el `.zip` verificado en el paso 2 como el archivo del producto.

## 4. Configuración como producto no listado

- [ ] En la configuración de visibilidad del producto, seleccionar **"No listado"** (unlisted) — nunca "Público".
- [ ] Confirmar que el producto **no aparece** en tu página de perfil/tienda de Gumroad ni en resultados de categoría — solo es accesible por enlace directo.
- [ ] Copiar el enlace directo del producto (será el `[enlace privado]` que se usa en `THOREN_BETA_INVITATION_MESSAGES.md`).

## 5. Precio temporal para la Beta

- [ ] Configurar el precio del producto al precio de lanzamiento ya definido en `GUMROAD_LAUNCH_PLAN.md` §1: **$19 USD** (no $0 directo) — esto evita tener que reconfigurar el precio dos veces cuando termine la beta y se decida el lanzamiento público.
- [ ] El acceso gratuito de los participantes de la beta se logra exclusivamente vía el código de descuento del 100% (paso 6), no cambiando el precio base del producto.

## 6. Creación del código de descuento del 100%

- [ ] Crear un código de descuento (offer code) nuevo, específico para esta beta — nombre sugerido: `BETATHOREN` o similar, fácil de escribir a mano.
- [ ] Configurar el descuento en **100%** (precio final: $0 para quien lo use).
- [ ] Confirmar que el código solo aplica a este producto (no a otros productos de la cuenta, si existieran).

## 7. Límite o control de uso del código

- [ ] Configurar el número máximo de usos del código = número de participantes objetivo de la beta (`THOREN_BETA_COMMERCIAL_PLAN.md` §4: **15-25**) — usar 25 como techo si Gumroad exige un número fijo.
- [ ] Configurar una fecha de expiración del código coherente con la duración esperada de la beta (recomendado: 3-4 semanas desde el envío de la primera invitación, suficiente para el flujo de uso + seguimiento de `THOREN_BETA_COMMERCIAL_PLAN.md` §6).
- [ ] Anotar la fecha de expiración configurada en `THOREN_BETA_PARTICIPANT_TRACKER.csv` (columna de notas) para no perder de vista cuándo vence.

## 8. Configuración del mensaje posterior a la compra

- [ ] En el mensaje/contenido que Gumroad muestra tras la "compra" (recibo/página de agradecimiento), agregar un texto breve que:
  - Confirme que se trata de la Beta Comercial privada de THÖREN.
  - Recuerde el pedido concreto: descargar, elegir un template, personalizarlo, exportar, y responder al correo de soporte (`soporte@bookfluence.shop`) con su retroalimentación.
  - Recuerde que el acceso es gratuito y personal — pedir que no se comparta el enlace ni el código con nadie fuera de la beta.
- [ ] Confirmar que el email de confirmación automático de Gumroad llega con el archivo adjunto/enlace de descarga correcto (mismo criterio ya usado en `RC1_POST_LAUNCH_PLAN.md` — "confirmar que el email de confirmación de compra de Gumroad llega correctamente y no cae en spam").

## 9. Prueba de compra realizada por el usuario antes de invitar participantes

- [ ] Hacer una "compra" de prueba real usando el código de descuento del 100%, desde una sesión sin tu propia sesión de vendedor activa (ventana de incógnito o navegador distinto) — mismo criterio que `RC1_POST_LAUNCH_PLAN.md`.
- [ ] Confirmar que el checkout completo funciona sin fricción (el descuento se aplica correctamente, el precio final muestra $0, no pide método de pago si el total es $0).
- [ ] Confirmar que el email de confirmación llega y el mensaje posterior a la compra (paso 8) se ve correctamente.
- [ ] Confirmar que el uso de prueba no agota el límite real disponible para participantes — si el límite de usos (paso 7) se configuró en 25, esta prueba cuenta como 1 uso; ajustar el número de participantes a invitar en consecuencia, o subir el límite en 1 antes de reclutar.

## 10. Validación de descarga y ejecución

- [ ] Descargar el `.zip` desde el enlace real que recibiste en la prueba de compra (no desde tu carpeta local de desarrollo).
- [ ] Descomprimirlo en una carpeta limpia y ejecutar el launcher correspondiente a tu sistema (`ABRIR-IMPULSO-WINDOWS.bat` o `ABRIR-IMPULSO-MAC-LINUX.command`).
- [ ] Confirmar que la app abre, muestra la bienvenida de primera ejecución, y la galería con los 15 templates aprobados (piloto + Lotes 1-3) es visible.
- [ ] Crear un proyecto de prueba desde un template, personalizarlo, y exportar un PNG/SVG real — confirmar que el flujo completo funciona de punta a punta sobre el archivo que un participante real recibiría.

## 11. Qué información no debe publicarse todavía

- [ ] **No** cambiar la visibilidad del producto a "Público" ni "Listado" bajo ninguna circunstancia durante la beta.
- [ ] **No** anunciar el producto en redes sociales, newsletter, ni ningún canal abierto.
- [ ] **No** modificar la descripción del producto para mencionar "beta", "gratis", ni el código de descuento — ese texto vive únicamente en los mensajes de invitación (`THOREN_BETA_INVITATION_MESSAGES.md`) y en el mensaje posterior a la compra (paso 8), nunca en la página pública del producto.
- [ ] **No** solicitar ni publicar reseñas públicas en Gumroad durante la beta — el canal de feedback de la beta es el correo/llamada definido en `THOREN_BETA_COMMERCIAL_PLAN.md` §9, no las reseñas del producto.
- [ ] **No** compartir capturas de la beta ni del feedback recibido fuera del equipo del proyecto mientras la beta esté en curso.

## 12. Checklist final antes de compartir el enlace

- [ ] Los pasos 1-10 de este checklist están completos y confirmados.
- [ ] El producto está en modo **no listado**, con el precio de catálogo ($19) y el código de descuento del 100% activo, limitado y con fecha de expiración.
- [ ] La compra de prueba (paso 9) y la validación de descarga/ejecución (paso 10) se hicieron sobre el `.zip` real que Gumroad entrega — no sobre una copia local.
- [ ] `THOREN_BETA_PARTICIPANT_TRACKER.csv` está listo para empezar a registrar participantes (columnas de fecha de invitación/acceso/código enviado).
- [ ] Los mensajes de invitación (`THOREN_BETA_INVITATION_MESSAGES.md`) tienen el enlace privado y el código reales pegados, listos para enviar.

**Solo cuando las 5 casillas de esta sección estén marcadas se empieza a enviar invitaciones reales.**
