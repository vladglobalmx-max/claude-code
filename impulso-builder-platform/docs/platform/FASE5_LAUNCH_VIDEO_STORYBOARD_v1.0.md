# Video Oficial de Lanzamiento — Storyboard v1.0 (Fase 5)

Estado: **storyboard APROBADO** como base oficial del Video de Lanzamiento v1.0. Las 4 decisiones pendientes de la primera entrega ya están resueltas (ver §7) y quedan reflejadas en el cuerpo de este documento. Sigue pendiente de producir: el video final. Antes de renderizar la versión definitiva, el usuario revisará y aprobará un **animatic/versión preliminar** (ver §9) — nada se renderiza en calidad final sin ese paso intermedio.

Precede a este documento la aprobación formal de **THÖREN Hero v1.0 Final** (congelada, sin más iteraciones estéticas) — el video reutiliza esa Hero como asset de marca, sin recrearla.

---

## 0. Auditoría de consistencia de marca (previa a construir el storyboard)

Antes de escribir una sola escena, se revisó que el mensaje de marca sea el mismo en todo el material comercial ya producido:

| Material | Archivo | Mensaje central |
|---|---|---|
| Hero oficial | `THOREN-Hero-*.png` (v1.0 Final) | "De la idea al producto." — diseñar es fácil, producir es lo que cuesta; THÖREN cierra esa brecha. |
| Página de producto | `docs/platform/RC1_PRODUCT_PAGE.md` | Mismo problema ("diseñar es la parte fácil, preparar el archivo es lo que cuesta tiempo") + mismos 6 pilares: editor completo, exportación real para impresión, Preflight, pago único, offline, sin cuenta. |
| Copy de Gumroad | `docs/platform/GUMROAD_LAUNCH_PLAN.md` | Idéntico problema y pilares, en formato corto (título/subtítulo/bullets). |
| FAQ comercial | `docs/platform/RC1_COMMERCIAL_FAQ.md` | Mismas promesas (pago único, offline, sin cuenta, tus diseños son tuyos) respondidas una por una, sin contradicciones. |
| Documentación del comprador | `apps/sticker-builder/commercial-assets/docs/*.md` | Mismo tono directo y honesto ("no necesitas guardar manualmente", "sin necesitar cuenta"), sin prometer nada que el producto no haga. |
| Correos de soporte | Mencionados en FAQ/página de producto ("respondemos en 2-3 días hábiles") | Consistente; no existe todavía una secuencia de correos de marketing independiente — solo la promesa de soporte, igual en ambos documentos. |

**Resultado: consistente.** El mismo eje narrativo — *"la mayoría de las herramientas están pensadas para diseñar; muy pocas para producir"* — atraviesa Hero, página de producto, Gumroad y FAQ sin contradicciones de precio, alcance o promesas. El storyboard de abajo hereda este mismo eje como Escena 1 (Hook), no inventa un mensaje nuevo.

Único hallazgo (no bloqueante, informativo): no existe aún una plantilla de correo de marketing (bienvenida/lanzamiento) — solo la mención de soporte por correo. Si se planea un correo de anuncio de lanzamiento, debe redactarse a partir del mismo copy corto de Gumroad para no introducir un mensaje nuevo; queda fuera del alcance de Fase 5 (video) salvo que el usuario lo pida explícitamente.

---

## 1. Resumen ejecutivo

| | |
|---|---|
| **Duración total aproximada** | 2:40 (160 segundos) |
| **Formato** | 1920×1080, 16:9, MP4 (H.264), 30fps mínimo (recomendado 60fps para las capturas de pantalla, ver §5) |
| **Narración** | Voz **humana** en español, tono calmado y directo (no vendedor/gritón) — decisión firme, sin TTS para esta versión principal (ver §7.3). Sincronizada con música y texto en pantalla, nunca los tres compitiendo a la vez. |
| **¿Responde las 3 preguntas en los primeros 60s?** | Sí — ver marcador "✔ 60s" en la tabla de la Escena 3. |
| **Interfaces/funciones mostradas** | Únicamente reales, capturadas de la app en ejecución. Cero mockups falsos, cero funciones inexistentes. |
| **Producto físico** | Fotografía/video **real** de stickers impresos sobre productos reales — no se reutiliza ni extiende el ilustrado de la Hero (ver §7.1 y el brief de producción, `FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md`). |
| **Precio/CTA comercial** | No aparece en el video (ver §7.2) — el cierre solo invita a conocer THÖREN; el precio vive en Gumroad/página de venta, donde puede cambiar sin volver obsoleto el video. |
| **Antes del render final** | Obligatorio: animatic/versión preliminar aprobado por el usuario (§9). |

---

## 2. Storyboard completo (tabla maestra)

| # | Escena | Tiempo | Duración | Ritmo |
|---|---|---|---|---|
| 1 | Hook — el problema | 0:00–0:08 | 8s | Estático, una sola toma, sin cortes |
| 2 | Presentación de THÖREN | 0:08–0:20 | 12s | Un corte, reveal lento |
| 3 | Flujo de trabajo — vista rápida | 0:20–1:00 | 40s | Ágil, 1 corte cada 2-4s |
| 4 | Flujo de trabajo — en profundidad | 1:00–1:55 | 55s | Moderado, 1 corte cada 4-6s |
| 5 | Beneficios | 1:55–2:20 | 25s | Pausado, 1 corte cada 6-8s |
| 6 | Cierre | 2:20–2:40 | 20s | Estático, sin cortes |

**Las tres preguntas del hook, resueltas dentro del primer minuto:**
1. *¿Qué problema resuelve?* → Escena 1 (0:00–0:08).
2. *¿Cómo lo resuelve?* → Escena 2 + primera mitad de Escena 3 (0:08–0:55): se ve el flujo completo crear → diseñar → exportar.
3. *¿Qué obtiene el usuario al finalizar?* → cierre de Escena 3 (0:55–1:00): destello de 5s del producto físico terminado, antes del minuto.

La Escena 4 no repite información — profundiza (organizar, Preflight, imposición, acabado del producto) para quien sigue viendo después del minuto 1.

---

## 3. Guion visual escena por escena + guion de narración + texto en pantalla

### Escena 1 — Hook (0:00–0:08)

**Visual:** Fondo Basalto (`#23282B`) a pantalla completa, sin logo todavía. Aparece, centrado, un cursor de mouse inmóvil sobre una captura de un diseño terminado (un sticker de ejemplo, bien resuelto visualmente) — la imagen se ve "lista" en pantalla, pero el cursor no puede hacer nada más con ella; no hay hacia dónde avanzar. Sensación de callejón sin salida, no de error.

**Texto en pantalla** (kinetic typography, aparece palabra por palabra, Familjen Grotesk, blanco sobre Basalto):
> "La mayoría de las herramientas de diseño están pensadas para crear."
> (beat de silencio, 1s)
> "Muy pocas están pensadas para producir."

**Narración (VO):**
> "La mayoría de las herramientas de diseño están pensadas para crear... muy pocas fueron pensadas para producir."

**Animación:** Fade-in del cursor y la imagen (0.6s). El texto entra con un ligero desplazamiento vertical (12px) + fade, sin rebote ni efectos "juguetones". Sin música todavía, o música entrando en silencio absoluto (ver §6).

---

### Escena 2 — Presentación de THÖREN (0:08–0:20)

**Visual:** Corte a la Hero oficial (`THOREN-Hero-Desktop-Light.png`), reveal con leve parallax (la capa de fondo se mueve más lento que el producto/editor en primer plano, 2-3% de desplazamiento — sutil, no un efecto 3D exagerado). El thorn-mark (Þ) y "THÖREN · STICKER BUILDER" aparecen primero, luego el titular.

**Texto en pantalla:** el propio titular de la Hero, ya incluido en la imagen — no se superpone texto adicional encima (evita duplicar información y respeta que la Hero ya es un asset de marca terminado).

**Narración (VO):**
> "THÖREN Sticker Builder es distinto: un editor pensado, desde el primer día, para terminar en un producto real. De la idea... al producto."

**Animación:** Reveal de imagen fija con parallax sutil (no video todavía). Transición de salida: corte directo (no disolvencia) hacia la primera captura real de la app — marca el cambio de "esto es la marca" a "esto es el software funcionando".

---

### Escena 3 — Flujo de trabajo: vista rápida (0:20–1:00) — ✔ resuelve las 3 preguntas antes del minuto

Capturas reales de la app (`localhost:4174` en producción, o el build comercial empaquetado), ritmo ágil, cortes cada 2-4s. Cada paso es una captura de pantalla real editada a velocidad natural o levemente acelerada (1.2-1.5x) para mantener el ritmo sin que se sienta "trucado".

| Tiempo | Paso | Visual | Texto en pantalla |
|---|---|---|---|
| 0:20–0:27 | Crear proyecto | Clic en "Nuevo proyecto" → elegir plantilla | "Elige un tamaño o plantilla" |
| 0:27–0:33 | Elegir template | Selección de plantilla circular (o la usada en la Hero, para continuidad visual) | — |
| 0:33–0:45 | Diseñar | Insertar imagen/texto, mover, ajustar — 2-3 cortes rápidos dentro del propio paso | "Diseña con precisión" |
| 0:45–0:55 | Exportar | Clic en "Exportar para impresión" → Preview con sangrado/marcas de corte visibles | "Listo para tu imprenta" |
| 0:55–1:00 | *(destello)* Producto físico | Corte breve (5s) al producto físico terminado — el mismo tratamiento visual que la Hero (ver §4, nota de continuidad) | "Esto es lo que obtienes." |

**Narración (VO), continua sobre los 4 pasos:**
> "Creas tu proyecto, eliges una plantilla, diseñas con precisión... y exportas un archivo real, listo para imprenta. Esto es lo que obtienes."

**Animación:** Cursor con un resaltado sutil (halo Ember de baja opacidad) en cada clic importante, para que el ojo del espectador nunca pierda dónde está la acción — sin flechas ni círculos añadidos en post, el halo vive en la propia UI (ya existe como estado `:hover`/`:focus` en la app; no se fabrica nada nuevo).

---

### Escena 4 — Flujo de trabajo en profundidad (1:00–1:55)

Mismo tratamiento de capturas reales, ritmo ahora más pausado (1 corte cada 4-6s) — el espectador que llegó hasta aquí ya está convencido de la promesa; esta escena construye confianza técnica.

| Tiempo | Paso | Visual | Texto en pantalla |
|---|---|---|---|
| 1:00–1:12 | Organizar | Uso de capas, alineación y guías inteligentes (Smart Guides) alineando 2-3 elementos | "Todo alineado, sin esfuerzo" |
| 1:12–1:25 | Revisión automática | Preflight detectando y resolviendo un aviso real (ej. elemento fuera del área segura) | "Preflight revisa antes de exportar" |
| 1:25–1:38 | Imposición en hoja | Wizard de exportación para impresión, paso de imposición mostrando varias copias en una hoja | "Varias copias, una sola hoja" |
| 1:38–1:55 | Producto físico terminado | Toma más larga y detallada del producto físico (mismo tratamiento que la Hero), esta vez sin prisa — el "pago" visual de toda la escena | "De la idea al producto." |

**Narración (VO):**
> "Organiza tu diseño con guías inteligentes. Antes de exportar, una revisión automática te avisa si algo no está listo — nunca te enteras del error con la imprenta ya reclamando. Eliges cuántas copias caben en una hoja, y exportas un archivo que tu imprenta puede usar tal cual. De la idea... al producto."

**Animación:** Sin efectos añadidos más allá de zooms suaves (ken-burns, 3-5% por toma) sobre las capturas para dar sensación de movimiento sin cortar en exceso.

---

### Escena 5 — Beneficios (1:55–2:20)

**Visual:** Fondo Stone (`#EDEAE2`) a pantalla completa. Cuatro frases aparecen una a la vez, centradas, tipografía grande (Familjen Grotesk, ~56px), cada una sola en pantalla durante ~6s antes de dar paso a la siguiente — nunca las 4 juntas (respeta "mucho espacio negativo").

**Texto en pantalla (una frase a la vez):**
1. "Menos tiempo preparando archivos."
2. "Un flujo pensado para producción, no solo para diseño."
3. "Archivos que tu imprenta acepta a la primera."
4. "Proyectos organizados, listos cuando los necesitas."

**Narración (VO):**
> "Menos tiempo preparando archivos. Un flujo pensado para producción, no solo para diseño. Archivos que tu imprenta acepta a la primera. Y tus proyectos, siempre organizados."

**Animación:** Cada frase entra con fade + leve escala (98%→100%), sale con fade simple. Sin transiciones llamativas — esta escena es la más "Notion/Linear" de todo el video: tipografía sola, mucho aire.

---

### Escena 6 — Cierre (2:20–2:40)

**Visual:** Vuelve la Hero oficial (misma imagen que la Escena 2, para cerrar el círculo visual), esta vez con un fade suave hacia el lockup final: thorn-mark + "THÖREN Sticker Builder", tagline debajo.

**Texto en pantalla:**
> "De la idea al producto."
> THÖREN Sticker Builder
> Conoce THÖREN Sticker Builder.

Decisión firme (§7.2): **sin precio ni CTA de compra/Gumroad en el video.** El cierre invita únicamente a conocer el producto — el precio se comunica en Gumroad y en la página de venta, donde puede actualizarse sin que el video quede desactualizado o atado a una oferta de lanzamiento.

**Narración (VO):**
> "THÖREN Sticker Builder. De la idea al producto."

**Animación:** Fade-in del lockup final sobre la Hero (sin parallax esta vez — quietud total, como cierre). Últimos 2s en silencio de narración, solo música resolviendo.

---

## 4. Lista de recursos necesarios

### Assets ya existentes (reutilizables sin producir nada nuevo)
- `THOREN-Hero-Desktop-Light.png` (Escenas 2 y 6).
- Capturas reales ya generadas en Fase RC1 (`01-mis-proyectos.png`, `02-editor.png`, `03-exportar-rapido.png`, `04-exportar-impresion-perfil.png`) — sirven de referencia de encuadre, pero deben regrabarse en video (no como foto fija) para las Escenas 3 y 4.

### Grabaciones nuevas necesarias (capturas de pantalla reales, screen recording)
1. Flujo completo "Nuevo proyecto → elegir plantilla" (Escena 3).
2. Sesión de diseño real: insertar imagen/texto, mover, ajustar (Escenas 3-4) — usar un diseño de marca ficticia consistente con el ya aprobado en la Hero (VELARA) para que el video se sienta parte del mismo mundo visual que la Hero, no una marca nueva sin relación.
3. Wizard de "Exportar para impresión": perfil → Preview con sangrado/marcas de corte (Escena 3).
4. Uso de capas/alineación/Smart Guides (Escena 4).
5. Preflight detectando y resolviendo un aviso real (Escena 4) — requiere preparar deliberadamente un proyecto con un problema real de preflight para capturarlo (no fabricar un mensaje falso).
6. Wizard de imposición en hoja, paso de Preview con varias copias (Escena 4).

### Recurso pendiente de producción humana (decisión ya tomada, ver §7.1)
- **Producto físico terminado** (Escenas 3 y 4): decisión firme — **fotografía/video real** de stickers impresos aplicados a productos reales (botella de skincare, frasco cosmético, caja premium, laptop, empaque artesanal). No se reutiliza ni extiende el tratamiento CSS ilustrado de la Hero — esa Hero ya cumplió su función de marca; el video debe aumentar credibilidad con producto auténtico, no con otra ilustración. Ver el brief de producción completo en `FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md` (impresión, productos a conseguir, ángulos, iluminación, estilo).

### Audio
- Pista musical: por ahora solo referencia creativa de estilo (§6) — **no se integra ningún archivo con licencia todavía**. La plataforma (Artlist, Epidemic Sound u otra) se evalúa y contrata en el momento de producir el video final, no antes.
- Voz en off: **locutor humano**, español neutro, tono calmado — no TTS para esta versión principal (§7.3). Voces generadas por IA quedan abiertas a evaluación futura solo si se producen versiones en otros idiomas.

---

## 5. Especificación técnica de captura

- Resolución de grabación de pantalla: 1920×1080 mínimo, ratón visible, cursor con el halo de interacción nativo de la app (no agregar flechas/círculos en post).
- Framerate de grabación: 60fps (permite luego hacer slow-motion o speed-ramps sin artefactos, aunque el video final se entregue a 30fps).
- Igual que en la Hero: usar el preset de zoom fijo "200%" dentro del editor en vez de "Ajustar a pantalla" (bug conocido de la app: "Ajustar a pantalla" ancla el contenido desde su esquina superior-izquierda pre-zoom y puede desbordar el viewport a multiplicadores altos — documentado en el proceso de construcción de la Hero).
- Todas las capturas deben ser de la build comercial real o del entorno de desarrollo funcionalmente idéntico — cero mockups de Figma/Canva simulando la UI.

---

## 6. Música sugerida

No se recomienda una pista específica con copyright sin conocer la librería/licencia disponible (Epidemic Sound, Artlist, Musicbed u otra). Especificación de estilo, para buscar o encargar:

- **Género:** instrumental minimalista — piano suave, pad sintetizado o cuerdas simples. Sin voz, sin percusión prominente al inicio.
- **Tempo:** 80-100 BPM, sensación de calma y confianza (no urgencia, no "hype").
- **Arco dinámico:** entra casi en silencio en la Escena 1 (o directamente en silencio, dejando que el VO respire solo), crece levemente en la Escena 2 (reveal de marca), mantiene un colchón estable durante el Flujo de trabajo (Escenas 3-4) sin robarle protagonismo al VO, sube un poco más en Beneficios (Escena 5) y resuelve/cierra en la Escena 6 con un acorde final que coincide con el último fotograma.
- **Referencias de mood** (no de pista exacta): el tipo de música de fondo en videos de producto de Notion, Linear o Arc Browser — cálida pero contenida, nunca dramática.

---

## 7. Decisiones resueltas (aprobadas por el usuario)

### 7.1 Producto físico
**Fotografía/video real**, no ilustrado. Stickers reales impresos y aplicados sobre productos reales — botella de skincare, frasco cosmético, caja premium, laptop, empaque artesanal. La Hero ya cumplió su función de marca; el video existe para aumentar credibilidad, y una segunda pieza ilustrada no lo lograría. Brief de producción completo: `FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md`.

### 7.2 Precio
**No aparece en el video.** El precio puede cambiar y el video debe seguir siendo válido durante años sin reeditarse. El cierre (Escena 6) invita únicamente a conocer THÖREN; el precio vive en Gumroad y en la página de venta.

### 7.3 Locución
**Voz humana**, no sintética. Aunque la calidad de TTS ha mejorado, la primera impresión de THÖREN debe transmitir cercanía, confianza y calidad. Voces generadas por IA quedan abiertas a evaluación futura únicamente si se producen versiones en otros idiomas — la pieza principal en español debe sentirse humana.

### 7.4 Música
**Solo referencia creativa por ahora** (§6: género, tempo, arco dinámico, mood). No se compromete ninguna librería ni archivo con licencia en esta fase — la plataforma (Artlist, Epidemic Sound u otra) se evalúa y contrata al momento de producir el video final.

---

## 8. Qué falta para pasar de este storyboard al video terminado

Fuera de alcance de este documento (requiere producción humana/herramientas de edición de video, no generable por este proceso):
- Sesión de fotografía/video real de producto físico (`FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md`).
- Grabación de las capturas de pantalla listadas en §4 (en curso — ver §9, se preparan como parte de los recursos de producción y del animatic).
- Grabación de la voz en off humana a partir del guion de narración de la sección 3 (ya completo y listo para grabar tal cual).
- Contratación de música con licencia, una vez decidida la plataforma.
- Edición final: montaje, corrección de color, mezcla de audio, exportación.

Este documento deja listo: la estructura completa, los tiempos, el guion de narración palabra por palabra, el texto en pantalla exacto, el guion visual escena por escena, la lista de recursos y las especificaciones de estilo — todo lo que se puede decidir y escribir antes de tocar una herramienta de edición.

---

## 9. Animatic / versión preliminar (gate obligatorio antes del render final)

Antes de producir el Video Oficial de Lanzamiento v1.0 en calidad final, el usuario revisará un **animatic**: una versión preliminar de baja fidelidad que valida ritmo, tiempos, transiciones, narrativa y claridad del mensaje — no busca calidad visual final.

Composición del animatic (mientras la producción real de fotografía/locución/música no está lista):
- **Capturas de pantalla reales** de la app en ejecución para las Escenas 3-4 (mismo software, mismo flujo — esto sí es real, no un placeholder).
- **Hero oficial** para las Escenas 2 y 6 (asset final, ya aprobado).
- **Tarjetas de marcador de posición** explícitas ("PENDIENTE: fotografía real de producto físico") en los huecos de las Escenas 3-4 y 6 donde iría el producto físico — para no fingir un resultado que todavía no existe.
- **Subtítulos en pantalla** con el guion de narración completo (§3), en lugar de una voz grabada — permite validar tiempos y sincronía sin esperar al locutor.
- **Sin música** (o un lecho silencioso de referencia) — la música es la última pieza en integrarse, después de aprobado el animatic.

Solo después de que el usuario apruebe explícitamente el animatic se autoriza: contratar locución humana, gestionar la sesión de fotografía real, licenciar música, y producir el render final del Video Oficial de Lanzamiento v1.0.
