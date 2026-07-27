# Lista técnica de entrega — Fase 5 (Video Oficial de Lanzamiento v1.0)

Estado de Fase 5 al momento de este documento: **Storyboard APROBADO. Animatic v2 APROBADO Y CONGELADO. Capturas reales del software COMPLETAS. Hero oficial CONGELADA. Render final PENDIENTE DE PRODUCCIÓN HUMANA.**

Este documento es **únicamente una lista técnica de entrega** — no reabre ninguna decisión de storyboard, animatic, ritmo, mensajes en pantalla o estructura. Su único propósito: que cuando se entreguen los 4 recursos pendientes (fotografía/video de producto físico, secuencia archivo→impresión→aplicación, locución humana, música con licencia), puedan integrarse al montaje final **sin ambigüedad y sin una nueva ronda de planeación**.

No se produce el render final a partir de este documento. Fase 5 queda detenida después de esta entrega, a la espera de los 4 recursos y de nuevas instrucciones.

---

## 1. Referencia — línea de tiempo aprobada (animatic v2, 2:50 / 170s)

Esta es la única línea de tiempo válida. Todas las duraciones de abajo son las **ya aprobadas y congeladas** — no se recalculan al integrar los recursos reales.

| # | Escena | Inicio | Duración | Relleno actual en el animatic | Se reemplaza por |
|---|---|---|---|---|---|
| 1 | Hook | 0:00 | 8s | Tarjeta de texto | (nada — se queda igual, solo se le agrega música/VO) |
| 2 | Presentación THÖREN | 0:08 | 12s | Hero oficial + texto | (nada — se queda igual) |
| 3a | Crear proyecto | 0:20 | 7s | Captura real de pantalla | (nada — captura ya final) |
| 3b | Elegir plantilla | 0:27 | 6s | Captura real de pantalla | (nada — captura ya final) |
| 3c | Diseñar | 0:33 | 12s | Captura real de pantalla | (nada — captura ya final) |
| 3d | Exportar | 0:45 | 10s | Captura real de pantalla | (nada — captura ya final) |
| 3e | Destello producto físico | 0:55 | 5s | Tarjeta placeholder | **Recurso 1** (video, ver §4.1) |
| 4a | Organizar | 1:00 | 12s | Captura real de pantalla | (nada — captura ya final) |
| 4b | Preflight | 1:12 | 13s | Captura real de pantalla | (nada — captura ya final) |
| 4c | Imposición en hoja | 1:25 | 13s | Captura real de pantalla | (nada — captura ya final) |
| 4d | Producto físico detallado | 1:38 | 17s | Tarjeta placeholder | **Recurso 1** (video, ver §4.1) |
| 5-1..4 | Beneficios (4 frases) | 1:55 | 25s (~6.25s c/u) | Tarjetas de texto | (nada — se queda igual) |
| 5.5 | Del archivo a la impresión | 2:20 | 10s | Tarjeta placeholder | **Recurso 2** (video/foto, ver §4.2) |
| 6 | Cierre | 2:30 | 20s | Hero oficial + texto | (nada — se queda igual; inserto opcional de producto, ver §4.1) |

**Audio** (no tiene entrada propia en la tabla — corre en paralelo a las 170s completas):
- **Recurso 3**: locución humana, un solo archivo continuo de 0:00 a 2:50, sincronizado al guion de narración por escena (guion completo en `FASE5_LAUNCH_VIDEO_STORYBOARD_v1.0.md`, sección 3 — reproducido también en §5 de este documento para no tener que cruzar documentos).
- **Recurso 4**: música, un solo archivo continuo de 0:00 a 2:50 (o hasta donde la licencia lo permita, con fade-out antes del corte).

---

## 2. Estructura de carpetas de entrega

Entregar los 4 recursos exactamente en esta estructura (nombres de carpeta literales, en minúsculas):

```
fase5-recursos-entrega/
├── 01-producto-fisico/
│   ├── escena-3e-destello/
│   ├── escena-4d-detallado/
│   └── escena-6-opcional/          (solo si se decide usar el inserto opcional)
├── 02-impresion-aplicacion/
│   ├── archivo-exportado/
│   ├── impresion/
│   └── aplicacion/
├── 03-locucion/
└── 04-musica/
```

Cada subcarpeta contiene el material bruto (varias tomas/tomas de respaldo son bienvenidas — más vale de sobra que de menos); no es necesario pre-seleccionar ni editar antes de entregar.

---

## 3. Convención de nombres de archivo

Patrón: `THOREN-Video-<Escena>-<Descripcion>-<Numero>.<ext>`

Ejemplos concretos esperados:
- `THOREN-Video-Escena3e-Destello-01.mp4`, `...-02.mp4` (varias tomas de respaldo)
- `THOREN-Video-Escena4d-Detallado-01.mp4`
- `THOREN-Video-Escena6-Opcional-01.mp4` (o `.jpg` si es foto fija)
- `THOREN-Video-ArchivoExportado-01.mp4` / `.jpg`
- `THOREN-Video-Impresion-01.mp4`
- `THOREN-Video-Aplicacion-01.mp4`
- `THOREN-Audio-Locucion-Master.wav`
- `THOREN-Audio-Musica-Master.wav` (o `.mp3` si la licencia solo entrega ese formato)

No es necesario renombrar antes de entregar — si el nombre no sigue el patrón, indicar en un mensaje de texto simple qué archivo corresponde a qué escena. El patrón es para minimizar preguntas de ida y vuelta, no un requisito bloqueante.

---

## 4. Especificaciones por tipo de recurso

### 4.1 Recurso 1 — Fotografía/video de producto físico (Escenas 3e, 4d, 6-opcional)

| Campo | Especificación |
|---|---|
| Formato de video | MP4 (H.264) o MOV (ProRes/H.264) — cualquiera de los dos se acepta |
| Formato de foto (si se usa foto fija en vez de video) | JPEG o PNG, sin compresión agresiva |
| Resolución mínima | 1920×1080. Preferido: 3840×2160 (4K) — da margen para recortar/estabilizar en edición sin perder nitidez |
| Orientación | **Horizontal (16:9)** — el master del video es 16:9; metraje vertical no se acepta sin recorte, y recortar un vertical a 16:9 pierde resolución útil |
| Framerate (video) | 24, 25 o 30fps — cualquiera sirve, pero usar el mismo framerate en todas las tomas de una misma escena |
| Duración mínima por toma | Ver tabla de abajo — siempre más larga que el hueco final, para tener margen de recorte/sincronía |
| Color/exposición | Sin corrección de color aplicada — entregar metraje plano/nativo de cámara; la corrección de color se hace en la edición final, sobre todo el material a la vez, para que las tomas combinen entre sí |

**Duración mínima de grabación por toma** (más larga que el hueco final para dar margen de edición):

| Escena | Hueco final en el animatic | Grabar como mínimo |
|---|---|---|
| 3e — Destello producto físico | 5s | 8s |
| 4d — Producto físico detallado | 17s | 22s |
| 6 — Inserto opcional en el cierre | 2-4s (opcional, no obligatorio) | 6s |

Dirección de fotografía/estilo (ángulos, iluminación, productos a usar): ya especificada en `FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md` — no se repite aquí, ese documento sigue siendo la referencia de dirección creativa. Este documento solo cubre especificación técnica de archivo.

### 4.2 Recurso 2 — Secuencia archivo exportado → impresión → aplicación (Escena 5.5)

Mismas especificaciones técnicas que §4.1 (formato, resolución, orientación, framerate). Son 3 momentos distintos, cada uno puede entregarse como clip separado:

| Momento | Hueco aproximado dentro de los 10s de la Escena 5.5 | Grabar como mínimo | Tipo sugerido |
|---|---|---|---|
| Archivo exportado (visible en pantalla o impreso) | ~0-3s | 5s | Foto o video corto |
| Impresión (saliendo de impresora / en la hoja) | ~3-6s | 5s | Video (el movimiento ayuda) |
| Aplicación del sticker sobre el producto | ~6-10s | 6s | Video |

Los 3 momentos se recortan y unen en un solo corte durante la edición final — no es necesario que el material entregado ya venga cortado a esa duración exacta.

### 4.3 Recurso 3 — Locución humana (todas las escenas, pista continua)

| Campo | Especificación |
|---|---|
| Formato | WAV, sin comprimir (preferido) — MP3 320kbps aceptable si WAV no está disponible |
| Sample rate / bit depth | 48kHz / 24-bit (o 44.1kHz / 16-bit como mínimo aceptable) |
| Canales | Mono (una sola voz, no necesita estéreo) |
| Entrega | **Un solo archivo continuo** que siga el guion completo en orden (§5 de este documento), grabado con pausas naturales entre escenas — no es necesario grabar frase por frase en archivos separados; la edición final ajusta la sincronía fina |
| Duración de referencia | El guion completo, leído a ritmo calmado, debería rondar 2:00-2:30 de audio hablado neto dentro de los 2:50 totales del video (dejando aire para los momentos sin narración: Beneficios puede llevar pausas entre frases, Escenas 3e/4d/5.5/6 pueden ir con menos VO y más música/ambiente) |
| Ruido de fondo | Grabar en un espacio silencioso, sin eco — no se aplica limpieza de audio antes de entregar, eso se hace en la mezcla final |

### 4.4 Recurso 4 — Música con licencia (pista continua, toda la duración)

| Campo | Especificación |
|---|---|
| Formato | WAV o MP3 320kbps |
| Duración | 2:50 (170s) mínimo, o más larga si se prefiere recortar en edición — nunca más corta |
| Canales | Estéreo |
| Especificación de estilo/arco dinámico | Ya definida en `FASE5_LAUNCH_VIDEO_STORYBOARD_v1.0.md` §6 (instrumental minimalista, 80-100 BPM, arco dinámico por escena) — no se repite aquí |
| Licencia | Entregar también el comprobante/certificado de licencia de la plataforma usada (Artlist, Epidemic Sound u otra) junto con el archivo de audio, para tener el respaldo de uso comercial archivado con el proyecto |

---

## 5. Guion de narración completo (referencia rápida para grabar, ya aprobado — sin cambios)

Reproducido tal cual de `FASE5_LAUNCH_VIDEO_STORYBOARD_v1.0.md` §3, en orden, para que la sesión de locución no necesite abrir un segundo documento:

1. **(0:00-0:08)** "La mayoría de las herramientas de diseño están pensadas para crear... muy pocas fueron pensadas para producir."
2. **(0:08-0:20)** "THÖREN Sticker Builder es distinto: un editor pensado, desde el primer día, para terminar en un producto real. De la idea... al producto."
3. **(0:20-1:00)** "Creas tu proyecto, eliges una plantilla, diseñas con precisión... y exportas un archivo real, listo para imprenta. Esto es lo que obtienes."
4. **(1:00-1:55)** "Organiza tu diseño con guías inteligentes. Antes de exportar, una revisión automática te avisa si algo no está listo — nunca te enteras del error con la imprenta ya reclamando. Eliges cuántas copias caben en una hoja, y exportas un archivo que tu imprenta puede usar tal cual. De la idea... al producto."
5. **(1:55-2:20)** "Menos tiempo preparando archivos. Un flujo pensado para producción, no solo para diseño. Archivos que tu imprenta acepta a la primera. Y tus proyectos, siempre organizados."
6. **(2:20-2:30)** "El mismo archivo que exportaste... es el que tu imprenta usa. Sin conversiones, sin sorpresas."
7. **(2:30-2:50)** "THÖREN Sticker Builder. De la idea al producto."

---

## 6. Qué pasa después de esta entrega

1. El usuario produce/gestiona los 4 recursos (fuera de Claude Code).
2. El usuario entrega los archivos siguiendo la estructura de carpetas y nombres de §2-3 (o avisa qué archivo corresponde a qué escena si los nombres no coinciden).
3. Se integran al montaje sobre la línea de tiempo ya congelada de §1 — sin reabrir ritmo, duración, mensajes en pantalla ni estructura.
4. Se produce el render final del Video Oficial de Lanzamiento v1.0.

Fase 5 queda detenida aquí. A la espera de los 4 recursos y de nuevas instrucciones.
