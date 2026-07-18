# 01 — Positioning

> Documento estratégico de negocio. Complementa (no reemplaza) [`../product/01-Product-Vision.md`](../product/01-Product-Vision.md) — la Visión de Producto explica qué es Impulso y para quién; este documento explica dónde se para Impulso frente al mercado y la competencia real. Ver [`03-Competitive-Landscape.md`](03-Competitive-Landscape.md) para el análisis competitivo completo del que se derivan las afirmaciones de este documento; las conclusiones que dependen de validación externa se marcan **[HIPÓTESIS]**, igual que allí.

---

## ¿Por qué existe Impulso?

Porque hoy, crear un producto físico personalizado (empezando por un sticker) obliga a elegir entre dos extremos: una herramienta de diseño profesional con una curva de aprendizaje que no tiene relación con la simplicidad real de la tarea, o una herramienta genérica de "arrastrar y soltar" que no entiende nada sobre producción física — el resultado se ve bien en pantalla, pero no hay garantía de que sea imprimible tal cual.

Impulso existe para eliminar esa elección falsa: una herramienta tan simple como un editor casual, con el rigor de producción de una herramienta profesional, construida desde el primer día para poder repetirse en más de un tipo de producto sin reconstruirse cada vez (ver [`../product/03-Architecture-Map.md`](../product/03-Architecture-Map.md)).

## ¿Qué categoría estamos creando?

No competimos limpiamente dentro de ninguna categoría ya nombrada del mercado (editor de diseño generalista, marketplace de assets, generador de mockups, suite de POD) — competimos en el cruce de dos de ellas que hoy nadie ocupa con la misma arquitectura:

**"Herramientas de creación especializadas para productos físicos de nicho"** — no un editor que hace de todo (Canva), no una plataforma que vende licencias de contenido (Creative Fabrica), no un generador de imágenes de presentación (Placeit), y no un editor de merch genérico con fulfillment propio (Kittl) — sino una **familia de editores**, cada uno enfocado en un tipo de producto específico (stickers hoy; planners, coloring books, flashcards, worksheets, journals, bundles mañana — ver [`../product/03-Architecture-Map.md`](../product/03-Architecture-Map.md)), construidos sobre el mismo núcleo (Impulso Engine) para no repetir el trabajo de resolver capas/selección/transformación/historial en cada uno.

**[HIPÓTESIS]** que el mercado reconozca o valore esta categoría como algo distinto de "otro editor de diseño más" — es una apuesta de posicionamiento, no un hecho validado con usuarios todavía.

## ¿Qué problema resolvemos mejor que Canva?

Canva **no genera líneas de corte reales** — su propia documentación de ayuda es explícita: "Canva doesn't generate cut lines as Illustrator does". El usuario debe simular manualmente el die-line con una forma que sirve solo de guía visual para el proveedor de impresión, no como un dato de producción real. Además, Canva es deliberadamente generalista: ningún flujo, plantilla o restricción está pensada específicamente para las reglas físicas de un sticker (tamaño real, sangrado, material).

Impulso resuelve esto modelando la línea de corte como un dato de primera clase desde el Document Schema (un `path` con `metadata.role: "die-line"`, ver ADR-0002) — no una guía visual añadida, sino parte de la estructura misma del documento. Y resuelve la sobrecarga de Canva por diseño: una herramienta enfocada en un objetivo (stickers listos para imprenta), no una que también hace presentaciones, videos y posts de redes sociales.

## ¿Qué problema resolvemos mejor que Kittl?

Aquí la honestidad importa: Kittl **ya tiene** un sticker maker con plantillas de die-cut/kiss-cut y su propio servicio de impresión (Kittl Print) — no es un espacio vacío, y no podemos afirmar "tenemos línea de corte y ellos no".

La diferencia real es estructural, no de funcionalidad puntual: Kittl es un producto monolítico enfocado en merch/POD en general — stickers es una funcionalidad más dentro de una herramienta de propósito amplio, atada (para el camino más simple) a su propio servicio de impresión. Impulso está construido, desde el Document Schema hacia arriba, para que un módulo nuevo (no solo stickers) se agregue sin reescribir el núcleo — la promesa de una **plataforma de módulos especializados**, no de una herramienta que va acumulando funcionalidades de categorías distintas dentro del mismo producto. Y el archivo que produce Impulso no depende de ningún servicio de impresión propio para ser útil — el objetivo es que el archivo exportado sea tan agnóstico del proveedor de impresión como el propio Renderer lo es de la librería de canvas (ver ADR-0001).

**[HIPÓTESIS]** que "no depender de nuestro propio fulfillment" o "arquitectura de plataforma multi-producto" sean diferenciadores que el usuario final perciba y valore activamente, en vez de un detalle de arquitectura invisible para quien solo quiere su sticker — no validado con usuarios.

## ¿Qué problema resolvemos mejor que Creative Fabrica?

Creative Fabrica es, en su núcleo, un **marketplace de assets por suscripción** (fuentes, SVGs, plantillas) con un editor complementario (Creative Fabrica Studio) para consumir ese catálogo — no una herramienta centrada en el rigor de producción de un tipo de producto específico. No se encontró evidencia pública de que su editor priorice líneas de corte, sangrado o especificaciones físicas de un sticker de la misma forma que Kittl o Canva.

Impulso no compite por el catálogo de assets (Creative Fabrica lleva desde 2016 construyendo el suyo, con más de un millón de productos) — compite ofreciendo la **herramienta de creación** con el rigor de producción que el catálogo por sí solo no resuelve. Alguien puede tener la fuente y el SVG perfectos de Creative Fabrica y aun así no tener un archivo listo para imprenta sin una herramienta que entienda sangrado/línea de corte/especificación física.

## ¿Cuál es nuestra ventaja estructural?

1. **Arquitectura de plataforma real, no de producto único con muchas funciones.** `Document Schema → Engine → Renderer`, con dependencia en una sola dirección y verificada activamente (`madge --circular`, sin Konva en `package.json` del Engine) — un módulo nuevo no reescribe el editor. Ninguno de los cuatro competidores analizados está construido así (ver `03-Competitive-Landscape.md`, "Arquitectura de producto": los cuatro son monolíticos).
2. **Rigor de producción desde el modelo de datos, no como una guía visual añadida.** La línea de corte es un tipo de dato desde Foundation 1, no un truco de capas manual (a diferencia de Canva) ni una funcionalidad aislada de un producto monolítico (a diferencia de Kittl).
3. **Disciplina de ingeniería documentada y verificable**, no una promesa de marketing: cada decisión arquitectónica tiene un ADR, un presupuesto de rendimiento explícito, y un estándar de calidad mínimo aplicado desde el primer Foundation (ver [`../product/02-Product-Principles.md`](../product/02-Product-Principles.md)).
4. **Sin dependencia de infraestructura ni de un servicio de fulfillment propio** en su etapa actual — el producto funciona 100% local, y el objetivo de exportación es un archivo verdaderamente portable a cualquier proveedor de impresión, no una palanca para atar al usuario a un servicio propio.

**[HIPÓTESIS]** que estas ventajas estructurales se traduzcan en una ventaja competitiva percibida por el usuario final (no solo defendible internamente) — la validación real llega cuando exista un segundo módulo real demostrando que el núcleo se reutiliza sin reescritura (ver [`../product/04-Roadmap.md`](../product/04-Roadmap.md), v2.0).

## ¿Qué jamás intentaremos competir?

- **No competiremos por ser el editor de diseño más amplio y genérico** (el terreno de Canva) — más superficie de casos de uso no relacionados va directamente en contra de la simplicidad que Impulso protege (ver [`../product/02-Product-Principles.md`](../product/02-Product-Principles.md), "Simplicidad").
- **No competiremos por tener el catálogo de assets más grande** (el terreno de Creative Fabrica) — construir y curar un millón de productos de contenido es un negocio distinto al de construir la herramienta de creación.
- **No competiremos por ser el mejor generador de mockups/imágenes de presentación** (el terreno de Placeit) — es un problema adyacente, no el problema central que Impulso resuelve (ver [`../product/01-Product-Vision.md`](../product/01-Product-Vision.md), "Qué NO intenta resolver").
- **No competiremos operando nuestro propio servicio de impresión/fulfillment como el camino principal** (a diferencia de Kittl Print) — Impulso termina en "aquí está tu archivo listo"; qué proveedor de impresión usa cada persona es su elección, no una dependencia que el producto intente capturar, hasta que exista una razón de negocio real y explícitamente decidida para cambiar eso (ver [`../product/05-Technical-Debt.md`](../product/05-Technical-Debt.md)).
- **No competiremos por ser una herramienta de diseño profesional para diseñadores avanzados** (el terreno de Illustrator/Figma) — quien ya tiene su flujo resuelto ahí tiene necesidades (plugins avanzados, integración con su propio pipeline) que compiten directamente con la simplicidad que Impulso protege.
