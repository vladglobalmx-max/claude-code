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
| [05](05-rrhh/05-rrhh.md) | Recursos Humanos | 🟢 Publicado |
| [06](06-finanzas/06-finanzas.md) | Finanzas / Control | 🟢 Publicado |
| [07](07-tecnologia/07-tecnologia.md) | Tecnología / Infraestructura | 🟢 Publicado |
| [08](08-automatizacion-ia/08-automatizacion-ia.md) | Automatización e IA Transversal | 🟢 Publicado |

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
  05-rrhh/
    05-rrhh.md                       ← capítulo principal (15 secciones)
    sop-seleccion-estructurada.md    ← SOP: selección estructurada
    sop-onboarding-30-60-90.md       ← SOP: onboarding 30-60-90
    sop-gestion-desempeno-okr.md     ← SOP: gestión de desempeño (OKRs)
    plantilla-scorecard-puesto.md    ← plantilla de scorecard de puesto
    checklist-modulo5.md             ← checklist de aceptación
    prompts-ia-modulo5.md            ← prompts de IA reutilizables
    kpis-dashboard-rrhh.md           ← formulario/dashboard de seguimiento
  06-finanzas/
    06-finanzas.md                   ← capítulo principal (15 secciones)
    sop-presupuesto-anual.md         ← SOP: presupuesto anual por driver
    sop-ciclo-cobranza.md            ← SOP: ciclo de cobranza (Order-to-Cash)
    sop-cierre-contable-mensual.md   ← SOP: cierre contable mensual
    plantilla-reporte-financiero-mensual.md ← plantilla de reporte mensual
    checklist-modulo6.md             ← checklist de aceptación
    prompts-ia-modulo6.md            ← prompts de IA reutilizables
    kpis-dashboard-finanzas.md       ← formulario/dashboard de seguimiento
  07-tecnologia/
    07-tecnologia.md                 ← capítulo principal (15 secciones)
    sop-gestion-accesos-iam.md       ← SOP: gestión de accesos e identidad
    sop-gestion-cambios.md           ← SOP: gestión de cambios
    sop-backup-recuperacion.md       ← SOP: respaldo y recuperación
    plantilla-catalogo-integraciones.md ← catálogo de integraciones
    checklist-modulo7.md             ← checklist de aceptación
    prompts-ia-modulo7.md            ← prompts de IA reutilizables
    kpis-dashboard-tecnologia.md     ← formulario/dashboard de seguimiento
  08-automatizacion-ia/
    08-automatizacion-ia.md          ← capítulo principal (15 secciones)
    sop-priorizacion-automatizaciones.md ← SOP: matriz valor-factibilidad
    sop-gobierno-ia-human-in-the-loop.md ← SOP: gobierno de IA
    plantilla-ficha-automatizacion.md ← ficha de automatización
    checklist-modulo8.md             ← checklist de aceptación
    prompts-ia-modulo8.md            ← prompts de IA reutilizables
    kpis-dashboard-automatizacion.md ← formulario/dashboard de seguimiento
  roadmap/
    roadmap-modulos.md               ← taxonomía y dependencias de todos los módulos
  <nn>-<nombre-del-siguiente-modulo>/
    ...
```

## Gobierno

Ningún módulo se publica sin: (1) cumplir las 15 secciones, (2) pasar el checklist de aceptación, (3) ser validado por el Director de área dueño del proceso. Ver el flujo completo en `00-arquitectura-maestra/sop-alta-nuevo-modulo.md`.
