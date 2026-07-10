# Manual GAIOS — Global AI Operating System

Sistema operativo empresarial para empresas B2B: elimina trabajo repetitivo, reduce errores, incrementa ventas y productividad, y reduce la dependencia del Director General.

Cada módulo sigue el mismo estándar documental de 15 secciones (ver `00-arquitectura-maestra/plantilla-estandar-documento.md`), auditado por el checklist de aceptación (`00-arquitectura-maestra/checklist-modulo0.md`) antes de publicarse.

## Índice de módulos

| # | Módulo | Estado |
|---|---|---|
| [00](00-arquitectura-maestra/00-arquitectura-maestra.md) | Arquitectura Maestra | 🟢 Publicado |

Ver el roadmap completo y el orden de construcción sugerido en [`roadmap/roadmap-modulos.md`](roadmap/roadmap-modulos.md).

## Estructura del repositorio

```
gaios/
  00-arquitectura-maestra/
    00-arquitectura-maestra.md       ← capítulo principal (15 secciones)
    plantilla-estandar-documento.md  ← plantilla reutilizable para nuevos módulos
    sop-alta-nuevo-modulo.md         ← SOP: cómo se da de alta un módulo nuevo
    checklist-modulo0.md             ← checklist de aceptación de calidad
    prompts-ia-modulo0.md            ← prompts de IA reutilizables
    kpis-dashboard.md                ← formulario/dashboard de seguimiento
  roadmap/
    roadmap-modulos.md               ← taxonomía y dependencias de todos los módulos
  <nn>-<nombre-del-siguiente-modulo>/
    ...
```

## Gobierno

Ningún módulo se publica sin: (1) cumplir las 15 secciones, (2) pasar el checklist de aceptación, (3) ser validado por el Director de área dueño del proceso. Ver el flujo completo en `00-arquitectura-maestra/sop-alta-nuevo-modulo.md`.
