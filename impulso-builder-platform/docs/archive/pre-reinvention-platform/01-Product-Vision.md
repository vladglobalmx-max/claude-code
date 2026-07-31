> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba "Impulso Platform" con Sticker Builder como primer módulo de un ecosistema de varios productos futuros — modelo de plataforma descartado por la reinvención hacia THÖREN 2.0 (`THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`). Se conserva íntegro como registro histórico de la intención original. La función que este documento cumplía ahora vive en la cadena vigente de THÖREN — ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) §Fuentes de verdad para la fuente única vigente de cada tema.

# 01 — Product Vision

> Documento estratégico. No describe código ni implementación — describe por qué existe Impulso y para quién. La documentación técnica vive en [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../adr/`](../adr) y los README de cada paquete.

---

## Qué es Impulso

**Impulso Platform** es una plataforma de creación de productos visuales, construida sobre un núcleo reutilizable (**Impulso Engine**) del que se alimentan capacidades compartidas (Shared Services, Design System, AI Engine, Asset Library, Export Engine) y, sobre todo eso, **Modules** independientes — cada uno resolviendo un tipo de producto distinto (stickers, planners, coloring books, flashcards, worksheets, journals, bundles, y los que vengan después) sin reescribir el editor desde cero cada vez. Ver [`03-Architecture-Map.md`](03-Architecture-Map.md) para el mapa completo de esta estructura.

**Sticker Builder** es el primer módulo construido: un editor visual enfocado en un objetivo único — llevar a alguien desde "tengo una idea de sticker" hasta "tengo un archivo listo para imprenta" (PNG/SVG/PDF con línea de corte y sangrado), sin fricción y sin necesitar software de diseño profesional. Es la prueba de concepto de la plataforma, no la plataforma en sí misma — Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder y Bundle Builder son módulos igual de válidos sobre el mismo Impulso Engine, hoy en distintas etapas de planeación.

Impulso Platform no es "un editor de canvas más". Es la apuesta de que la mayoría de los "editores de producto visual" (stickers, planners, coloring books, flashcards, worksheets, journals...) comparten el mismo problema de fondo — capas, formas, selección, transformación, exportación, historial — y ese problema merece resolverse **una sola vez**, bien, y reutilizarse en cada módulo nuevo.

## Qué problema resuelve

Hoy, alguien que quiere crear un sticker personalizado (o un planner, o un coloring book) tiene dos caminos malos:

1. **Aprender una herramienta de diseño profesional** (Illustrator, Photoshop, Figma) — con una curva de aprendizaje que no tiene relación con lo simple que debería ser la tarea real ("quiero un sticker con este dibujo y este texto").
2. **Usar una herramienta genérica de "arrastrar y soltar"** que no entiende nada específico de producción física — sin líneas de corte, sin sangrado, sin garantía de que lo que se ve en pantalla sea imprimible tal cual.

Impulso resuelve el punto intermedio: **una herramienta con la simplicidad de un editor casual, pero con el rigor de producción de una herramienta profesional** — donde "exportar" no es un archivo genérico, es un archivo que un proveedor de impresión puede recibir y usar directamente.

## Qué NO intenta resolver

Ser explícito sobre esto es tan importante como la visión positiva:

- **No es un editor de diseño genérico** tipo Illustrator o Figma — no compite por reemplazar herramientas profesionales para diseñadores avanzados que ya saben lo que hacen. Impulso optimiza para quien NO quiere convertirse en diseñador para lograr su resultado.
- **No gestiona la venta ni la producción física** — no hay checkout, pagos, carritos de compra, ni integración con proveedores de impresión/fulfillment. Impulso termina en "aquí está tu archivo listo"; qué pasa después (imprimirlo uno mismo, mandarlo a imprimir, venderlo) es responsabilidad de quien lo usa, no del producto — hasta que exista una razón de negocio real para cambiar eso.
- **No es (todavía) una plataforma social ni colaborativa** — sin cuentas, sin compartir proyectos entre usuarios, sin edición simultánea. Es una herramienta de uso individual, local al dispositivo, en su etapa actual.
- **No es una plataforma de plugins públicos ni un marketplace** — la arquitectura de módulos existe para que Impulso Platform mismo pueda crecer (Sticker Builder, Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder, Bundle Builder...), no (todavía) para que terceros publiquen extensiones.

Ver [`05-Technical-Debt.md`](05-Technical-Debt.md) para el registro completo de lo que se pospone deliberadamente, no lo que se descarta.

## Misión

Hacer que crear un producto visual listo para producción sea tan simple como debería haber sido siempre — sin exigirle al usuario que aprenda una herramienta de diseño para lograrlo.

## Visión

Que Impulso sea, con el tiempo, la plataforma de referencia para crear productos visuales de nicho — no un editor genérico que hace de todo mediocremente, sino una familia de editores especializados (stickers, planners, coloring books, y los que surjan) que comparten un mismo núcleo sólido, la misma calidad de experiencia, y la misma garantía de resultado listo para producción real.

## Propuesta de valor

- **De idea a archivo imprimible en minutos**, no en horas de aprender software de diseño.
- **Calidad de producción real** — líneas de corte, sangrado, especificaciones físicas correctas — no una aproximación visual que falla al imprimirse.
- **Un núcleo, múltiples productos** — cada módulo nuevo (Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder, Bundle Builder...) hereda selección, transformación, historial y exportación ya resueltos, en vez de reconstruirlos.
- **Sin fricción de cuenta ni de infraestructura** en su etapa actual — abrir la app y empezar a diseñar, sin registro, sin esperar a un servidor.

## Usuario ideal

**Hoy (Alpha/Beta):** una persona o un negocio pequeño que quiere crear un producto visual específico (empezando por stickers) sin ser diseñador — un creador de contenido que quiere stickers de su marca, alguien montando un emprendimiento pequeño de impresión bajo demanda, alguien haciendo un regalo personalizado. No necesita entender capas, vectores ni tipografía profesional; necesita ver su idea convertirse en un archivo que puede llevar a imprimir.

**No es** (todavía, y quizás nunca dentro del mismo producto): un estudio de diseño profesional que ya tiene su propio flujo en Illustrator/Figma y busca reemplazarlo — ese usuario tiene necesidades (plugins avanzados, integración con su propio pipeline, control pixel-perfect) que compiten directamente con la simplicidad que Impulso protege.

## Diferenciadores

1. **Arquitectura modular real, no de marketing.** `Document Schema → Engine → Renderer` con dependencia en una sola dirección (ver ADR-0001) — no es una promesa, es una regla verificada en cada Foundation (`madge --circular`, Engine sin Konva en `package.json`). Un módulo nuevo no reescribe el editor.
2. **Calidad de producción desde el diseño de datos, no como un plugin tardío.** La línea de corte es un `path` con `metadata.role: "die-line"` desde el Document Schema (ver ADR-0002) — el rigor de impresión no se agrega después, está en los cimientos.
3. **100% local en su etapa actual, sin ser una limitación accidental.** Sin backend, sin cuentas — una decisión deliberada de "no construir infraestructura que no se necesita todavía" (ver ADR-0009 y `../ARCHITECTURE.md` §9), no una carencia técnica.
4. **Disciplina de ingeniería visible en cada decisión.** Cada pieza arquitectónicamente relevante tiene un ADR documentado (`docs/adr/`), un presupuesto de rendimiento explícito (`docs/PERFORMANCE_BUDGET.md`), y un estándar de calidad mínimo verificado (90% de cobertura, sin dependencias circulares, API pública estable) — ver [`02-Product-Principles.md`](02-Product-Principles.md).

## Objetivos del producto

1. Entregar un editor de stickers completo y usable de principio a fin (creación → edición → exportación print-ready) sin necesitar cuenta ni backend.
2. Validar que el núcleo (Impulso Engine) generaliza a un segundo módulo real (Planner Builder, Coloring Book Builder, o cualquiera de los módulos planeados — ver [`03-Architecture-Map.md`](03-Architecture-Map.md)) sin reescritura — la prueba definitiva de que la arquitectura de plataforma no es solo una aspiración.
3. Alcanzar una calidad de experiencia ("feel") comparable a herramientas comerciales de referencia (Canva, Figma) en las interacciones que sí construye (selección, arrastre, resize, rotación) — no una aproximación tosca.
4. Mantener la plataforma evolutiva sin deuda arquitectónica oculta: toda decisión que comprometa el futuro (rendimiento, compatibilidad de API, alcance) se documenta explícitamente en el momento en que se toma, no se descubre después.

## Principios fundamentales

Ver [`02-Product-Principles.md`](02-Product-Principles.md) para el detalle completo de cada uno, con ejemplos concretos ya aplicados en el proyecto:

- Simplicidad
- Velocidad
- Calidad comercial
- Modularidad
- UX First
- AI Provider Agnostic
- Performance First
- Offline First (cuando aplique)
