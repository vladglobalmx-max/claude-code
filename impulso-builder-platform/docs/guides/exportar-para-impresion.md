# Guía de usuario — Exportar para impresión

> Esta es una guía para quien USA Sticker Builder, no para quien lo desarrolla. Si buscas la documentación técnica del motor de impresión, ver `packages/print-engine/README.md`; si buscas el detalle de arquitectura del wizard, ver `docs/adr/0025-production-export-workflow.md`.

## ¿Cuándo usar "Exportar para impresión" y cuándo usar "Exportar"?

Sticker Builder tiene DOS botones de exportación distintos, a propósito:

- **"Exportar"** (rápido) — para cuando solo necesitas una imagen para pantalla: compartirla, subirla a una tienda online, verla en tu computadora. Produce un PNG (con o sin fondo transparente, a escala 1x-4x) o un SVG. No pasa por ninguna revisión de calidad de impresión.
- **"Exportar para impresión"** — para cuando el archivo va a una imprenta real, tuya o de un tercero. Revisa que el diseño esté listo (Preflight), agrega sangrado y marcas de corte si corresponde, y puede repetir tu diseño varias veces en una sola hoja para imprimir varias copias a la vez.

Si tu duda es "¿esto se va a ver bien en la pantalla de alguien?", usa "Exportar". Si tu duda es "¿esto va a salir bien impreso?", usa "Exportar para impresión".

## Los 3 perfiles

Al abrir "Exportar para impresión", el primer paso te pide elegir un perfil:

| Perfil | Para qué sirve | Qué incluye |
|---|---|---|
| **Digital PNG** | Una imagen simple, sin intención de imprimirse en papel físico con corte (ej. para un mockup, una vista previa de alta calidad, un uso digital que necesita más resolución que "Exportar" rápido). | Sin sangrado, sin marcas de corte, fondo transparente. |
| **Print PDF** | Un PDF de una sola pieza, listo para producción — el tamaño exacto que diseñaste, con sangrado y marcas de corte reales. | Sangrado de 3mm, marcas de corte, fondo blanco, alta resolución (300 PPI). |
| **Sticker Sheet** | Varias copias de tu diseño repetidas en una sola hoja — el caso típico de "quiero imprimir 50 stickers iguales en una hoja tamaño carta". | Todo lo de "Print PDF" más la repetición en hoja (cantidad, tamaño de hoja, separación entre copias). |

No hace falta entender los detalles técnicos de sangrado/marcas de corte para elegir — si tu diseño tiene una forma de corte (un círculo, un contorno personalizado) y vas a mandarlo a cortar, "Print PDF" o "Sticker Sheet" son la opción correcta. Si es una imagen rectangular sin corte, "Digital PNG" alcanza.

## Los 7 pasos del wizard

1. **Perfil** — elegís uno de los 3 de arriba.
2. **Configuración** — para "Sticker Sheet": cuántas copias, tamaño de la hoja, separación entre copias, orientación. Para los otros dos perfiles, este paso solo muestra un resumen (formato, resolución, sangrado) sin nada que ajustar.
3. **Vista previa** — un dibujo real de cómo va a quedar la hoja o la pieza, con zoom y navegación entre hojas si hay más de una. (Este paso no aplica a "Digital PNG"/"Print PDF" — no hay una "hoja" que previsualizar para una pieza única, así que se muestra un aviso en vez de un dibujo.)
4. **Revisión (Preflight)** — el sistema revisa automáticamente tu diseño buscando problemas antes de exportar (ver la sección de abajo).
5. **Advertencias** — si Preflight encontró algo que no bloquea la exportación pero vale la pena revisar (por ejemplo, una imagen de baja resolución), te pide confirmar que lo viste antes de seguir. Si no hay ninguna advertencia, este paso se salta solo.
6. **Progreso** — una barra de progreso mientras se genera el archivo.
7. **Resultado** — un botón para descargar el archivo (o los archivos, si elegiste PNG con varias hojas).

Podés volver atrás en cualquier momento con "◀ Atrás", o cancelar con "Cancelar" — cerrar el diálogo nunca deja tu proyecto en un estado raro, podés reabrirlo las veces que quieras.

## Mensajes de Preflight — qué significan

Preflight puede mostrarte tres tipos de mensaje:

- **Errores** (bloquean la exportación) — algo tiene que corregirse antes de poder exportar. El mensaje siempre te dice qué está mal y qué hacer. El más común: **"no se encontró la línea de corte"** — significa que tu diseño necesita un object marcado como "línea de corte" (el contorno por donde se va a cortar) y todavía no lo tiene. Si tu diseño es simplemente rectangular, este mensaje no debería aparecer con el perfil "Digital PNG".
- **Advertencias** — no bloquean, pero vale la pena mirarlas. El más común: una imagen que se ve bien en pantalla pero tiene poca resolución para el tamaño final de impresión ("podría verse pixelada").
- **Información** — solo un dato, ej. "esta hoja va a quedar parcialmente ocupada" cuando la cantidad de copias no llena la hoja completa.

## Descargas

- **Print PDF/Digital PNG**: un solo archivo, un solo botón de descarga.
- **Sticker Sheet**: si elegiste PDF, un solo archivo con todas las hojas dentro. Si elegiste PNG, un botón de descarga por cada hoja (cada hoja es una imagen separada — un PNG no puede tener "páginas" como un PDF).
- El nombre del archivo se genera automáticamente a partir del nombre de tu proyecto — hoy no se puede editar dentro del wizard (si querés un nombre distinto, renombrá el proyecto antes de exportar).

## Preguntas frecuentes

**¿Puedo cancelar una exportación mientras está en progreso?** Sí — "Cancelar" en cualquier momento detiene todo y cierra el diálogo de forma segura, sin dejar archivos a medio generar.

**¿El proyecto cambia si exporto?** No — exportar nunca modifica tu diseño. Es completamente seguro exportar tantas veces como quieras.

**¿Qué pasa si cambio algo del diseño mientras el diálogo de exportación está abierto?** Vas a ver un aviso ("El proyecto cambió desde que se abrió este flujo") con un botón para actualizar la exportación con los cambios más recientes — nunca se mezclan silenciosamente una versión vieja y una nueva de tu diseño.

**¿Funciona en cualquier navegador?** Verificado en Chromium (Google Chrome/Microsoft Edge/Brave). Firefox y Safari no están verificados todavía.
