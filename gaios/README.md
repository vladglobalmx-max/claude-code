# Manual GAIOS — Global AI Operating System

Sistema operativo empresarial para empresas B2B: elimina trabajo repetitivo, reduce errores, incrementa ventas y productividad, y reduce la dependencia del Director General.

Cada módulo sigue el mismo estándar documental de 15 secciones (ver `00-arquitectura-maestra/plantilla-estandar-documento.md`), auditado por el checklist de aceptación (`00-arquitectura-maestra/checklist-modulo0.md`) antes de publicarse.

## Índice de módulos

| # | Módulo | Estado |
|---|---|---|
| [00](00-arquitectura-maestra/00-arquitectura-maestra.md) | Arquitectura Maestra | 🟢 Publicado |
| [01](01-comercial-crm/01-comercial-crm.md) | Comercial / CRM | 🟢 Publicado |
| [02](02-marketing/02-marketing.md) | Marketing | 🟢 Publicado |
| [03](03-operaciones-sop/03-operaciones-sop.md) | Operaciones / SOPs Core | 🟢 Publicado |
| [04](04-compras/04-compras.md) | Compras / Cadena de Suministro | 🟢 Publicado |

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
  01-comercial-crm/
    01-comercial-crm.md              ← capítulo principal (15 secciones)
    sop-calificacion-leads-meddic.md ← SOP: calificación BANT/MEDDIC
    sop-revision-pipeline-semanal.md ← SOP: forecast call semanal
    sop-higiene-datos-crm.md         ← SOP: higiene de datos del CRM
    plantilla-ficha-oportunidad.md   ← plantilla de campos del CRM
    checklist-modulo1.md             ← checklist de aceptación
    prompts-ia-modulo1.md            ← prompts de IA reutilizables
    kpis-dashboard-comercial.md      ← formulario/dashboard de seguimiento
  02-marketing/
    02-marketing.md                  ← capítulo principal (15 secciones)
    sop-generacion-contenido.md      ← SOP: calendario y producción editorial
    sop-lead-scoring-mql.md          ← SOP: lead scoring y SLA Marketing-Ventas
    sop-gestion-campanas.md          ← SOP: ciclo de vida de campañas
    plantilla-brief-campana.md       ← plantilla de brief de campaña
    checklist-modulo2.md             ← checklist de aceptación
    prompts-ia-modulo2.md            ← prompts de IA reutilizables
    kpis-dashboard-marketing.md      ← formulario/dashboard de seguimiento
  03-operaciones-sop/
    03-operaciones-sop.md            ← capítulo principal (15 secciones)
    sop-mapeo-proceso-sipoc.md       ← SOP: mapeo de procesos (SIPOC)
    sop-analisis-causa-raiz.md       ← SOP: 5 Whys / Ishikawa
    sop-gestion-no-conformidades.md  ← SOP: gestión de no conformidades
    plantilla-proyecto-dmaic.md      ← plantilla de charter DMAIC
    checklist-modulo3.md             ← checklist de aceptación
    prompts-ia-modulo3.md            ← prompts de IA reutilizables
    kpis-dashboard-operaciones.md    ← formulario/dashboard de seguimiento
  04-compras/
    04-compras.md                    ← capítulo principal (15 secciones)
    sop-segmentacion-proveedores-kraljic.md ← SOP: Matriz de Kraljic
    sop-cotizacion-rfq.md            ← SOP: cotización y RFQ
    sop-control-tres-vias.md         ← SOP: three-way match
    plantilla-scorecard-proveedor.md ← plantilla de evaluación de proveedor
    checklist-modulo4.md             ← checklist de aceptación
    prompts-ia-modulo4.md            ← prompts de IA reutilizables
    kpis-dashboard-compras.md        ← formulario/dashboard de seguimiento
  roadmap/
    roadmap-modulos.md               ← taxonomía y dependencias de todos los módulos
  <nn>-<nombre-del-siguiente-modulo>/
    ...
```

## Gobierno

Ningún módulo se publica sin: (1) cumplir las 15 secciones, (2) pasar el checklist de aceptación, (3) ser validado por el Director de área dueño del proceso. Ver el flujo completo en `00-arquitectura-maestra/sop-alta-nuevo-modulo.md`.
