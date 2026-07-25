# Problemas frecuentes y soporte — Impulso Sticker Builder Professional

## Problemas frecuentes

**No me abre el navegador / la ventana de terminal se cierra sola.**
En Windows, esto casi siempre significa que no tienes Python instalado (el launcher lo necesita — ver `06-requisitos-y-limitaciones.md`). El launcher te muestra un mensaje explicándolo antes de cerrarse. Instala Python desde [python.org](https://www.python.org/downloads/) (marca la casilla "Add Python to PATH" durante la instalación) y vuelve a intentar.

**Doble clic en `index.html` no funciona / me sale una pantalla en blanco o errores en la consola.**
Es esperado — no abras `index.html` directamente. Usa siempre el launcher (`ABRIR-IMPULSO-WINDOWS.bat` o `ABRIR-IMPULSO-MAC-LINUX.command`). Ver la explicación técnica en `01-como-empezar.md`.

**En macOS me dice que no puede abrir el launcher porque "es de un desarrollador no identificado".**
Haz clic derecho (o Ctrl+clic) sobre `ABRIR-IMPULSO-MAC-LINUX.command` y elige "Abrir" en el menú — luego confirma en el diálogo que aparece. Esto solo hace falta la primera vez.

**Cerré la ventana de terminal sin querer, ¿perdí mi trabajo?**
No, si el guardado automático ya había corrido (verás "Guardado" en la barra superior antes de cerrar). Tus proyectos viven guardados en tu navegador, no en la terminal. Simplemente vuelve a abrir el launcher.

**Abrí Impulso pero no veo mis proyectos anteriores.**
Lo más probable es que estés usando un navegador distinto al que usaste la primera vez, o que hayas borrado los datos de navegación de tu navegador (esto borra IndexedDB, donde vive todo). Si tienes un respaldo exportado (ver `04-actualizar-y-respaldar.md`), impórtalo para recuperar el proyecto.

**¿Puedo usar Impulso en dos computadoras a la vez?**
Sí — no hay límite de dispositivos ni activación en esta versión. Cada computadora guarda sus propios proyectos de forma independiente (no se sincronizan automáticamente entre sí). Usa "Exportar respaldo" / "Importar proyecto" para mover un proyecto de una computadora a otra.

**Mi diseño no exporta / el wizard de impresión me bloquea con un error.**
Ver la sección "Mensajes de Preflight" en `03-exportar-para-impresion.md` — la mayoría de los bloqueos tienen un mensaje que explica exactamente qué falta (típicamente, una línea de corte no definida).

**¿Impulso necesita internet para funcionar?**
No, una vez descargado funciona completamente sin conexión. Solo necesitas internet para descargarlo la primera vez desde Gumroad.

## Soporte

Si tu problema no está en esta lista, escríbenos a **soporte@bookfluence.shop**.

Para ayudarte más rápido, incluye en tu mensaje:
- Qué sistema operativo usas (Windows/macOS/Linux) y qué navegador (Chrome, Edge, etc.).
- Qué esperabas que pasara y qué pasó en realidad.
- Si es posible, una captura de pantalla del error (incluyendo la consola del navegador si sabes abrirla con F12).

**No es necesario** que nos envíes el contenido de tus diseños salvo que te lo pidamos explícitamente para diagnosticar un problema puntual.

**Tiempo de respuesta objetivo:** 2-3 días hábiles (objetivo de servicio, no garantía legal — ver `LICENCIA-DE-USO.md`).
