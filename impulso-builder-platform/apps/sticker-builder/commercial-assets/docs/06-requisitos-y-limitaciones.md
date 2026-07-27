# Requisitos del sistema y limitaciones conocidas — THÖREN Sticker Builder

## Requisitos del sistema

- **Sistema operativo:** Windows 10/11, macOS reciente, o Linux con entorno de escritorio.
- **Navegador:** Google Chrome, Microsoft Edge o Brave (basados en Chromium) — es la única familia de navegadores verificada para esta versión.
- **Python:** necesario para el launcher.
  - **Windows:** el launcher busca `python` o `py -3` en tu sistema. Si no tienes Python instalado, el launcher te lo indica con un mensaje claro y no continúa — instálalo desde [python.org](https://www.python.org/downloads/) (marcando "Add Python to PATH") y vuelve a intentar.
  - **macOS:** Python 3 viene preinstalado en la mayoría de las versiones recientes; el launcher lo detecta automáticamente.
  - **Linux:** Python 3 suele venir preinstalado en la mayoría de las distribuciones; si no, instálalo con el gestor de paquetes de tu distribución.
- **Espacio en disco:** menos de 50 MB para la aplicación en sí. El espacio adicional depende de cuántos proyectos e imágenes guardes (todo vive en tu navegador).
- **Conexión a internet:** solo necesaria para la descarga inicial desde Gumroad. El uso diario es 100% offline.

## Limitaciones conocidas (honestas, de esta versión 1.0.0)

- **Navegadores no basados en Chromium (Firefox, Safari) no están verificados.** Es posible que THÖREN funcione en ellos, pero no ha sido probado — usa Chrome/Edge/Brave para la experiencia garantizada.
- **El launcher en Windows requiere Python instalado por separado.** No es un instalador todo-en-uno; esto es una limitación conocida de esta primera versión, no un error.
- **No hay sincronización automática entre dispositivos.** Cada computadora guarda sus proyectos de forma independiente. Usa "Exportar respaldo" / "Importar proyecto" para mover proyectos entre computadoras (ver `04-actualizar-y-respaldar.md`).
- **No hay actualización automática.** Actualizar es siempre una acción manual desde tu biblioteca de Gumroad (ver `04-actualizar-y-respaldar.md`).
- **No hay cuenta ni activación en línea.** Esto es intencional en esta versión (ver `LICENCIA-DE-USO.md`), no una limitación técnica pendiente de resolver.
- **Los colores de exportación para impresión son RGB, no perfiles de color certificados (ICC/CMYK).** Para la mayoría de los proveedores de impresión de stickers esto es suficiente, pero si tu imprenta exige un perfil CMYK certificado específico, consulta con ellos antes de enviar el archivo (ver la nota en `03-exportar-para-impresion.md`).
- **Un solo idioma de interfaz:** español. No hay selector de idioma en esta versión.

Ninguna de estas limitaciones es un secreto ni una promesa incumplida — están documentadas aquí para que sepas exactamente qué esperar antes de comprar o al recibir tu compra.
