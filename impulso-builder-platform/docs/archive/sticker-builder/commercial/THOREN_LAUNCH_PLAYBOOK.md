> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento describía la estrategia/plan comercial de Sticker Builder como producto independiente — modelo descartado tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico e insumo de referencia, no como fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# THÖREN Launch Playbook v1.0

**Alcance: exclusivamente ejecución operativa de lanzamiento.** Este documento no modifica la arquitectura, no modifica el roadmap (técnico ni comercial), no modifica código. Documenta el proceso oficial y accionable de lanzamiento comercial de THÖREN — qué assets existen, cuáles faltan, en qué orden se ejecutan, y con qué checklist se valida cada paso. Es un documento operativo, no un documento de decisión: no autoriza publicar nada por sí mismo — esa autorización sigue siendo, como ya lo establece `GUMROAD_LAUNCH_PLAN.md` y el cierre de RC1, una decisión humana explícita y separada.

Este documento consolida y organiza por canal el trabajo ya producido en `GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RC1_COMMERCIAL_FAQ.md`, `RC1_DEMO_SCRIPT_AND_ASSETS.md` y `RC1_POST_LAUNCH_PLAN.md` — no repite ese contenido palabra por palabra, lo referencia y le da estructura de ejecución día a día. Donde este documento agrega contenido nuevo (Emails, Social Media, Calendario), lo marca explícitamente como nuevo.

---

## 0. Estado real al momento de este documento

RC1 (Release Candidate 1.0) del software está cerrado y validado de punta a punta — build reproducible, checksums verificados, instalación/actualización/backup probados, branding revisado, capturas oficiales tomadas, copy largo/corto y comparativa listos, FAQ comercial lista, checklist de publicación consolidado. **Nada de esto ha sido publicado.** La Template Library (Epic 9) tiene 35 de 63 templates completados en especificación de diseño (Batch 01-07), ninguno todavía en producción real de assets (`THOREN_ASSET_PRODUCTION_GUIDE.md` Etapas 2-6 pendientes). Este Playbook asume ambos estados como punto de partida real — no asume que algo está más avanzado de lo que está.

---

## 1. Assets de lanzamiento — inventario maestro

Consolidación de todo lo que un lanzamiento necesita, con su estado real:

| Asset | Estado | Fuente |
|---|---|---|
| Copy corto (subtítulo Gumroad) | ✅ Listo | `GUMROAD_LAUNCH_PLAN.md` |
| Copy largo (cuerpo de página) | ✅ Listo | `RC1_PRODUCT_PAGE.md` |
| Lista de beneficios (bullets) | ✅ Listo | `RC1_PRODUCT_PAGE.md` |
| Comparativa (flujo manual vs. THÖREN) | ✅ Listo | `RC1_PRODUCT_PAGE.md` |
| Casos de uso + público objetivo | ✅ Listo | `RC1_PRODUCT_PAGE.md` |
| Objeciones frecuentes | ✅ Listo | `RC1_PRODUCT_PAGE.md` |
| FAQ comercial completo | ✅ Listo | `RC1_COMMERCIAL_FAQ.md` |
| Capturas oficiales (4 capturas de producto) | ✅ Listas (`01-mis-proyectos.png`, `02-editor.png`, `03-exportar-rapido.png`, `04-exportar-impresion-perfil.png`) | `RC1_DEMO_SCRIPT_AND_ASSETS.md` |
| Guion de video demo (30-45s) | ✅ Guion listo, video sin grabar | `RC1_DEMO_SCRIPT_AND_ASSETS.md` |
| Imagen de portada/hero compuesta | ❌ Pendiente — requiere diseño gráfico humano | `RC1_DEMO_SCRIPT_AND_ASSETS.md` (§ punto 5) |
| Ícono/logo de miniatura de Gumroad | ❌ Pendiente — requiere diseño gráfico humano | `RC1_DEMO_SCRIPT_AND_ASSETS.md` (§ punto 6) |
| Precio y estrategia de precio de lanzamiento | ✅ Decidido ($29/$19) | `GUMROAD_LAUNCH_PLAN.md` |
| Checklist de publicación | ✅ Listo | `GUMROAD_LAUNCH_PLAN.md` |
| Checklist post-publicación | ✅ Listo | `RC1_POST_LAUNCH_PLAN.md` |
| Mockups/thumbnails de templates de la Template Library | ❌ Pendiente — 0 de 63 en producción real | `THOREN_ASSET_PRODUCTION_GUIDE.md` |
| Secuencia de emails de lanzamiento | ❌ Nuevo — este documento, §5 | — |
| Calendario de social media | ❌ Nuevo — este documento, §6 | — |

**Los dos únicos bloqueadores reales de assets para el lanzamiento del software son la imagen de portada y el ícono de miniatura** — ambos ya identificados en RC1 como trabajo de diseño gráfico humano fuera del alcance de generación automatizada. Todo lo demás para el software está listo.

---

## 2. Landing / Bookfluence

- **Rol en el funnel**: landing/marketing propio que enlaza hacia Gumroad para checkout (decisión ya tomada, `V1_COMMERCIAL_RECOMMENDATION.md` §5, decisión #2) — Bookfluence no procesa pago, solo presenta el producto y dirige tráfico.
- **Contenido a publicar**: el mismo copy largo/corto de `RC1_PRODUCT_PAGE.md`, adaptado al formato de la landing (no reescrito desde cero — mismo mensaje, mismo posicionamiento, para no fragmentar la narrativa entre canales).
- **Checklist específico de landing**:
  - [ ] Botón de CTA principal apunta al link de Gumroad correcto (verificar antes de cada publicación, un link roto en el CTA principal invalida todo lo demás).
  - [ ] Las 4 capturas oficiales están embebidas y se ven correctamente en desktop y móvil.
  - [ ] El precio mostrado en landing coincide exactamente con el precio real de Gumroad en todo momento (evitar desincronización si el precio de lanzamiento expira).
  - [ ] SEO básico: título de página, meta descripción y palabras clave usan el mismo copy corto ya aprobado (`GUMROAD_LAUNCH_PLAN.md`), sin inventar mensajes nuevos.

---

## 3. Gumroad

- **Checklist de publicación** (ya consolidado en `GUMROAD_LAUNCH_PLAN.md` §4 — referenciado aquí, no repetido campo por campo): precio configurado ($19 lanzamiento / $29 catálogo), copy corto y largo cargados, capturas subidas, archivo/ZIP final adjunto con checksum verificado.
- **Checklist post-publicación** (ya consolidado en `RC1_POST_LAUNCH_PLAN.md` — referenciado aquí): página visible en incógnito, compra de prueba real con verificación de checksum, email de confirmación de Gumroad revisado, copy/capturas revisados en desktop y móvil, email de soporte (`soporte@bookfluence.shop`) confirmado como monitoreado, copia de respaldo del ZIP exacto publicado guardada fuera del repositorio.
- **Regla de precio de lanzamiento**: la ventana de $19 dura 2 semanas o 50 compradores, lo que ocurra primero (`GUMROAD_LAUNCH_PLAN.md`) — el Calendario (§7) marca el día exacto de transición a $29 una vez que se conozca la fecha real de publicación.

---

## 4. Video

- **Guion**: ya completo y listo para grabar (`RC1_DEMO_SCRIPT_AND_ASSETS.md`), 30-45 segundos, sin narración obligatoria, estructurado en 6 bloques de tiempo (apertura del launcher → nuevo proyecto → edición rápida → autosave → exportación con Preview de imposición → descarga de PDF → cierre con precio/link).
- **Estado**: guion aprobado, grabación pendiente (requiere ejecución humana con un proyecto de ejemplo ya preparado, según nota del guion: "diseño simple, de alto contraste, reconocible como sticker").
- **Checklist de producción de video**:
  - [ ] Preparar el proyecto de ejemplo antes de grabar (no perder tiempo de grabación con cargas reales).
  - [ ] Grabar en 1280×720 o 1920×1080, formato MP4, bajo 60 segundos.
  - [ ] Agregar música de fondo + texto superpuesto (sin narración obligatoria, según el guion).
  - [ ] Verificar que el texto en pantalla de cada bloque coincide con el guion aprobado, sin improvisar mensajes nuevos.
  - [ ] Subir a Gumroad y, si aplica, usarlo también como primer contenido de Social Media (§6).

---

## 5. Emails (nuevo — no existía como plan estructurado antes de este documento)

THÖREN no tiene lista de correo propia todavía en V1 (sin cuentas, sin backend — ADR-0028) — el único canal de email real hoy es transaccional (confirmación de compra de Gumroad, ya gestionada por Gumroad mismo) y el correo de soporte (`soporte@bookfluence.shop`, ya activo). Este Playbook documenta 2 tipos de email que sí son responsabilidad directa de THÖREN, aunque no exista todavía infraestructura de envío masivo:

| Tipo de email | Cuándo se envía | Contenido |
|---|---|---|
| **Respuesta de soporte** | Reactivo, ante cada mensaje de comprador | Proceso ya definido en `RC1_POST_LAUNCH_PLAN.md` §"Plan para recibir y procesar feedback" — respuesta individual, registro de problemas reales reportados |
| **Aviso de disponibilidad de Template Library (v1.1)** | Una sola vez, cuando v1.1 esté listo para publicarse | A los compradores existentes identificables vía el historial de Gumroad (el vendedor puede enviar un update a compradores desde el propio panel de Gumroad — no requiere lista de correo propia de THÖREN) — mensaje corto: "tu Sticker Builder ahora incluye 63 templates profesionales, sin costo adicional", coherente con `THOREN_PRODUCT_STRATEGY.md` §11.3 |

**No se planea** una secuencia de email marketing multi-mensaje (nurture sequence, drip campaign) en V1 — construir esa infraestructura sin lista de correo propia ni evidencia de que aporta conversión adicional violaría el mismo principio YAGNI ya aplicado en toda la fase comercial (`docs/product/05-Technical-Debt.md`).

---

## 6. Social Media (nuevo)

### 6.1 Principio rector

Sin presupuesto de ads pagados asumido en este documento (no fue parte de ninguna decisión previa) — el plan de Social Media es orgánico, de bajo esfuerzo, reutilizando los assets que ya existen (capturas, video cuando esté grabado) en vez de producir contenido nuevo desde cero para cada plataforma.

### 6.2 Calendario de contenido de lanzamiento (orgánico, plataforma-agnóstico)

| Momento | Contenido | Asset que reutiliza |
|---|---|---|
| Día de lanzamiento | Post de anuncio: "Ya está disponible THÖREN Sticker Builder" + link a Gumroad | Copy corto (`GUMROAD_LAUNCH_PLAN.md`) + captura 02-editor.png |
| Día +1 a +3 | Post mostrando el flujo de exportación/Preflight (el diferenciador real del producto) | Captura 04-exportar-impresion-perfil.png |
| Día +3 a +5 | Video demo (una vez grabado) | Video de §4 |
| Día +5 a +7 | Post de "antes/después" usando la comparativa ya escrita | Tabla comparativa de `RC1_PRODUCT_PAGE.md` |
| Cuando exista primera reseña real | Repost/captura de la reseña (con permiso implícito de una reseña pública en Gumroad) | Reseña real, nunca fabricada |
| Al publicarse v1.1 (Template Library) | Post mostrando 3-4 templates reales terminados por categoría | Thumbnails reales producidos (`THOREN_ASSET_PRODUCTION_GUIDE.md` Etapa 5) — **nunca publicar mockups de especificación como si fueran producto terminado** |

### 6.3 Regla de honestidad de contenido (transversal)

Ningún post de Social Media muestra un asset que no exista realmente todavía — la Template Library no se promociona con las descripciones de `TEMPLATE_CATALOG_v1.md` como si fueran capturas reales del producto; se promociona solo cuando los thumbnails/mockups reales de `THOREN_ASSET_PRODUCTION_GUIDE.md` existan. Esta regla es consistente con la ya aplicada en `RC1_PRODUCT_PAGE.md`: "las capturas y la descripción reflejan honestamente el producto real, sin exagerar capacidades".

---

## 7. Marketing (nuevo — consolidación de canal, no un plan de medios pagados)

| Canal | Rol | Estado |
|---|---|---|
| Comunidades de sellers (foros de Etsy, grupos de "print on demand") | Adquisición orgánica dirigida al ICP central (§1 de `THOREN_PRODUCT_STRATEGY.md`) | No ejecutado — requiere identificar comunidades específicas activas al momento del lanzamiento real, no listadas de antemano en este documento para no quedar obsoletas |
| Búsqueda orgánica (SEO de landing) | Captura de intención específica ("cómo exportar sticker para imprenta") | Depende de que la landing (§2) esté indexada — no hay presupuesto de SEO pagado asumido |
| Boca a boca entre productores de mercado/feria | Adquisición del segmento "emprendedor de feria/mercado artesanal" | No accionable directamente por THÖREN — se beneficia indirectamente de que el producto cumpla su promesa (mismo principio que RC1: "las capturas... reflejan honestamente el producto real") |
| Redes de diseño freelance | Adquisición del segmento "diseñador freelance" | Mismo criterio que comunidades de sellers — ejecución al momento del lanzamiento, no planificación anticipada de comunidades específicas |

**Este documento no compromete presupuesto de marketing pagado** — ninguna decisión previa (ADR ni `THOREN_PRODUCT_STRATEGY.md`) autorizó gasto en ads, y agregarlo aquí sin esa autorización excedería el alcance operativo de un Playbook.

---

## 8. Calendario de lanzamiento

Calendario relativo (día 0 = día de autorización humana de publicación — este documento no asume ni propone una fecha de calendario real, coherente con la disciplina ya aplicada en `ROADMAP_TEMPLATE_SYSTEM.md` y `THOREN_PRODUCT_STRATEGY.md` de no comprometer fechas):

| Día | Acción |
|---|---|
| Día -N (antes de día 0) | Producir los 2 assets pendientes (imagen de portada, ícono de miniatura) — bloqueador real, ver §1 |
| Día -N | Grabar el video demo (§4) — no bloqueante para publicar, pero ideal tenerlo listo antes |
| Día 0 | Autorización humana explícita → publicar en Gumroad → ejecutar checklist post-publicación (§3) → post de anuncio en Social Media (§6.2) |
| Día 0 (mismo día) | Verificar landing/Bookfluence apunta correctamente al link real de Gumroad ya publicado |
| Día +1 a +7 | Ejecutar calendario de contenido de Social Media (§6.2) → monitorear correo de soporte diariamente (más rápido que el SLA de 2-3 días declarado, según `RC1_POST_LAUNCH_PLAN.md`) |
| Día +14 (o 50 compradores, lo que ocurra primero) | Transición de precio de lanzamiento ($19) a precio de catálogo ($29) — sin descuentos posteriores agresivos |
| Continuo | Registro de feedback real siguiendo el proceso ya definido en `RC1_POST_LAUNCH_PLAN.md` — nunca poblar la tabla de mejoras con ideas internas sin validar |
| Cuando exista señal de uso real de la Template Library (v1.1 ya en producción) | Envío del aviso de disponibilidad a compradores existentes (§5) + post de Social Media de templates reales (§6.2, último renglón) |

---

## 9. Checklist consolidado (vista única de todos los checklists de este documento)

- [ ] Assets bloqueantes producidos: imagen de portada, ícono de miniatura (§1)
- [ ] Landing/Bookfluence: CTA correcto, capturas embebidas, precio sincronizado, SEO básico (§2)
- [ ] Gumroad: checklist de publicación completo (`GUMROAD_LAUNCH_PLAN.md` §4)
- [ ] Video: grabado, exportado, subido (§4) — no bloqueante pero recomendado antes de Día 0
- [ ] Autorización humana explícita de publicación obtenida (fuera del alcance de este documento — condición de entrada al Día 0)
- [ ] Publicación ejecutada + checklist post-publicación completo (`RC1_POST_LAUNCH_PLAN.md`)
- [ ] Calendario de Social Media de la primera semana ejecutado (§6.2)
- [ ] Correo de soporte monitoreado activamente durante las primeras 48-72 horas
- [ ] Transición de precio de lanzamiento a precio de catálogo ejecutada en la fecha correspondiente
- [ ] Registro de feedback real iniciado desde el primer comprador

---

## 10. KPIs

Consolidación de las métricas ya definidas en `THOREN_PRODUCT_STRATEGY.md` §10.1, organizadas aquí por cadencia de revisión operativa (no se redefinen, se reutilizan):

| KPI | Cadencia de revisión en el Playbook | Acción si la métrica es mala |
|---|---|---|
| Unidades vendidas (ventana de lanzamiento vs. catálogo) | Diaria durante las primeras 2 semanas | Si las ventas son muy bajas en la ventana de lanzamiento, revisar visibilidad del link de Gumroad y CTA de landing antes de asumir un problema de producto o precio |
| Tasa de reembolso | Por cada reembolso individual (evento, no cadencia fija) | Revisar el motivo reportado — clasificarlo en el registro de feedback de `RC1_POST_LAUNCH_PLAN.md`, nunca ignorarlo como ruido |
| Reseñas/testimonios reales | Semanal | Usar como contenido de Social Media (§6.2) solo si son reales y con permiso implícito de reseña pública |
| Consultas de soporte por correo | Diaria durante las primeras 48-72 horas, luego según el SLA declarado (2-3 días hábiles) | Cada consulta que revele un problema real de producto (no solo una pregunta de uso) entra al registro de `RC1_POST_LAUNCH_PLAN.md` |

**Este documento no agrega KPIs nuevos que `THOREN_PRODUCT_STRATEGY.md` no haya ya definido** — su aporte es exclusivamente la cadencia operativa de revisión, que es lo que corresponde a un Playbook de ejecución, no a un documento de estrategia.

---

## 11. Gobernanza del documento

- Este es un documento operativo — se actualiza cada vez que un asset bloqueante (§1) se completa, o cuando la fecha real de Día 0 se conoce (en cuyo caso el Calendario de §8 puede anotarse con fechas de calendario reales, sin que eso implique una nueva decisión de producto).
- No reemplaza `GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RC1_COMMERCIAL_FAQ.md`, `RC1_DEMO_SCRIPT_AND_ASSETS.md` ni `RC1_POST_LAUNCH_PLAN.md` — los organiza en una sola vista ejecutable, y agrega los 3 elementos operativos que no existían todavía como plan estructurado: Emails (§5), Social Media (§6) y Calendario (§8).
- No autoriza publicar nada. La autorización humana explícita de publicación sigue siendo, como en todo el trabajo de RC1, una decisión fuera del alcance de este documento.
