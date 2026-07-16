# Bookfluence Kids — Mi Día Genial

El planificador interactivo para organizar tareas, hábitos, lectura y metas.

Aplicación web de un solo archivo (`index.html`), sin backend, sin servidor y sin conexión a internet. Todos los datos se guardan únicamente en este dispositivo, usando `localStorage` del navegador.

> Esta aplicación es una herramienta de organización y hábitos para niñas y niños de 7 a 12 años. **No es una herramienta médica, psicológica ni de diagnóstico**, y no sustituye el acompañamiento de un adulto.

## Cómo abrir la aplicación

1. Descarga o copia el archivo `index.html` a tu computadora, tableta o teléfono.
2. Haz doble clic sobre el archivo (o ábrelo desde tu navegador con "Abrir archivo").
3. La aplicación funciona completamente sin internet, sin instalación y sin necesidad de un servidor local.

La primera vez que la abras verás un recorrido de bienvenida (onboarding) de 7 pasos que te ayudará a:

1. Conocer la aplicación.
2. Configurar el nombre del adulto y un PIN familiar (4 a 6 números).
3. Crear el primer perfil infantil (nombre, edad, avatar, color, tema visual, días escolares).
4. Elegir las materias escolares que usará ese perfil.
5. Elegir entre 3 y 5 hábitos iniciales.
6. Revisar dos recompensas familiares iniciales.
7. Ver un resumen y entrar como niño o niña, o ir directo al panel de padres.

También puedes elegir "Ver demostración" en la primera pantalla para cargar un perfil de ejemplo (Alex, 10 años) con tareas, hábitos, un libro y una meta ya creados, para explorar la aplicación antes de configurar tu propio perfil. Puedes eliminar esta información de ejemplo en cualquier momento desde Configuración.

## Cómo usar la aplicación

La navegación principal está organizada en módulos, accesibles desde la barra lateral (en pantallas grandes) o desde el menú inferior y el botón "Más" (en teléfonos):

- **Inicio**: resumen del día, estrellas disponibles, accesos rápidos.
- **Mi día**: organiza tus actividades de hoy, tu estado de ánimo, tu meta del día, tu agua y el cierre del día.
- **Mi semana**: vista semanal de tareas, eventos y hábitos.
- **Calendario**: vista mensual y próximos eventos (exámenes, entregas, cumpleaños, actividades familiares, etc.).
- **Tareas**: crea tareas escolares, asígnales materia, prioridad, dificultad y fecha de entrega, y divídelas en pasos pequeños (con plantillas para exposiciones, proyectos, exámenes y lecturas).
- **Estudio**: crea sesiones de estudio con un temporizador (10, 15, 20, 25 minutos o personalizado), con pausa, continuación y reflexión final.
- **Hábitos**: marca tus hábitos diarios y consulta tu cumplimiento semanal. No hay rankings ni mensajes negativos: si un día no se cumple un hábito, la aplicación muestra "Hoy tienes una nueva oportunidad".
- **Biblioteca**: registra libros, sesiones de lectura (minutos y páginas) y reseñas.
- **Metas**: crea metas con pasos, categoría, motivo, fecha objetivo y recompensa, siguiendo una versión infantil de metas SMART (Clara, Lograble, Alcanzable para tu edad, Relevante, con fecha).
- **Gratitud**: registra tu estado emocional del día y tu gratitud diaria (tres cosas que agradeces, algo bueno que pasó, quién te ayudó, etc.).
- **Recompensas**: usa tus estrellas para solicitar una recompensa familiar. Todo canje queda "Pendiente de aprobación" hasta que un adulto lo apruebe con su PIN; solo entonces se descuentan las estrellas.
- **Panel de padres**: protegido con PIN. Incluye resumen, gestión de perfiles, tareas, hábitos, recompensas, reportes, configuración y respaldo.
- **Configuración**: tema (claro/oscuro/automático), tamaño de texto, animaciones reducidas, sonidos, formato de hora, día de inicio de semana, límite diario de estrellas, duraciones de estudio, PIN y datos.

### Sobre el PIN familiar

El PIN protege el modo adulto (panel de padres, aprobación de canjes, borrado de datos y restauración de respaldos) dentro de este dispositivo. Se guarda localmente utilizando un hash con sal mediante la Web Crypto API (PBKDF2-SHA256). Si tu navegador no ofrece Web Crypto, la aplicación usa una alternativa local más simple y te lo indica con un aviso discreto. En ambos casos, **el PIN es un control familiar y no un sistema de seguridad absoluta**.

## Cómo respaldar tu información

1. Ve a **Configuración** (o **Panel de padres → Respaldo**).
2. Elige **Exportar respaldo** para descargar un archivo `.json` con todos tus datos (por ejemplo `mi-dia-genial-respaldo-2026-07-16.json`).
3. También puedes exportar el respaldo de un solo perfil desde **Panel de padres → Respaldo → Respaldo por perfil**.
4. Guarda ese archivo en un lugar seguro (nube personal, USB, correo propio, etc.). La aplicación no sube ni comparte ese archivo por sí misma.

## Cómo restaurar un respaldo

1. Ve a **Configuración** (o **Panel de padres → Respaldo**) y elige **Restaurar respaldo**.
2. Selecciona el archivo `.json` exportado previamente.
3. La aplicación valida el archivo y muestra un resumen (número de perfiles, tareas, hábitos y registros) antes de continuar.
4. Debes confirmar y escribir el PIN familiar para completar la restauración.
5. Antes de reemplazar la información, se guarda automáticamente una copia de tu información actual en este mismo dispositivo, como respaldo de seguridad.

## Impresión y "PDF"

Desde **Panel de padres → Reportes** puedes generar e imprimir: plan diario, plan semanal, calendario mensual, lista de tareas, plan de estudio, registro de lectura, reseña de libro, hoja de metas, gratitud, reporte semanal completo y certificado de logro. La opción "Descargar PDF" abre la vista de impresión de tu navegador; desde ahí elige "Guardar como PDF" en el destino de impresión.

## Navegadores compatibles

- Chrome, Edge y Firefox recientes (últimas 2 versiones), en escritorio y Android.
- Safari reciente en macOS e iOS.
- Requiere JavaScript habilitado y acceso a `localStorage`. Si el navegador no soporta Web Crypto API, se usa una alternativa local para el PIN (ver aviso en pantalla).
- Diseño responsivo desde 360 px de ancho (teléfonos) hasta 2560 px (pantallas grandes).

## Limitaciones del MVP

- Toda la información vive únicamente en el dispositivo y navegador donde se usa; no hay sincronización entre dispositivos salvo mediante exportación/importación manual de respaldos.
- El temporizador de estudio se recalcula con base en la hora real del sistema, por lo que sigue corriendo correctamente si cambias de módulo dentro de la aplicación; si cierras por completo el navegador durante una sesión en curso, esa sesión debe reanudarse manualmente al volver.
- Los reportes en PDF dependen de la función de impresión del navegador (no se genera un archivo PDF de forma nativa).
- El respaldo previo automático antes de restaurar se guarda en `localStorage`; si el espacio de almacenamiento del navegador está lleno, esa copia de seguridad automática podría omitirse (se muestra un aviso).
- La aplicación no ofrece diagnóstico ni asesoría médica o psicológica; ante señales de emociones difíciles sostenidas, únicamente sugiere hablar con un adulto de confianza.
