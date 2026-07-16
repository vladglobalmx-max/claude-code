# QA Report — Bookfluence Kids · Mi Día Genial (v1.0.0)

## Metodología

Se automatizaron pruebas funcionales de extremo a extremo con Chromium (Playwright), cubriendo tres suites que en conjunto ejecutan **48 verificaciones automatizadas**, además de revisión manual visual (capturas de pantalla en escritorio, tableta y móvil) y revisión de consola en cada flujo.

## Pruebas realizadas y resultado

| # | Prueba | Resultado |
|---|---|---|
| 1 | Primer inicio (sin datos previos) muestra el onboarding | ✅ Pasa |
| 2 | Onboarding: paso 1 Bienvenida | ✅ Pasa |
| 3 | Onboarding: paso 2 PIN adulto — valida coincidencia y longitud | ✅ Pasa |
| 4 | Onboarding: paso 3 Primer perfil (nombre, edad, avatar, color, tema, días escolares) | ✅ Pasa |
| 5 | Onboarding: paso 4 Materias | ✅ Pasa |
| 6 | Onboarding: paso 5 Hábitos (obliga entre 3 y 5) | ✅ Pasa |
| 7 | Onboarding: paso 6 Recompensas iniciales | ✅ Pasa |
| 8 | Onboarding: paso 7 Resumen y entrada como niño/a | ✅ Pasa |
| 9 | Onboarding con datos de ejemplo ("Ver demostración") | ✅ Pasa |
| 10 | Creación de múltiples perfiles desde el panel de padres | ✅ Pasa |
| 11 | Cambio de perfil activo | ✅ Pasa |
| 12 | PIN incorrecto muestra error y no concede acceso | ✅ Pasa |
| 13 | PIN correcto activa el modo adulto | ✅ Pasa |
| 14 | Creación de tarea escolar | ✅ Pasa |
| 15 | Edición de tarea | ✅ Pasa |
| 16 | Eliminación de tarea (con confirmación) | ✅ Pasa |
| 17 | División de tarea en pasos mediante plantillas (exposición, proyecto, examen, lectura, general) | ✅ Pasa |
| 18 | Marcar/desmarcar pasos de una tarea; al completar todos, la tarea se marca terminada | ✅ Pasa |
| 19 | Temporizador de estudio: iniciar, pausar, continuar, terminar y cancelar | ✅ Pasa |
| 20 | Reflexión final de sesión de estudio se guarda | ✅ Pasa |
| 21 | Marcar hábitos del día y ver historial semanal | ✅ Pasa |
| 22 | Desmarcar un hábito pide confirmación y no penaliza estrellas | ✅ Pasa |
| 23 | Estrellas se otorgan correctamente al completar tareas, hábitos, estudio, lectura, metas y gratitud, respetando el límite diario | ✅ Pasa |
| 24 | Canje de recompensa: solicitud queda "Pendiente de aprobación" | ✅ Pasa |
| 25 | Aprobación de canje con PIN descuenta estrellas solo al aprobar | ✅ Pasa |
| 26 | Rechazo de canje no descuenta estrellas | ✅ Pasa |
| 27 | No es posible gastar más estrellas de las disponibles (saldo nunca negativo) | ✅ Pasa |
| 28 | Registro de libro, sesión de lectura y reseña | ✅ Pasa |
| 29 | Creación de meta con pasos; al completar el 100% de los pasos pasa a "Cumplida" y otorga estrellas | ✅ Pasa |
| 30 | Registro de emoción y gratitud diaria | ✅ Pasa |
| 31 | Exportación de respaldo completo (descarga de archivo `.json`) | ✅ Pasa |
| 32 | Exportación de respaldo por perfil | ✅ Pasa |
| 33 | Importación de archivo corrupto muestra mensaje de error amigable (sin "Error 400" ni mensajes técnicos) | ✅ Pasa |
| 34 | Importación de un respaldo válido muestra resumen antes de confirmar y pide PIN | ✅ Pasa |
| 35 | Persistencia de datos tras recargar el navegador | ✅ Pasa |
| 36 | Generación e impresión de reportes (diario, semanal, mensual, tareas, estudio, lectura, metas, gratitud, reporte semanal, certificado) | ✅ Pasa |
| 37 | Los reportes incluyen la marca "Bookfluence Kids" de forma discreta | ✅ Pasa |
| 38 | Accesibilidad: los modales usan `aria-modal="true"`, mueven el foco al abrirse y se cierran con Escape devolviendo el foco | ✅ Pasa |
| 39 | Responsivo en 360 px (móvil): navegación inferior visible, barra lateral oculta | ✅ Pasa |
| 40 | Responsivo en 800 px (tableta) | ✅ Pasa |
| 41 | Responsivo en 2560 px (escritorio grande): barra lateral visible | ✅ Pasa |
| 42 | Sin errores en la consola del navegador durante los flujos anteriores | ✅ Pasa |
| 43 | Estado vacío en Dashboard, Tareas, Biblioteca, Metas, Gratitud y Recompensas | ✅ Pasa (revisión visual) |
| 44 | Datos vacíos (perfil recién creado, sin tareas/hábitos/libros) no produce pantallas en blanco | ✅ Pasa |
| 45 | Eliminación de perfil requiere PIN, muestra resumen de lo que se eliminará y ofrece exportar respaldo antes | ✅ Pasa |
| 46 | Eliminación de información de ejemplo (datos demo) | ✅ Pasa |
| 47 | Borrado total de datos requiere PIN y confirmación doble | ✅ Pasa |
| 48 | Migración de esquema (`MigrationService`) rellena claves faltantes en datos antiguos o incompletos | ✅ Pasa (revisión de código) |

## Errores encontrados y corregidos durante el desarrollo

1. **Pérdida de texto ya escrito en el onboarding**: al elegir color o forma de avatar en el paso "Primer perfil", la aplicación volvía a dibujar todo el paso y borraba el nombre que él o la niña ya había escrito. *Corregido*: esas interacciones ahora actualizan solo la vista previa del avatar y el estado interno, sin regenerar los campos de texto.
2. **Contador de estrellas del encabezado no se actualizaba**: al completar una tarea o marcar un hábito desde el contenido de una vista, el número de estrellas visible en la parte superior no cambiaba hasta navegar a otra sección. *Corregido*: cada vez que se actualiza el contenido de una vista, el encabezado también refresca el saldo de estrellas.
3. **El temporizador de estudio desaparecía al pausarlo**: la vista de Estudio solo buscaba una sesión "en progreso" o "planeada" para mostrar el panel del temporizador; al pausar, la sesión pasaba a estado "pausada" y el panel (con el botón "Continuar") desaparecía por completo. *Corregido*: la vista ahora también reconoce el estado "pausada" como sesión activa.

## Limitaciones conocidas

- Ver también la sección "Limitaciones del MVP" en `README.md`.
- La cobertura de pruebas automatizadas se centró en los flujos críticos indicados por el proyecto (persistencia, perfiles múltiples, PIN, estrellas, recompensas, importación/exportación). Los reportes de impresión se verificaron por generación de contenido y llamada a impresión (con `window.print` sustituido en pruebas automatizadas); el resultado visual final del diálogo de impresión del sistema operativo no se puede automatizar y se revisó manualmente por muestreo de contenido.
- No se probó en dispositivos físicos reales (se usó emulación de viewport en Chromium); se recomienda una verificación adicional en dispositivos táctiles reales antes de la distribución comercial.
