# Changelog — Planner Digital Académico 2026

Todas las fechas en horario de Ciudad de México.

## [1.0.0] — 2026-07-17

Primera entrega funcional (MVP) del planner digital académico para docentes.

### Añadido
- Arquitectura de módulo único (`index.html`) sin frameworks ni dependencias externas, con `Store` central sobre `localStorage`, migraciones por `schemaVersion`, recuperación automática ante datos dañados y respaldos previos a operaciones destructivas.
- Onboarding de 9 pasos: bienvenida, privacidad, perfil docente, ciclo escolar, materias, grupos, evaluación, estudiantes y resumen final.
- Protección local opcional con PIN (4–8 dígitos) usando Web Crypto (SHA-256 + sal), bloqueo manual y automático configurable.
- Gestión completa de ciclos escolares, periodos y días inhábiles/vacaciones, con estados (próximo/activo/cerrado/archivado) y control de un solo ciclo activo.
- Materias, grupos y estudiantes con importación por CSV (con vista previa y validación) y por lista pegada.
- Calendario propio (día/semana/mes/agenda/ciclo escolar) con eventos recurrentes básicos.
- Horario semanal con detección de conflictos, suspensión de clases por fecha y vistas por grupo/materia/día.
- Unidades didácticas con cálculo de avance basado en planeaciones o avance manual.
- Planeaciones con duplicado, reasignación de grupo, plantillas y flujo de "marcar como impartida" con reflexión guiada.
- Actividades y tareas, asistencia con indicadores (porcentaje, ausencias, retardos, ausencias consecutivas).
- Motor de evaluaciones y calificaciones: categorías con ponderación validada (debe sumar 100%), cálculo por fórmula documentada, y distinción explícita entre **sin calificar**, **cero**, **ausente** y **exento** (los exentos se excluyen y las ponderaciones restantes se renormalizan; nunca se convierte automáticamente un pendiente en cero).
- Seguimiento estudiantil, contactos y comunicación familiar, reuniones (con conversión de acuerdos en evento/seguimiento/meta/actividad), sustituciones (plan y reporte), recursos, inventario, metas docentes, desarrollo profesional y revisión semanal (parte automática + reflexiva).
- Central de reportes imprimibles con estilos de impresión dedicados y exportación CSV segura (BOM UTF-8, neutralización de fórmulas peligrosas `= + - @`).
- Respaldo/restauración completos en JSON con vista previa, confirmación y PIN.
- Diseño responsivo (360–2560 px) con navegación lateral en escritorio y navegación inferior + menú "Más" en móvil, vista de tabla/tarjetas alternable.
- Tema claro/oscuro/automático, tamaño de texto ajustable y `prefers-reduced-motion`.
- Identidad visual Bookfluence Teachers con paleta e iconografía SVG originales.

### Notas de esta versión
- MVP enfocado en planificación y seguimiento docente individual; no es un LMS ni un portal para estudiantes/familias.
