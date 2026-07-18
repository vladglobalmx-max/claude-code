# 04 — Unique Value Proposition

> Construida a partir de [`01-Positioning.md`](01-Positioning.md), [`02-Ideal-Customer-Profiles.md`](02-Ideal-Customer-Profiles.md) y [`03-Competitive-Landscape.md`](03-Competitive-Landscape.md). El frasing de marketing aquí es un punto de partida para iterar, no una decisión final de copywriting — debe probarse con usuarios reales de los ICP definidos antes de fijarse como mensaje público permanente.

---

## La frase

> **Impulso: de tu idea a un archivo verdaderamente listo para imprenta — sin aprender un software de diseño.**

Alternativas más cortas para distintos contextos de uso (mismo mensaje central, distinta extensión):

- **Ultra-corta (tagline):** "Diseña. Nosotros nos aseguramos de que se pueda imprimir."
- **Una línea (bio/redes sociales):** "El editor que convierte tu idea en un sticker listo para imprenta, sin curva de aprendizaje."

## Por qué esta frase y no otra

Cada palabra responde a algo verificado en el análisis competitivo (`03-Competitive-Landscape.md`), no a una aspiración genérica:

- **"Verdaderamente listo para imprenta"** — ataca directamente la debilidad confirmada de Canva: no genera líneas de corte reales, solo una guía visual manual. Es una afirmación que Impulso puede sostener porque la línea de corte es un dato de primera clase desde el Document Schema (ADR-0002), no un truco de capas.
- **"Sin aprender un software de diseño"** — la propuesta de simplicidad frente a Illustrator/Figma (el terreno que Impulso explícitamente no disputa, ver `01-Positioning.md`) y frente a la complejidad de navegar una herramienta de propósito general como Canva para un objetivo estrecho.
- Deliberadamente **NO dice** "el editor más completo" ni "todo en un solo lugar" — esas promesas ya las posee Canva de forma consolidada; competir en ese terreno es competir donde Impulso pierde por diseño (ver `01-Positioning.md`, "Qué jamás intentaremos competir").
- Deliberadamente **NO menciona IA** todavía — ninguna funcionalidad de IA existe hoy en la plataforma (ver `../product/05-Technical-Debt.md`); prometerla ahora sería una afirmación no sostenida por el producto actual.

## Narrativa corta (para marketing)

Crear un sticker debería ser tan simple como tener la idea. En cambio, hoy hay que elegir: aprender un software de diseño profesional que no tiene relación con lo simple que debería ser la tarea, o usar una herramienta genérica de arrastrar y soltar que no tiene idea de cómo se imprime realmente un producto físico — el resultado se ve bien en la pantalla, y falla en la imprenta.

Impulso resuelve ese dilema. Es un editor que entiende, desde el primer diseño, que lo que estás creando se va a convertir en un objeto real: la línea de corte no es una guía que dibujas tú mismo y esperas que funcione — es parte del diseño desde el principio. Seleccionas, mueves, redimensionas y rotas tus elementos con la fluidez de cualquier editor moderno, y cuando exportas, obtienes un archivo que cualquier imprenta puede usar directamente, sin sorpresas ni retrabajo.

Y esto es solo el principio. Impulso Sticker Builder es el primer módulo de Impulso Platform — la misma base que hace posible crear stickers está diseñada, desde su arquitectura, para dar vida a más herramientas de creación de productos físicos: planners, coloring books, flashcards, tarjetas, y lo que venga después. Un solo lugar para aprender, muchas formas de crear.

## Cómo se valida (antes de comprometerse con este mensaje públicamente)

- Probar la frase principal y las variantes contra los cinco Ideal Customer Profiles (`02-Ideal-Customer-Profiles.md`) — especialmente Etsy Sticker Seller y Planner Designer, los más cercanos a poder usar el producto hoy.
- Confirmar con usuarios reales que "línea de corte real vs. simulada" es un dolor que reconocen y priorizan — no solo una ventaja técnica defendible internamente (ver `01-Positioning.md`, las marcas **[HIPÓTESIS]** sobre percepción de usuario).
- Revisar este documento cuando exista la primera versión pública real de Sticker Builder con exportación funcionando (ver `../product/04-Roadmap.md`, Beta/v1.0) — hoy la promesa de "archivo listo para imprenta" es la dirección del producto, no una capacidad ya construida (Export Engine sigue sin implementación, ver `../product/05-Technical-Debt.md`).
