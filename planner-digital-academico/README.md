# Planner Digital Académico 2026
### Bookfluence Teachers — Sistema digital de planificación, clases y seguimiento docente

Planner Digital Académico 2026 es una aplicación web **100% local**, en un solo archivo (`index.html`), pensada para docentes de primaria, secundaria, preparatoria, profesores independientes y educadores homeschool. No requiere internet, cuentas, instalación ni servidor.

---

## 1. Cómo abrir la aplicación

1. Copia el archivo `index.html` a tu computadora (o a una memoria USB).
2. Haz doble clic sobre él. Se abrirá en tu navegador predeterminado.
3. También puedes abrirlo manualmente desde tu navegador con **Archivo → Abrir…**

No necesitas conexión a internet, instalar nada, ni crear una cuenta.

## 2. Primer uso: configuración inicial

La primera vez que abras la aplicación verás:

1. **Aviso de privacidad** — confirma que entiendes que la información se guarda en este dispositivo.
2. **Asistente de configuración (onboarding)** — te guía paso a paso para crear tu perfil docente, tu ciclo escolar, materias, grupos, esquema de evaluación y (opcionalmente) tus estudiantes.
   - Si solo quieres explorar la aplicación, elige **"Probar con datos de ejemplo"** en la primera pantalla.
3. Al terminar, llegarás al **panel principal (Inicio)**.

Puedes volver a ajustar cualquier cosa después desde **Configuración**.

## 3. Cómo importar estudiantes

Desde **Grupos → abre un grupo** o desde el asistente inicial, tienes tres formas de capturar estudiantes:

- **Añadir manualmente**: usa el botón "Nuevo" dentro del grupo.
- **Pegar lista**: copia una lista desde una hoja de cálculo (una línea por estudiante, con formato `Nombre, número de lista`) y pégala en el cuadro correspondiente.
- **Importar CSV**: sube un archivo `.csv` con columnas `name, listNumber, email, guardianName, guardianContact`. La aplicación te mostrará una **vista previa** (filas válidas, duplicados, filas vacías) antes de importar nada.

## 4. Cómo crear respaldos

Toda tu información vive únicamente en el almacenamiento local de tu navegador (`localStorage`). Si cambias de computadora, borras el historial del navegador, o el navegador libera espacio, **podrías perder tu información si no tienes un respaldo**.

Para respaldar:

1. Ve a **Configuración → Respaldos**.
2. Haz clic en **"Exportar respaldo"**.
3. Se descargará un archivo `planner-digital-academico-respaldo-AAAA-MM-DD.json`. Guárdalo en un lugar seguro (USB, nube personal, correo).

Se recomienda hacer esto **cada semana** o antes de cualquier cambio importante.

## 5. Cómo restaurar un respaldo

1. Ve a **Configuración → Respaldos → "Restaurar respaldo"**.
2. Selecciona tu archivo `.json`.
3. La aplicación te mostrará un resumen de lo que contiene (ciclos, grupos, estudiantes, planeaciones, calificaciones) antes de reemplazar tu información actual.
4. Confirma escribiendo lo solicitado y, si tienes un PIN configurado, ingrésalo.
5. Se crea automáticamente un respaldo de seguridad de tu información actual antes de sobrescribirla.

## 6. Cómo guardar un reporte como PDF

1. Ve a **Reportes**, o usa el botón "Imprimir" disponible en la mayoría de los módulos (grupos, planeaciones, asistencia, calificaciones, etc.).
2. Se abrirá una ventana de vista de impresión.
3. En el cuadro de diálogo de impresión de tu navegador, elige **"Guardar como PDF"** como destino/impresora.

> Si tu navegador bloquea la ventana emergente, permite las ventanas emergentes para este archivo y vuelve a intentarlo.

## 7. Protección con PIN (opcional)

Puedes proteger con un PIN de 4 a 8 dígitos el acceso a estudiantes, contactos, calificaciones, exportación, importación, borrado de información y cambio de PIN.

- Actívalo desde **Configuración → Privacidad y PIN**.
- El PIN se guarda como un hash local (Web Crypto API, SHA-256 con sal aleatoria); **nunca se guarda en texto plano** y nunca sale de tu dispositivo.
- El PIN es una barrera local, **no una garantía absoluta de seguridad**. Si lo olvidas, no hay forma de recuperarlo: solo podrás restaurar tu información desde un respaldo `.json` exportado previamente.

## 8. Navegadores compatibles

Probado en navegadores modernos basados en Chromium (Google Chrome, Microsoft Edge, Brave) y debería funcionar en Firefox y Safari actualizados. Requiere soporte de `localStorage` y Web Crypto API (disponibles en todos los navegadores modernos).

No es compatible con Internet Explorer.

## 9. Privacidad

- Toda la información se guarda **únicamente en este dispositivo** (localStorage del navegador).
- La aplicación **no envía datos a internet**, no usa analítica, no tiene rastreadores ni anuncios.
- No solicita cámara, micrófono ni ubicación.
- No está diseñada para almacenar expedientes clínicos ni información médica sensible.
- **No sustituye un expediente institucional oficial.** Úsala como herramienta de apoyo a tu planeación docente.
- Evita registrar datos personales o sensibles que no sean estrictamente necesarios.

## 10. Limitaciones del MVP

- No envía tareas, notificaciones ni mensajes a estudiantes o familias: solo documenta lo que tú registras.
- No genera notificaciones del sistema operativo (recordatorios visuales dentro de la app únicamente).
- No sincroniza entre dispositivos: si usas la app en dos computadoras, deberás exportar/importar respaldos manualmente para mantenerlas iguales.
- Si borras los datos del navegador (o usas modo incógnito) sin haber exportado un respaldo, la información se pierde.
- Las "horas de desarrollo profesional" son un registro personal, no una certificación oficial.
- El horario de Word representa bloques recurrentes semanales; las excepciones puntuales se gestionan con "Suspender fecha" por bloque.

## 11. Estructura del proyecto

```
planner-digital-academico/
├── index.html          ← la aplicación completa (HTML + CSS + JS, un solo archivo)
├── README.md            ← este archivo
├── CHANGELOG.md
├── QA-REPORT.md
└── screenshots/          ← capturas de referencia
```

---

**Bookfluence Teachers** · Planner Digital Académico 2026
