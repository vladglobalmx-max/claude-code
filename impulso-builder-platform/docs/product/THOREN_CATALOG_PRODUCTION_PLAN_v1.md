# THÖREN Catalog Production Plan v1.0

**Alcance.** Con el Template Piloto Oficial (Serum Facial Premium) y la Infraestructura de Producción (`catalogTemplates/kit/`) ambos aprobados como estándar, este documento planea —sin producir ningún template todavía— cómo convertir los 62 templates restantes de `TEMPLATE_CATALOG_v1.md` en código real, agrupados en 12 lotes controlados ordenados de menor a mayor novedad técnica. El objetivo explícito del agrupamiento es maximizar el aprovechamiento de la infraestructura ya existente antes de introducir cada capacidad nueva, y aislar el riesgo de cada capacidad nueva a un lote pequeño en vez de mezclarlo con el resto del catálogo.

## Reglas de la etapa (vigentes para los 12 lotes, sin excepción)

1. Todo template nuevo debe cumplir el estándar ya establecido por `THOREN_PILOT_TEMPLATE_STANDARD.md`, `THOREN_PRODUCTION_INFRASTRUCTURE.md`, `TEMPLATE_LIBRARY_ARCHITECTURE.md`, `THOREN_DESIGN_LANGUAGE_GUIDE.md` y `THOREN_ASSET_PRODUCTION_GUIDE.md` — sin excepciones ni implementaciones paralelas.
2. Ninguna capacidad nueva se construye dos veces. Si un lote necesita algo que ya existe en `kit/`, se reutiliza tal cual; si necesita algo que no existe, se agrega a `kit/` (nunca inline en un solo template) solo cuando resuelve una necesidad real del sistema, no de un template aislado.
3. Cada lote termina con una validación explícita y una aprobación del usuario antes de iniciar el siguiente — no se avanza al lote N+1 sin que el lote N esté completamente terminado, probado y aprobado (mismo criterio ya usado para el piloto).
4. Una sola fuente de verdad: cualquier mejora a la infraestructura detectada durante un lote se documenta como actualización de `THOREN_PRODUCTION_INFRASTRUCTURE.md` (no como un documento paralelo), y el `kit/` sigue siendo el único lugar donde vive lógica reutilizable.

## Punto de control: Beta Comercial tras los Lotes 1-3

Decisión estratégica añadida a la aprobación de este plan: tras completar y aprobar los Lotes 1, 2 y 3 (16 templates: los 11 sin ilustración de los Lotes 1-2 más los 5 sellos con anillo de texto del Lote 3), la producción se **pausa** para ejecutar una Beta Comercial antes de continuar con el Lote 4. Objetivo: validar con usuarios reales — publicar los primeros templates, medir uso y fricción real, detectar qué familias generan más interés, y confirmar (o corregir) las decisiones de diseño ya tomadas, antes de invertir en las capacidades más costosas del plan (ilustración, troqueles personalizados). La Beta Comercial puede reordenar la **prioridad** de los Lotes 4-12 según lo que el mercado muestre (ej. producir primero la familia con mayor interés detectado) — no puede alterar la arquitectura ni la infraestructura ya aprobadas (regla 1-2 siguen vigentes sin excepción); es un ajuste de secuencia, no de estándar. El alcance detallado de la Beta Comercial (qué se publica, cómo se mide, qué constituye éxito) se define como su propio entregable al cerrar el Lote 3, no en este documento.

## Reporte de producción por lote (obligatorio, al cerrar cada uno de los 12 lotes)

Cada lote, al terminar, entrega un reporte breve con al menos:

1. **Tiempo invertido** — real, contrastado contra la estimación de este plan.
2. **Templates producidos** — lista final, con cualquier cambio de alcance frente al plan original.
3. **Componentes reutilizados** — de `catalogTemplates/kit/`, cuáles y cuántas veces.
4. **Componentes nuevos creados** — si los hubo, y si ya quedaron incorporados a `kit/`.
5. **Riesgos encontrados** — reales, no solo los ya anticipados en este plan.
6. **Riesgos eliminados** — qué clase de error este lote ya no puede producir en los siguientes.
7. **Cobertura de pruebas** — cifras reales (typecheck/tests/coverage/e2e).
8. **Regresiones detectadas** — y cómo se resolvieron.
9. **Mejoras incorporadas a la infraestructura** — cambios reales a `kit/` u otro documento maestro, si los hubo.
10. **Recomendaciones para el siguiente lote** — ajustes de alcance, tiempo o secuencia sugeridos antes de iniciarlo.

## Resumen de los 12 lotes

| # | Nombre | Templates | Capacidad nueva principal | Riesgo relativo |
|---|---|---|---|---|
| 1 | Cero ilustración — layout puro | 5 | Ninguna (validación horizontal del kit) | Muy bajo |
| 2 | Cero ilustración — marco/textura/logo | 6 | Placeholder de logo, textura de fondo simple | Bajo |
| 3 | Sellos con anillo de texto | 5 | `arrangeRingText` (texto perimetral) | Medio |
| 4 | Primera integración de ilustración (línea fina) | 6 | Integración real con `@impulso/asset-library` | Medio-alto (primera vez) |
| 5 | Ilustración línea fina — continuación | 5 | Ninguna nueva (reusa Lote 4) | Bajo (ya validado) |
| 6 | Ilustración color plano/alto contraste + variantes | 5 | Marco ornamentado, tipografía monoespaciada de dato | Medio |
| 7 | Ilustración festiva — continuación | 4 | Ninguna nueva (reusa Lote 6) | Bajo |
| 8 | Técnico Funcional / Normado / campos alineados a la izquierda | 7 | `leftAlignedFieldList`, franja diagonal, símbolos normados | Medio-alto (exactitud normativa) |
| 9 | Troqueles personalizados geométricos | 4 | `PathObject` de troquel (rombo/estrella/corazón/óvalo) + spike de print-engine | Alto |
| 10 | Troqueles personalizados irregulares/compuestos | 4 | Formas orgánicas + faja con pliegues + set multi-pieza | Alto |
| 11 | QR & Smart Labels + zonas reservadas | 5 | Zona de alto contraste reservada (sin generación real de QR) | Medio |
| 12 | Ilustración compleja + patrón repetible + cierre | 6 | `tileMotif` (patrón repetible), ilustración de personaje | Medio-alto |

**Total: 62 templates + 1 ya producido (Serum Facial Premium) = 63/63 al cerrar el Lote 12.**

Estimación total agregada: **~95-120 días-persona** de producción (suma de los rangos por lote, ver abajo) — una estimación de orden de magnitud calibrada contra el esfuerzo observado en el piloto, no una medición histórica sobre muchos templates; se refina lote a lote conforme se ejecuta.

---

## Lote 1 — Cero ilustración, layout puro

**Nota de alcance (post-ejecución):** 13.3 Sello de Regalo Hecho a Mano se reasignó al Lote 2 al leer su especificación completa (`TEMPLATE_BATCH_09.md`, Template 43) — a diferencia de lo que sugería la entrada corta de `TEMPLATE_CATALOG_v1.md`, el batch completo sí exige una textura de papel kraft (sección 5, "Assets necesarios"), lo cual pertenece por definición al perfil del Lote 2 ("cero ilustración, con marco/textura/logo"), no al de este lote (cero ilustración Y cero textura). Ver el reporte de producción del Lote 1 para el detalle.

### 1. Templates incluidos
2.5 Bálsamo Labial Natural · 3.2 Spa & Bienestar · 7.1 Etiqueta Neutral Minimalista · 8.1 Sello de Cierre · 10.3 Gracias por tu Preferencia

### 2. Justificación del agrupamiento
Los 5 templates declaran explícitamente "sin ilustración" o su equivalente (espacio negativo, tipografía pura, línea divisoria opcional) en `TEMPLATE_CATALOG_v1.md` — son, estructuralmente, la misma clase de template que el piloto (Serum Facial Premium): troquel estándar (círculo/rectángulo, sin formas personalizadas) + roles de texto + opcionalmente una línea divisoria. Es el lote de menor riesgo posible y sirve para confirmar, con una muestra más amplia que un solo template, que el kit realmente escala horizontalmente sin fricción.

### 3. Componentes reutilizados
`createCatalogProject`, `createDieLineObjects` (circle/rectangle), `createTextObject`, `createDividerLine`, `stackVertically`/`textLineHeight`, `buildCatalogTemplateDescriptor`, `validateCatalogProject`.

### 4. Componentes nuevos que puedan surgir
Ninguno esperado. Si durante la producción aparece un patrón repetido 2+ veces que el kit no cubre (ej. una variante de alineación no vista en el piloto), se evalúa promoverlo a `kit/` solo si beneficia al sistema completo, no a un template aislado (regla 2).

### 5. Riesgos técnicos
Mínimos. El principal riesgo no es técnico sino de **falso sentido de seguridad**: al ser el lote más fácil, no ejercita todavía ninguna de las capacidades nuevas que sí necesitarán los lotes 3+ (texto perimetral, ilustración, troqueles personalizados) — se documenta explícitamente para no inferir de este lote que el resto del catálogo será igual de simple.

### 6. Tiempo estimado
Sin infraestructura nueva que construir: ~0.5-1 día por template × 5 = **2.5-5 días** (ajustado de 6 a 5 templates, ver nota de alcance).

### 7. Estrategia de validación
Igual que el piloto pero batcheada: un archivo de test por template (schema, roles, paleta, tipografía) + un solo spec de Playwright parametrizado sobre los ids del lote (extendiendo el patrón de `template-catalog-pilot.spec.ts` en vez de duplicar un spec completo por template) cubriendo galería → crear → Capas → guardar → exportar PNG/SVG para cada uno.

### 8. Criterios de aprobación para pasar al Lote 2
Los 5 templates pasan validación unitaria + e2e; cero regresiones en la suite existente; cobertura se mantiene sobre umbral; **cero componentes nuevos realmente necesarios** (confirma que la infraestructura actual cubre esta clase de template sin fricción, la hipótesis central del lote).

---

## Lote 2 — Cero ilustración, con marco/textura/logo

**Nota de alcance (post-ejecución del Lote 1):** incluye 13.3 Sello de Regalo Hecho a Mano, reasignado desde el Lote 1 — su especificación completa (`TEMPLATE_BATCH_09.md`, Template 43) exige una textura de papel kraft (misma textura ya especificada para 7.2 Etiqueta Kraft Genérica), encajando exactamente en el perfil de este lote.

### 1. Templates incluidos
7.2 Etiqueta Kraft Genérica · 7.3 Etiqueta Corporativa Simple · 12.4 Mesa de Dulces · 13.3 Sello de Regalo Hecho a Mano · 14.1 Kraft Hecho a Mano · 14.3 Empaque Artesanal Etsy

### 2. Justificación del agrupamiento
Mismo perfil que el Lote 1 (sin ilustración real) pero cada uno introduce un elemento visual menor que el piloto no necesitó: un bloque reservado para el logo del comprador (no diseñado por THÖREN, un placeholder), o una textura de fondo sutil tipo papel kraft. Se agrupan separados del Lote 1 para aislar estas dos capacidades pequeñas sin retrasar la validación del Lote 1.

### 3. Componentes reutilizados
Todo lo del Lote 1, más `createRectangle` como placeholder de logo (ya existe, sin cambios).

### 4. Componentes nuevos que puedan surgir
Un helper de "textura de fondo sutil" (kraft/papel) si se confirma que se repite lo suficiente como para justificarlo en `kit/` — de lo contrario, se resuelve como una imagen de fondo vía `@impulso/asset-library` sin nuevo código de kit, adelantando ligeramente la integración de assets que formalmente empieza en el Lote 4.

### 5. Riesgos técnicos
Bajo. El único riesgo real es decidir bien el límite entre "placeholder de logo del comprador" (no es contenido de THÖREN, no debe ser un asset del template) vs. contenido propio del template — debe quedar claro en cada `Project` cuál es cuál (via `metadata.role`, ej. `"user-logo-placeholder"` vs. cualquier asset propio).

### 6. Tiempo estimado
~0.5-1 día por template × 6 = **3-6 días** (ajustado de 5 a 6 templates, ver nota de alcance).

### 7. Estrategia de validación
Mismo patrón que el Lote 1, más una aserción explícita de que el placeholder de logo nunca se confunde con un asset real embebido (evita que export SVG/PNG intente resolver un asset inexistente), y (para 7.2/13.3/14.1) una verificación de que la textura kraft compartida se referencia una sola vez, no se reproduce por template.

### 8. Criterios de aprobación para pasar al Lote 3
Los 6 templates pasan validación completa; el criterio de "placeholder vs. asset real" queda documentado y es consistente entre todos; cero regresiones.

---

## Lote 3 — Sellos con anillo de texto

### 1. Templates incluidos
3.1 Sello de Cita — Salón de Belleza · 4.2 Sello de Calidad Industrial · 6.3 Sello "Hecho en Casa" · 10.1 Sello Corporativo · 12.1 Sello de Sobre de Invitación

### 2. Justificación del agrupamiento
Los 5 comparten un patrón de composición que el piloto nunca necesitó: un anillo de texto alrededor del perímetro del troquel circular (ej. "anillo de texto con nombre de empresa", "iniciales entrelazadas o monograma... anillo de texto perimetral"). Es la primera capacidad genuinamente nueva del catálogo — se agrupa en un lote pequeño para poder construirla, probarla y aprobarla una sola vez antes de reutilizarla.

### 3. Componentes reutilizados
`createCatalogProject`, `createDieLineObjects` (circle), `createTextObject`, `buildCatalogTemplateDescriptor`, `validateCatalogProject`.

### 4. Componentes nuevos que puedan surgir
**`arrangeRingText`** (nombre provisional): dado un radio, un centro y una lista de fragmentos de texto cortos, calcula la posición y rotación (`transform.rotation`, ya soportado por `SceneObjectBase`) de cada fragmento para que se lean distribuidos alrededor del círculo. Decisión de diseño técnico que debe tomarse explícitamente al construir este componente: `@impulso/document-schema` no soporta texto curvado letra por letra (un `TextObject` es siempre una caja recta) — el "anillo" será una aproximación estilizada con 2-4 fragmentos de texto recto rotados a lo largo del perímetro, no tipografía verdaderamente curva. Esto se documenta como decisión de producto, igual que se hizo con la partición de color en el piloto, no como una limitación oculta.

### 5. Riesgos técnicos
Medio: el riesgo no es de implementación (la geometría de posicionar N objetos en un círculo es trigonometría simple) sino de **calidad visual de la aproximación** — un "anillo de texto" hecho con fragmentos rectos rotados puede leerse bien o puede leerse incorrecto según el ángulo/espaciado elegido; requiere una revisión visual manual del primer template producido antes de aplicar el patrón a los otros 4.

### 6. Tiempo estimado
Construcción de `arrangeRingText` (~1-1.5 días) + revisión visual del primer template (~0.5 día) + ~1 día por template restante × 4 = **6.5-7.5 días**.

### 7. Estrategia de validación
Test unitario de `arrangeRingText` (ángulos/posiciones correctos para N fragmentos dados); test por template; una comprobación visual manual explícita (captura de pantalla o export PNG revisado por una persona) del primer template antes de producir los 4 restantes con el mismo patrón.

### 8. Criterios de aprobación para pasar al Lote 4
`arrangeRingText` probado de forma aislada y aprobado visualmente en al menos un template real; los 5 templates completos pasan validación; cero regresiones.

---

## Lote 4 — Primera integración de ilustración (línea fina)

### 1. Templates incluidos
1.1 Café de Especialidad · 1.6 Té de Hierbas Orgánico · 2.2 Crema Corporal Natural · 2.4 Aceite Esencial Puro · 12.2 Favor de Boda · 18.2 Otoño

### 2. Justificación del agrupamiento
Es el primer lote que introduce una ilustración real (nivel 1 de reducción, "línea fina editorial" según `THOREN_DESIGN_LANGUAGE_GUIDE.md` §4.1) — hasta este punto, ningún template producido (incluido el piloto) tocó `@impulso/asset-library`. Se agrupan 6 templates de la misma familia técnica (un solo ícono de línea fina, sin variantes de color) para validar el patrón de integración completo una vez, con un margen de reutilización inmediata en los lotes 5-7.

### 3. Componentes reutilizados
Todo lo de los Lotes 1-3 (según cada template lo necesite) más el pipeline de producción de assets ya documentado en `THOREN_ASSET_PRODUCTION_GUIDE.md` (las 6 etapas), aplicado por primera vez a un template de catálogo en vez de a un asset de usuario.

### 4. Componentes nuevos que puedan surgir
Un helper de kit para insertar una ilustración (`placeIllustration` o similar) que envuelva la creación de un `ImageObject` con su posición/tamaño/rol, análogo a `createTextObject` — reduce el boilerplate de referenciar un asset dentro de un `Project` de catálogo. La producción real de cada ícono SVG (grano de café, hoja de té, motivo botánico, ícono diminuto de aceite esencial, motivo floral, hoja de otoño) es trabajo de diseño/producción de assets, no de código — sigue el pipeline ya aprobado, no un proceso nuevo.

### 5. Riesgos técnicos
Medio-alto: es la primera vez que se verifica, con un template de catálogo real, que la exportación SVG (que embebe imágenes como data URI base64, ya confirmado en `export-engine`) y la generación de thumbnail funcionan correctamente con un asset ilustrado — el piloto deliberadamente evitó esto. Mitigación: producir y validar de punta a punta **un solo template** (ej. 1.1 Café) antes de producir los 5 restantes — el mismo criterio de "mini-piloto dentro del lote" ya usado para justificar el Template Piloto Oficial original.

### 6. Tiempo estimado
Helper de kit + pipeline de asset (~1.5 días) + mini-piloto de validación completa (~1 día) + ~1.5 días por template restante × 5 = **~11.5 días**.

### 7. Estrategia de validación
Test estructural (presencia de `ImageObject` con `role` correcto, `assets` del Document referenciado correctamente); export SVG real (sin mocks, como en el piloto) confirmando que el ícono aparece embebido; export PNG real confirmando rasterización correcta; e2e de al menos el primer template (mini-piloto) cubriendo el recorrido completo de 11 pasos, y e2e ligero (parametrizado) para los 5 restantes.

### 8. Criterios de aprobación para pasar al Lote 5
El mini-piloto (primer template ilustrado) pasa el recorrido completo de 11 pasos sin regresión; los 6 templates completos pasan validación; el helper de inserción de ilustración queda documentado en `THOREN_PRODUCTION_INFRASTRUCTURE.md`.

---

## Lote 5 — Ilustración línea fina, continuación

### 1. Templates incluidos
1.2 Miel Artesanal de Productor Local · 3.3 Marca Personal de Estilista · 9.2 Gracias por tu Compra · 11.2 Sticker de Networking · 12.5 Agradecimiento de Boda

### 2. Justificación del agrupamiento
Misma familia técnica que el Lote 4 (ilustración de línea fina o ícono pequeño + tipografía script/manuscrita) — se separa en su propio lote no por diferencia técnica sino para mantener el tamaño de cada lote controlado (regla explícita del usuario), ya con el patrón de integración de ilustración probado y aprobado en el Lote 4.

### 3. Componentes reutilizados
Todo lo del Lote 4, sin cambios — este lote es, deliberadamente, el primero donde se espera **cero infraestructura nueva** después de haber introducido una capacidad nueva en el lote anterior (confirma que la inversión del Lote 4 amortiza).

### 4. Componentes nuevos que puedan surgir
Ninguno esperado.

### 5. Riesgos técnicos
Bajo — el riesgo alto ya se absorbió en el Lote 4; aquí solo queda la producción de cada ícono/tipografía script individual.

### 6. Tiempo estimado
~1-1.5 días por template × 5 = **5-7.5 días**.

### 7. Estrategia de validación
Igual que el Lote 4 (sin el paso de mini-piloto, ya no es necesario).

### 8. Criterios de aprobación para pasar al Lote 6
Los 5 templates pasan validación completa; confirma que el patrón del Lote 4 es reutilizable sin fricción adicional (si aparece fricción, se documenta antes de seguir).

---

## Lote 6 — Ilustración color plano/alto contraste + variantes

### 1. Templates incluidos
1.3 Cerveza Artesanal — IPA · 1.4 Mermelada Casera de Temporada · 1.5 Salsa Picante Gourmet · 6.2 Nuevo Producto · 14.2 Vintage Curado

### 2. Justificación del agrupamiento
Introducen, juntos, tres capacidades nuevas de complejidad media: (a) ilustración de nivel 2-3 (color plano/alto contraste, más elaborada que la línea fina del Lote 4-5); (b) el patrón de "acento de color variable por variante" ya previsto en el schema (`TemplatePalette.variableAccents`) pero nunca ejercido con un template real (Mermelada, con su set de sabores de fruta, es el caso de uso exacto que motivó ese campo); (c) tipografía "Técnica/Monoespaciada" para datos de alto rigor (ABV/IBU de cerveza) y un marco ornamentado fino (Vintage Curado). Se agrupan porque comparten el mismo nivel de novedad (ilustración más elaborada + un elemento estructural nuevo cada uno), no porque compartan categoría de catálogo.

### 3. Componentes reutilizados
Todo lo de los Lotes 4-5, más `TemplateStyle.palette.variableAccents` (ya existe en `styleSystem.ts`, sin usar hasta ahora).

### 4. Componentes nuevos que puedan surgir
Un helper de "marco ornamentado" (`createOrnamentalFrame` o similar, un borde decorativo fino alrededor del troquel) para Vintage Curado — se evalúa si vale la pena generalizarlo o si es más simple como una ilustración vectorial más (un `ImageObject` de borde) sin nuevo código; se decide durante el lote, no antes.

### 5. Riesgos técnicos
Medio: el patrón de "acento variable" introduce una pregunta de producto que debe resolverse explícitamente antes de producir Mermelada — ¿el template guarda un solo `Project` con un color por defecto y el comprador cambia el acento libremente (consistente con la nota de cierre del catálogo: "los colores sugeridos... nunca un límite"), o el catálogo necesita múltiples `TemplateDescriptor`s (uno por sabor)? La arquitectura ya diseñada favorece la primera opción (un solo template, color editable) — este lote la confirma con un caso real.

### 6. Tiempo estimado
Marco ornamentado (~1 día) + ~1.5 días por template × 5 = **~8.5 días**.

### 7. Estrategia de validación
Igual que Lotes 4-5, más un test específico confirmando que el `Project` de Mermelada sigue siendo válido tras cambiar su color de acento (simula la edición del comprador).

### 8. Criterios de aprobación para pasar al Lote 7
Los 5 templates pasan validación completa; la decisión de "acento variable = un solo Project editable" queda confirmada y documentada; cero regresiones.

---

## Lote 7 — Ilustración festiva, continuación

### 1. Templates incluidos
15.3 Cumpleaños Infantil · 17.1 Navidad Clásica · 17.2 Año Nuevo · 18.1 Verano

### 2. Justificación del agrupamiento
Misma familia técnica que el Lote 6 (ilustración nivel 2-3, sin capacidades nuevas) — lote de continuación, deliberadamente pequeño (4 templates) para mantener el ritmo de lotes controlados sin introducir nada nuevo.

### 3. Componentes reutilizados
Todo lo del Lote 6, sin cambios.

### 4. Componentes nuevos que puedan surgir
Ninguno esperado.

### 5. Riesgos técnicos
Bajo.

### 6. Tiempo estimado
~1-1.5 días por template × 4 = **4-6 días**.

### 7. Estrategia de validación
Igual que el Lote 6.

### 8. Criterios de aprobación para pasar al Lote 8
Los 4 templates pasan validación completa; cero regresiones.

---

## Lote 8 — Técnico Funcional / Normado / campos alineados a la izquierda

### 1. Templates incluidos
4.1 Identificación de Equipo Industrial · 5.1 Advertencia General · 5.2 Manejo con Cuidado — Frágil Técnico · 9.3 Este Lado Arriba · 10.2 Tarjeta de Presentación Adhesiva · 16.1 Sello "Buen Trabajo" · 16.2 Etiqueta de Útiles Escolares

### 2. Justificación del agrupamiento
Es el único lote de todo el plan donde aplica la excepción documentada en `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.2: alineación izquierda funcional en vez de la composición centrada usada en el resto del catálogo — tanto para listas de datos técnicos (Identificación de Equipo) como para el formato de tarjeta de presentación (10.2). Se agrupan junto con los símbolos de convención normada (Advertencia General, Frágil Técnico) porque ambos requieren el mismo nivel de rigor "sin interpretación creativa" que exige la familia Técnico Funcional, aunque su capacidad técnica nueva (alineación izquierda vs. símbolo normado) sea distinta.

### 3. Componentes reutilizados
`createCatalogProject`, `createDieLineObjects`, `createTextObject`, `createRectangle`, más el pipeline de ilustración del Lote 4 (para los íconos normados y el ícono pequeño de 16.2).

### 4. Componentes nuevos que puedan surgir
**`leftAlignedFieldList`**: layout que apila pares campo/valor alineados a la izquierda (en vez de centrados vía `stackVertically`) — complementa, no reemplaza, el apilado centrado existente. **Franja diagonal** (amarillo/negro de Advertencia General) — un helper simple de rectángulo rotado o rayas alternadas. Los símbolos normados (exclamación de advertencia, copa de frágil) se producen como ilustraciones nivel 5 ("símbolo normado", sin interpretación creativa) siguiendo estrictamente una referencia de convención real, no como diseño original.

### 5. Riesgos técnicos
Medio-alto: el riesgo dominante no es de código sino de **exactitud normativa** — un símbolo de advertencia o de manejo frágil mal proporcionado no es solo un defecto estético, es un error de comunicación de seguridad. Requiere verificar cada símbolo contra una referencia de convención real (no inventar la proporción) y una revisión manual explícita antes de aprobar, distinta de la validación automática de estructura.

### 6. Tiempo estimado
`leftAlignedFieldList` (~1.5 días) + franja diagonal (~0.5 día) + ~1.5-2 días por template (tiempo extra por la verificación de convención) × 7 = **~13-16 días**.

### 7. Estrategia de validación
Test unitario de `leftAlignedFieldList` (orden, alineación); validación estructural estándar; **revisión manual documentada** (captura + comparación contra la referencia de convención) para 5.1 y 5.2 específicamente, antes de dar el lote por aprobado.

### 8. Criterios de aprobación para pasar al Lote 9
`leftAlignedFieldList` probado y documentado; los símbolos normados de 5.1/5.2 confirmados contra su referencia de convención real (sign-off explícito, no solo test automatizado); los 7 templates pasan validación completa.

---

## Lote 9 — Troqueles personalizados geométricos

### 1. Templates incluidos
5.3 Material Peligroso — Rombo Normado · 12.3 Nombres y Fecha — Monograma (óvalo/corazón) · 15.1 Estrella de Buen Comportamiento · 17.5 San Valentín (corazón)

### 2. Justificación del agrupamiento
Es el primer lote que produce una línea de corte que NO es círculo/cuadrado/rectángulo — hasta este punto, `createDieLineObjects` solo cubre esas 3 formas (con `"custom"` devolviendo `[]`, sin geometría). Los 4 templates comparten troqueles geométricos regulares (rombo, óvalo, corazón, estrella) cuya matemática, aunque distinta entre sí, es tratable con curvas Bézier estándar — se agrupan separados de los troqueles irregulares/compuestos del Lote 10 para no mezclar la primera verificación de la cadena de impresión con la complejidad adicional de formas orgánicas o de pieza múltiple.

### 3. Componentes reutilizados
Todo lo de los Lotes 1-8 según aplique para el contenido de cada template (texto, ilustración); la novedad es exclusivamente el troquel.

### 4. Componentes nuevos que puedan surgir
Generadores de `PathObject` de troquel, uno por forma (`createDiamondDieLine`, `createHeartDieLine`, `createStarDieLine`, `createOvalDieLine`), usando el formato de segmentos ya definido en `@impulso/document-schema` (`moveTo`/`lineTo`/`quadraticCurveTo`/`cubicCurveTo`/`close`) — no un generador único genérico, ya que cada forma tiene una matemática distinta.

### 5. Riesgos técnicos
**Alto — el mayor riesgo no absorbido de todo el plan hasta este punto**: ningún template producido hasta ahora (incluido el piloto) usó un `PathObject` como línea de corte — toda la cadena de impresión (`packages/print-engine`: detección de die-line, `CutGeometry`, offset de troquel) fue verificada contra `EllipseObject`/`RectangleObject` únicamente. No hay garantía todavía de que la detección de die-line y el offset de troquel funcionen correctamente con un `PathObject` con `metadata.role: "die-line"`. **Antes de producir cualquiera de los 4 templates**, se requiere un spike dedicado: construir un `PathObject` de prueba (ej. un rombo simple) con `role: "die-line"` y confirmar, con una exportación real a PDF/PNG, que `print-engine` genera marcas de corte correctas. Si el spike revela una limitación real de `print-engine`, esa limitación se corrige como una extensión de infraestructura documentada — antes de continuar, no como un parche dentro de un template.

### 6. Tiempo estimado
Spike de verificación de `print-engine` con `PathObject` (~2-3 días, incluye posible corrección si se encuentra una limitación) + ~2 días por forma (matemática de curvas + verificación) × 4 = **~10-11 días**.

### 7. Estrategia de validación
El spike en sí, con una exportación PDF/PNG real inspeccionada programáticamente (mismo patrón ya usado en Fase 9.3 para inspección de PDF); test unitario por generador de forma (geometría cierra correctamente, sin auto-intersección); validación estructural y e2e estándar por template, una vez confirmado que el spike pasa.

### 8. Criterios de aprobación para pasar al Lote 10
El spike de `print-engine` con `PathObject` pasa con una exportación real correcta (marcas de corte, offset) para al menos una forma; los 4 generadores de forma están probados; los 4 templates pasan validación completa.

---

## Lote 10 — Troqueles personalizados irregulares/compuestos

### 1. Templates incluidos
2.3 Jabón Artesanal en Barra (faja con muescas de plegado) · 13.1 Decoración de Scrapbook (formas libres, posible set multi-pieza) · 13.2 Sticker Decorativo para Manualidades (borde festoneado) · 17.3 Día de Muertos (calavera o flor de cempasúchil)

### 2. Justificación del agrupamiento
Construyen sobre la verificación de `print-engine` ya hecha en el Lote 9, pero añaden complejidad adicional que el Lote 9 deliberadamente no cubrió: formas orgánicas (calavera, flor), un borde festoneado (una variante repetitiva de curvas sobre un círculo, no una forma simple), y dos casos estructuralmente distintos de "más de una pieza por template" — la faja de jabón requiere líneas de plegado además de la línea de corte, y el set de scrapbook puede representar varias piezas pequeñas en un mismo `Project` en vez de una sola. Se agrupan al final de los troqueles personalizados porque cada uno es, en algún sentido, un caso especial adicional sobre lo ya resuelto en el Lote 9.

### 3. Componentes reutilizados
Los generadores de `PathObject` y el criterio de verificación de `print-engine` del Lote 9; el pipeline de ilustración de los Lotes 4-7 para el motivo de calavera/cempasúchil.

### 4. Componentes nuevos que puedan surgir
Geometría de forma orgánica (calavera, festoneado) como generadores de `PathObject` adicionales; una convención para representar **líneas de plegado** además de la línea de corte (posible nuevo `metadata.role`, ej. `"fold-line"`, con su propio tratamiento en `print-engine` — a confirmar si ya existe soporte o si es una extensión real); una convención para templates de **más de una pieza** (¿un `Project` con múltiples objetos `die-line` en Layers separadas, o varios `TemplateDescriptor`s? — decisión de arquitectura a tomar explícitamente antes de producir 13.1, no a improvisar).

### 5. Riesgos técnicos
Alto — combina el riesgo de geometría del Lote 9 con dos preguntas de arquitectura no resueltas todavía (líneas de plegado, templates multi-pieza) que deben decidirse *antes* de codear, no descubrirse a mitad de producción. Recomendación: tratar 2.3 (Jabón) y 13.1 (Scrapbook) como sus propios mini-spikes dentro del lote, cada uno confirmando su convención antes de darla por buena.

### 6. Tiempo estimado
~2.5 días por template (mayor tiempo por la resolución de las preguntas de arquitectura de plegado/multi-pieza) × 4 = **~10 días**.

### 7. Estrategia de validación
Igual que el Lote 9, más una verificación específica de que las líneas de plegado (si se implementan como una convención nueva) no se confunden con la línea de corte real en `print-engine`; validación de que un `Project` multi-pieza (si aplica) sigue siendo un `Project` único válido, no una ficción de varios descriptors.

### 8. Criterios de aprobación para pasar al Lote 11
Las convenciones de línea de plegado y de template multi-pieza (si se usan) quedan decididas y documentadas como extensión de infraestructura; los 4 templates pasan validación completa; **con este lote se completa la cobertura de todas las formas de troquel del catálogo (63/63 templates ya no tienen ninguna forma sin resolver)**.

---

## Lote 11 — QR & Smart Labels + zonas reservadas

### 1. Templates incluidos
11.1 Conferencia / Lanzamiento · 19.1 Menú Digital QR · 19.2 Enlace a Redes Sociales QR · 19.3 Reseña QR · 19.4 Tarjeta de Contacto QR

### 2. Justificación del agrupamiento
Los 4 templates de QR & Smart Labels comparten la necesidad de reservar una zona de alto contraste con proporciones específicas (el "margen de silencio" alrededor de un código QR) — una capacidad nueva pero estructuralmente simple (una zona rectangular reservada, no la generación del QR en sí). Se agrupa junto con Conferencia/Lanzamiento porque comparte el mismo patrón de "banda superior/inferior reservada para un dato específico", aunque no sea QR.

**Decisión que debe confirmarse con el usuario antes de iniciar este lote** (no bloquea la aprobación del plan, pero sí el inicio de este lote específico): ¿el template reserva únicamente la zona (el comprador pega/genera su propio código QR fuera de THÖREN) o el alcance de este lote incluye generar un QR real y escaneable dentro del editor? Este plan asume la primera opción (zona reservada, sin generación real) salvo indicación contraria, porque generar un QR real es una capacidad de producto distinta (requeriría una librería de generación de QR, fuera del alcance de `catalogTemplates/kit/`).

### 3. Componentes reutilizados
`createCatalogProject`, `createDieLineObjects` (square/circle/rectangle — ninguno de estos 5 necesita troquel personalizado), `createTextObject`, `createRectangle`.

### 4. Componentes nuevos que puedan surgir
Un helper de "zona reservada de alto contraste" (`createReservedZone` o similar) — un rectángulo con `metadata.role` documentado (ej. `"qr-zone"`) y proporciones mínimas de margen de silencio, sin lógica de generación de QR.

### 5. Riesgos técnicos
Medio — el riesgo principal es de expectativa de producto (evitar que el comprador entienda "QR funcional incluido" si el alcance es solo la zona reservada), no de implementación.

### 6. Tiempo estimado
`createReservedZone` (~1 día) + ~1 día por template × 5 = **~6 días**.

### 7. Estrategia de validación
Test de que la zona reservada respeta las proporciones documentadas; validación estructural estándar; nota explícita en la descripción comercial de cada template QR aclarando el alcance real (zona reservada, no generación de código).

### 8. Criterios de aprobación para pasar al Lote 12
La decisión de alcance (zona reservada vs. generación real) está confirmada con el usuario y documentada; los 5 templates pasan validación completa.

---

## Lote 12 — Ilustración compleja, patrón repetible y cierre del catálogo

### 1. Templates incluidos
6.1 Precio y Oferta · 8.2 Cinta Decorativa de Empaque · 9.1 Frágil — Manejo con Cuidado (versión e-commerce) · 15.2 Personaje Divertido · 17.4 Halloween · 18.3 Regreso a Clases

### 2. Justificación del agrupamiento
Cierra el catálogo agrupando las dos últimas capacidades genuinamente nuevas: un **patrón repetible** (Cinta Decorativa, tipo washi tape — varias copias de un motivo distribuidas a lo largo de un rectángulo) y una **ilustración de personaje** (Personaje Divertido — el único caso del catálogo que requiere una ilustración con expresión/personalidad, no un ícono o motivo simple). Se agrupan con Precio y Oferta (reutiliza la franja diagonal del Lote 8), Frágil e-commerce y Halloween/Regreso a Clases (ilustración nivel 2-3 ya resuelta en los Lotes 6-7) para cerrar el catálogo completo en un solo lote final.

### 3. Componentes reutilizados
Franja diagonal (Lote 8) para 6.1; pipeline de ilustración (Lotes 4-7) para 9.1/17.4/18.3; todo el resto del kit según aplique.

### 4. Componentes nuevos que puedan surgir
**`tileMotif`** (patrón repetible): coloca N copias de un motivo/`GroupObject` a intervalos regulares a lo largo de un ancho dado — capacidad nueva y genuinamente reutilizable para cualquier futuro template de patrón (no solo Cinta Decorativa). La ilustración de personaje (15.2) es trabajo de diseño/producción de asset, no un componente de código reutilizable — se documenta explícitamente como NO automatizable (consistente con `THOREN_PRODUCTION_INFRASTRUCTURE.md` §8).

### 5. Riesgos técnicos
Medio-alto: `tileMotif` introduce un riesgo de rendimiento (N objetos repetidos en una sola Layer — debe confirmarse que la exportación/rasterización no se degrada con un N realista); la ilustración de personaje tiene riesgo de **calidad subjetiva** (un personaje "amigable" es evaluado por criterio humano, no por ningún test automático) — su aprobación debe incluir una revisión de diseño explícita, no solo la suite de tests.

### 6. Tiempo estimado
`tileMotif` (~1.5 días) + diseño/iteración del personaje (~2-3 días) + ~1-1.5 días por template restante × 4 = **~9-10 días**.

### 7. Estrategia de validación
Test unitario de `tileMotif` (N copias, espaciado correcto); verificación de rendimiento de exportación con un N realista de copias; validación estructural estándar para el resto; **revisión de diseño manual explícita** (no solo automatizada) para Personaje Divertido antes de aprobarlo.

### 8. Criterios de aprobación para cerrar el catálogo (63/63)
`tileMotif` probado, con rendimiento de exportación verificado; Personaje Divertido aprobado por revisión de diseño explícita del usuario; los 6 templates completos pasan validación; **con la aprobación de este lote, el catálogo de 63 templates queda 100% producido, integrado y validado**.

---

## Nota de gobernanza

Cada uno de estos 12 lotes es, en sí mismo, una repetición controlada del mismo patrón de aprobación ya usado para el Template Piloto Oficial: producir, probar de punta a punta, entregar hallazgos y decisiones tomadas, y esperar aprobación explícita antes de continuar. Ninguna mejora de infraestructura detectada durante un lote se implementa "de paso" dentro de un template — se documenta, se evalúa si beneficia al sistema completo (regla 2), y si aplica, se incorpora a `kit/` como su propio cambio, versionado igual que cualquier otra pieza de la infraestructura ya aprobada.

## Estado

**Plan de producción completo, listo para aprobación.** No se produce ningún template del catálogo hasta recibir esa aprobación; una vez aprobado, se ejecuta el Lote 1 primero, y cada lote subsecuente solo tras la aprobación explícita del anterior.
