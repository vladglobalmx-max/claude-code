# THÖREN — Checklist de Publicación No Listada en Gumroad (Beta Comercial)

Checklist ordenado y ejecutable para publicar el paquete comercial en Gumroad en modo **no listado**, exclusivamente para la Beta Comercial (`THOREN_BETA_COMMERCIAL_PLAN.md`). Ningún ítem de este checklist se ha ejecutado todavía — está listo para que el usuario lo siga paso a paso.

**Regla que gobierna todo este checklist**: nada se publica en modo público/listado durante la beta. El objetivo es que solo las personas con el enlace privado + su código individual puedan acceder — nunca alguien que llegue por búsqueda, categoría de Gumroad, o recomendación del sitio.

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
- [ ] Pegar la descripción completa de `GUMROAD_LAUNCH_PLAN.md` §2 — **sin modificarla para mencionar que es una beta** (ver punto 11, qué no debe publicarse todavía).
- [ ] Subir el `.zip` verificado en el paso 2 como el archivo del producto.

## 4. Configuración como producto no listado

- [ ] En la configuración de visibilidad del producto, seleccionar **"No listado"** (unlisted) — nunca "Público".
- [ ] Confirmar que el producto **no aparece** en tu página de perfil/tienda de Gumroad ni en resultados de categoría — solo es accesible por enlace directo.
- [ ] Copiar el enlace directo del producto (será el `[enlace privado]` que se usa en `THOREN_BETA_INVITATION_MESSAGES.md`, igual para los 5 mensajes — lo único que cambia por participante es su código individual, ver punto 6).

## 5. Precio temporal para la Beta

- [ ] Configurar el precio del producto al precio de lanzamiento ya definido en `GUMROAD_LAUNCH_PLAN.md` §1: **$19 USD** (no $0 directo) — esto evita tener que reconfigurar el precio dos veces cuando termine la beta y se decida el lanzamiento público.
- [ ] El acceso gratuito de los participantes de la beta se logra exclusivamente vía códigos de descuento del 100% individuales (punto 6), no cambiando el precio base del producto.

## 6. Creación de códigos de descuento individuales (uno por participante)

En vez de un único código compartido, cada participante recibe su **propio código de un solo uso** — así cada acceso en Gumroad queda relacionado con una persona específica, se reduce el riesgo de que un código circule fuera de la beta, y se mejora el seguimiento sin agregar telemetría propia a THÖREN (el emparejamiento código↔participante vive en `THOREN_BETA_PARTICIPANT_TRACKER.csv`, no en el runtime de la app).

- [ ] Crear un código de descuento (offer code) por cada participante confirmado, con el formato `BETA-[CATEGORÍA]-[NÚMERO]`:
  - `BETA-BEAUTY-01`, `BETA-BEAUTY-02`, `BETA-BEAUTY-03`, … (Cosmetics/Beauty)
  - `BETA-BUSINESS-01`, `BETA-BUSINESS-02`, … (Business)
  - `BETA-ETSY-01`, `BETA-ETSY-02`, … (Etsy Sellers/Retail/Crafts)
  - `BETA-LABELS-01`, `BETA-LABELS-02`, … (Product Labels)
  - `BETA-WEDDING-01`, `BETA-WEDDING-02`, … (Wedding)
- [ ] Configurar cada código en descuento **100%** (precio final: $0 para quien lo use).
- [ ] Confirmar que cada código solo aplica a este producto (no a otros productos de la cuenta, si existieran).
- [ ] Registrar cada código creado en `THOREN_BETA_PARTICIPANT_TRACKER.csv` (columna "Código enviado") antes de enviarlo — nunca generar el código después de haberlo prometido al participante.

## 7. Límite o control de uso del código

- [ ] Configurar cada código individual con **un solo uso** (no compartido entre participantes) — el control de cantidad total ya no depende de un límite agregado en un solo código, sino de cuántos códigos individuales se crean (uno por participante confirmado, máximo 25 según `THOREN_BETA_COMMERCIAL_PLAN.md` §4).
- [ ] Configurar una fecha de expiración igual para todos los códigos, coherente con la duración esperada de la beta (recomendado: 3-4 semanas desde el envío de la primera invitación, suficiente para el flujo de uso + seguimiento de `THOREN_BETA_COMMERCIAL_PLAN.md` §6).
- [ ] Anotar la fecha de expiración configurada en `THOREN_BETA_PARTICIPANT_TRACKER.csv` (columna "Notas") para no perder de vista cuándo vence.

## 8. Configuración del mensaje posterior a la compra

- [ ] En el mensaje/contenido que Gumroad muestra tras registrar el acceso (recibo/página de agradecimiento), agregar un texto breve que:
  - Confirme que se trata de la Beta Comercial privada de THÖREN.
  - Recuerde el pedido concreto: descargar, elegir un template, personalizarlo, exportar, y responder al correo de soporte (`soporte@bookfluence.shop`) con su retroalimentación.
  - Recuerde que el acceso es gratuito, individual y personal — pedir que no se comparta el enlace ni su código con nadie fuera de la beta (cada código es de un solo uso, así que compartirlo no le serviría a un tercero de todas formas, pero vale la pena decirlo).
- [ ] Confirmar que el email de confirmación automático de Gumroad llega con el archivo adjunto/enlace de descarga correcto (mismo criterio ya usado en `RC1_POST_LAUNCH_PLAN.md` — "confirmar que el email de confirmación de compra de Gumroad llega correctamente y no cae en spam").

## 9. Prueba de acceso realizada por el usuario antes de invitar participantes

- [ ] Crear un código individual adicional exclusivo para esta prueba (ej. `BETA-TEST-00`, que no se le entrega a ningún participante real).
- [ ] Registrar un acceso de prueba real usando ese código, desde una sesión sin tu propia sesión de vendedor activa (ventana de incógnito o navegador distinto) — mismo criterio que `RC1_POST_LAUNCH_PLAN.md`.
- [ ] Confirmar que el proceso completo funciona sin fricción (el descuento se aplica correctamente, el precio final muestra $0, no pide método de pago si el total es $0).
- [ ] Confirmar que el email de confirmación llega y el mensaje posterior al acceso (paso 8) se ve correctamente.
- [ ] Confirmar que este código de prueba no es ninguno de los códigos individuales ya asignados a participantes reales (paso 6) — así ningún uso de prueba consume el único uso disponible de un participante.

## 10. Validación de descarga y ejecución

- [ ] Descargar el `.zip` desde el enlace real que recibiste en la prueba de acceso (no desde tu carpeta local de desarrollo).
- [ ] Descomprimirlo en una carpeta limpia y ejecutar el launcher correspondiente a tu sistema.
- [ ] Confirmar que la app abre, muestra la bienvenida de primera ejecución, y la galería con los 15 templates aprobados (piloto + Lotes 1-3) es visible.
- [ ] Crear un proyecto de prueba desde un template, personalizarlo, y exportar un PNG/SVG real — confirmar que el flujo completo funciona de punta a punta sobre el archivo que un participante real recibiría.

## 11. Validación real en Windows (obligatoria antes de invitar a nadie)

Dado que la mayoría de participantes probablemente use Windows (launcher `.bat`, no `.command`), esta validación se hace en una máquina Windows real (no solo macOS/Linux) antes de reclutar a nadie:

- [ ] Descargar el `.zip` real desde Gumroad (el mismo que recibiría un participante, no una copia de desarrollo) en una máquina o entorno Windows real.
- [ ] Descomprimirlo con el explorador de archivos de Windows (no una herramienta de línea de comandos de otro sistema) — confirmar que la descompresión nativa de Windows no altera ni bloquea ningún archivo.
- [ ] Ejecutar `ABRIR-IMPULSO-WINDOWS.bat` haciendo doble clic, exactamente como lo haría un participante sin conocimientos técnicos.
- [ ] Confirmar que Windows no bloquea el archivo con una advertencia de "editor desconocido" que detenga el flujo sin explicación — si aparece, confirmar que `LEEME-PRIMERO.md` ya explica cómo continuar (ver `COMMERCIAL_WALKTHROUGH_VERIFICATION.md` para el criterio ya usado en la verificación de RC1).
- [ ] Confirmar que la app abre en el navegador por defecto configurado (Chrome/Edge/Brave, según `commercial-product.json`/requisitos ya documentados) y que la galería de templates carga correctamente.
- [ ] Completar el mismo flujo de prueba del paso 10 (crear proyecto, personalizar, exportar) en esta máquina Windows — confirmar que el archivo exportado se guarda donde Windows lo esperaría (carpeta de Descargas) sin errores de permisos.

## 12. Qué información no debe publicarse todavía

- [ ] **No** cambiar la visibilidad del producto a "Público" ni "Listado" bajo ninguna circunstancia durante la beta.
- [ ] **No** anunciar el producto en redes sociales, newsletter, ni ningún canal abierto.
- [ ] **No** modificar la descripción del producto para mencionar "beta", "gratis", ni ningún código de descuento — ese texto vive únicamente en los mensajes de invitación (`THOREN_BETA_INVITATION_MESSAGES.md`) y en el mensaje posterior al acceso (paso 8), nunca en la página pública del producto.
- [ ] **No** solicitar ni publicar reseñas públicas en Gumroad durante la beta — el canal de feedback de la beta es el correo/llamada definido en `THOREN_BETA_COMMERCIAL_PLAN.md` §9, no las reseñas del producto.
- [ ] **No** compartir capturas de la beta ni del feedback recibido fuera del equipo del proyecto mientras la beta esté en curso.
- [ ] **No** reutilizar el código individual de un participante para otro — cada código creado en el paso 6 se entrega a una sola persona, nunca se reasigna.

## 13. Checklist final antes de compartir el enlace

- [ ] Los pasos 1-11 de este checklist están completos y confirmados, incluyendo la validación real en Windows (paso 11).
- [ ] El producto está en modo **no listado**, con el precio de catálogo ($19) y un código de descuento del 100% individual ya creado para cada participante confirmado (un solo uso cada uno, con fecha de expiración).
- [ ] La prueba de acceso (paso 9) y la validación de descarga/ejecución (paso 10) se hicieron sobre el `.zip` real que Gumroad entrega — no sobre una copia local.
- [ ] `THOREN_BETA_PARTICIPANT_TRACKER.csv` tiene, para cada participante confirmado, su código individual ya registrado (columna "Código enviado") antes de enviárselo.
- [ ] Los mensajes de invitación (`THOREN_BETA_INVITATION_MESSAGES.md`) están listos con el enlace privado (igual para todos) y el código individual correspondiente a cada destinatario (distinto para cada uno).

**Solo cuando las 5 casillas de esta sección estén marcadas se empieza a enviar invitaciones reales.**
