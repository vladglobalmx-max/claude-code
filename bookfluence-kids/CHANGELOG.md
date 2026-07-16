# Changelog

Todas las versiones notables de Bookfluence Kids — Mi Día Genial se documentan en este archivo.

## [1.0.0] - 2026-07-16

### Añadido

- Primera versión funcional completa de la aplicación, como archivo único (`index.html`), sin backend ni dependencias externas.
- Onboarding de 7 pasos: bienvenida, PIN adulto (con Web Crypto API y alternativa local), primer perfil, materias, hábitos, recompensas y resumen final, con opción de cargar datos de ejemplo.
- Persistencia local versionada en `localStorage` bajo la clave `bookfluenceKidsData`, con `MigrationService` para futuras versiones del esquema.
- Gestión de múltiples perfiles infantiles con avatares generados en SVG (sin imágenes ni activos de terceros).
- Dashboard infantil con saludo, estado emocional, prioridades, tareas y hábitos del día, minutos de lectura, meta activa, estrellas y progreso semanal.
- Módulo "Mi día": actividades, prioridades, estado emocional, agua, meta del día y cierre del día con celebración visual.
- Módulo "Mi semana" con vista de escritorio y selector de día para móvil.
- Calendario mensual propio (sin librerías externas) con eventos de distintos tipos y repetición básica.
- Tareas escolares con materia, prioridad, dificultad, tiempo estimado, materiales, notas y división en pasos mediante plantillas internas editables.
- Sesiones de estudio con temporizador robusto ante cambios de pestaña/vista, pausa/continuación y reflexión final.
- Hábitos diarios con vista semanal, porcentaje de cumplimiento y lenguaje siempre positivo (sin rankings ni penalizaciones).
- Biblioteca y lectura: libros, sesiones de lectura y reseñas, con estadísticas de minutos y páginas leídas.
- Metas con pasos, progreso automático y explicación infantil de metas SMART.
- Registro de emociones y gratitud diaria, sin diagnósticos ni conclusiones clínicas.
- Sistema de estrellas y recompensas con límite diario configurable, solicitud de canje y aprobación obligatoria por PIN parental.
- Panel de padres protegido por PIN: resumen, perfiles, tareas, hábitos, recompensas, reportes, configuración y respaldo.
- Reportes imprimibles (plan diario, semanal, mensual, lista de tareas, plan de estudio, registro de lectura, reseña, hoja de metas, gratitud, reporte semanal y certificado de logro), optimizados para impresión con `@media print`.
- Respaldo y restauración en JSON, con validación, resumen previo, confirmación por PIN y respaldo automático previo a cada restauración; exportación también disponible por perfil individual.
- Configuración de apariencia (tema claro/oscuro/automático, tamaño de texto, animaciones reducidas), preferencias (semana, formato de hora, límite de estrellas, duraciones de estudio) y gestión de PIN.
- Diseño responsivo desde 360 px hasta 2560 px, con navegación lateral en escritorio y navegación inferior + menú "Más" en móvil.
- Accesibilidad: navegación por teclado, foco visible, `aria-label`, modales accesibles con cierre por Escape y devolución de foco, soporte de `prefers-reduced-motion`.
