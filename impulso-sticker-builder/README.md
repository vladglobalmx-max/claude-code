# Impulso Sticker Builder

Herramienta profesional de diseño de stickers listos para imprenta (vector-first, con línea de corte/die-cut). Es el **primer módulo** construido sobre **Impulso Engine**, el núcleo reutilizable (Canvas, Layers, Assets, Fonts, Export, History, Plugins) del que también se alimentarán futuros módulos como Planner Builder o Coloring Book Builder.

**Estado actual:** Fase 0 — diseño de arquitectura (v3). Impulso Engine nunca depende de una librería de render: todo proyecto se representa en un Document Schema propio, y el renderer (Konva, hoy) es un adaptador reemplazable — `Document Schema → Engine → Renderer → Konva`. Sin código todavía.

**Nota sobre ubicación:** este documento vive temporalmente en este monorepo (rama `claude/impulso-sticker-builder-arch-cef7ff`) solo como registro de la fase de diseño. El código del producto se desarrollará en un **repositorio nuevo y separado** (decisión tomada en la Fase 0), no aquí junto a `gaios/` y `platform/`.

Ver el diseño completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
