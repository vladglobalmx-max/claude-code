# Roadmap del Sistema de Templates (Diseño, no implementación ni compromiso de fechas)

**Alcance: exclusivamente secuenciación de producto.** Ninguna versión aquí descrita fue construida ni fue autorizada para construirse. Este documento propone un **orden razonable** de evolución del sistema de templates definido en `TEMPLATE_LIBRARY_ARCHITECTURE.md`, `TEMPLATE_CATALOG_v1.md` y `UX_TEMPLATE_LIBRARY.md` — no es una fecha de calendario ni una autorización para empezar a programar.

## Principio que gobierna este roadmap

`docs/product/PRODUCT_BACKLOG.md` ya establece, con carácter de decisión de producto vigente, que Marketplace/Plugins públicos y funciones de colaboración son prioridad **Baja**, condicionadas a "evidencia real de demanda" y a una base de usuarios ya existente — explícitamente: *"no se construyen sin evidencia de demanda real"*. Este roadmap no contradice esa decisión: las versiones que tocan marketplace/IA quedan en v2.0, marcadas como condicionadas, nunca como compromiso firme. Lo que sí se puede secuenciar con confianza son las mejoras que no dependen de esa evidencia — catálogo, búsqueda, organización — porque benefician a todo usuario de v1.0 sin necesitar marketplace ni cuentas.

---

## v1.1 — Catálogo y descubrimiento (sin marketplace, sin IA, sin cuentas)

**Objetivo**: que el catálogo deje de sentirse "de fábrica" (3 templates) y empiece a sentirse como una biblioteca real, sin ningún cambio de modelo de negocio.

Contenido propuesto:
- Extensión retrocompatible de `TemplateDescriptor` (categoría, forma, dificultad, tags reales, colores sugeridos) — arquitectura §1.3.
- Producción real de los 63 templates de `TEMPLATE_CATALOG_v1.md` (diseño de cada asset, thumbnail, `Project` base) — trabajo de contenido, no solo de código.
- Catalog Query Layer (arquitectura §1.2) + búsqueda de texto + filtros de faceta (arquitectura §4.1-4.2).
- Template Card y Template Detail rediseñados (arquitectura §5-6) sobre el patrón visual ya existente.
- Tabs "Todos" / "Recientes" / "Newest" (las que no requieren favoritos ni colecciones todavía).

**Explícitamente fuera de v1.1**: favoritos, colecciones curadas, cualquier concepto de premium/pack, cualquier IA. Se mantiene deliberadamente pequeño para poder entregarse y validarse con usuarios reales antes de invertir en lo siguiente.

**Criterio de salida** (qué debería ser verdad antes de pasar a v1.2): el catálogo de 63 templates está en producción real, la búsqueda/filtros funcionan sobre datos reales (no solo diseño), y hay señal de uso (qué categorías/templates se usan más) — esa señal es justamente el insumo que informa si vale la pena construir v1.2.

---

## v1.2 — Personalización y primer experimento comercial

**Objetivo**: usar la señal de uso de v1.1 para decidir, con datos reales, si vale la pena invertir en más — y dar el primer paso comercial más pequeño posible para probar el modelo antes de comprometerse a un marketplace completo.

Contenido propuesto:
- Favoritos y "Más usados" reales (arquitectura §4.3), con persistencia local (sin requerir cuentas — consistente con que el producto sigue sin sistema de cuentas en v1.0/v1.1).
- Colecciones curadas editorialmente (ej. "Lanzamiento de temporada"), como entidad ligera independiente de `TemplateDescriptor` (arquitectura §4.3).
- **Un solo pack premium de prueba** (no un catálogo premium completo): valida de punta a punta el modelo de `CommercialProduct.productType: "template-pack"` (arquitectura §8.1) con un solo `CommercialProduct` real, reutilizando el Capabilities layer ya existente — el objetivo es probar el mecanismo con el menor riesgo posible, no monetizar agresivamente todavía.
- Mejora de "Guardar como plantilla" con los campos opcionales de categorización (UX §1.4).

**Explícitamente fuera de v1.2**: autores externos, marketplace abierto, checkout de terceros, cualquier IA generativa de contenido. El pack de prueba lo publica y posee THÖREN mismo (`authorId: "thoren"`), no un tercero.

**Criterio de salida**: el experimento de pack premium tiene datos reales de conversión/interés, y solo entonces se decide si un marketplace real (v2.0) tiene sentido de negocio — exactamente el "evaluar con el contexto de negocio de ese momento, no antes" que ya pide `docs/product/04-Roadmap.md`.

---

## v2.0 — Marketplace real e IA (condicionado a evidencia, no a fecha)

**Objetivo**: si —y solo si— v1.2 mostró demanda real, construir el marketplace completo y la primera integración de IA sobre una base de catálogo y comportamiento de usuario ya validada.

Contenido propuesto (todo condicionado, ninguno comprometido):
- Programa de autores externos (`Author` como entidad propia — arquitectura §8.2), con proceso de curaduría/aprobación.
- Ratings, descargas agregadas, versiones de template con `previousVersionId` (arquitectura §8.3).
- Checkout real para packs de terceros, reutilizando `Channel`/`License` ya definidos en el modelo comercial existente — no un sistema de pagos paralelo.
- Primera integración de IA: sugerencia de templates por texto libre (arquitectura §9, punto 1) — la de menor riesgo porque reordena/filtra contenido ya curado, no genera contenido nuevo sin revisar. Las otras 3 ideas de IA de la arquitectura (autocompletado de metadata, variaciones de color, ranking de relevancia) quedan como candidatas de v2.1+ una vez que la primera integración esté validada en producción.

**Explícitamente no incluido en v2.0** (ni implícito para después): ninguna promesa de fecha. Este documento no autoriza construir nada de v2.0 — su único propósito es que, si en el futuro se decide avanzar, exista ya un diseño coherente que no requiera empezar de cero ni contradecir las decisiones de producto ya tomadas.

---

## Resumen de una línea por versión

| Versión | En una frase |
|---|---|
| v1.1 | El catálogo crece de 3 a 63 templates reales, con búsqueda y filtros — cero marketplace, cero IA. |
| v1.2 | Favoritos/colecciones reales + un solo experimento de pack premium, para medir demanda antes de comprometerse a más. |
| v2.0 | Marketplace y IA reales, construidos solo si v1.2 demostró demanda — nunca por calendario. |
