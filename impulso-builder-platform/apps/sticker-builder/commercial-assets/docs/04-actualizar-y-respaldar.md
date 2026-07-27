# Cómo actualizar y respaldar tus proyectos — THÖREN Sticker Builder

## Cómo actualizar THÖREN

THÖREN Sticker Builder **no se actualiza solo** — no hay un "auto-actualizador" en esta versión. Actualizar es siempre una acción manual tuya:

1. Vuelve a la página de "Biblioteca" de tu compra en Gumroad (el mismo lugar donde descargaste THÖREN la primera vez).
2. Si hay una versión más nueva disponible, verás un nuevo archivo para descargar. Consulta `docs/NOTAS-DE-VERSION.md` de la nueva versión para saber qué cambió antes de actualizar.
3. Descomprime la nueva versión en una carpeta **distinta** a la anterior (no sobrescribas la carpeta vieja todavía).
4. Abre el launcher de la nueva versión como de costumbre.

**¿Y mis proyectos guardados?** Tus proyectos viven en el navegador (IndexedDB), asociados al puerto en el que corre THÖREN — no a la carpeta donde descomprimiste el ZIP. Mientras el launcher de la nueva versión siga usando el mismo puerto (`4173`, el mismo de siempre), tus proyectos guardados **seguirán ahí automáticamente** al abrir la nueva versión, sin que tengas que hacer nada. Esto es intencional: así evitamos que actualizar te haga "perder" tu trabajo.

Solo si por algún motivo quieres estar seguro antes de actualizar (o si vas a cambiar de computadora), usa el respaldo manual descrito abajo — es la forma más segura de no depender de esta coincidencia de puerto.

## Cómo respaldar un proyecto (exportar/importar)

Cada proyecto en "Mis proyectos" tiene un botón **"Exportar respaldo"** en su tarjeta. Esto genera un archivo `.json` que contiene tu proyecto completo, incluyendo todas las imágenes que hayas subido — es un archivo independiente que puedes guardar donde quieras (una carpeta local, un pendrive, tu nube personal).

### Para respaldar un proyecto

1. En "Mis proyectos", busca la tarjeta del proyecto que quieres respaldar.
2. Haz clic en **"Exportar respaldo"**.
3. Se descarga un archivo `.json` con el nombre de tu proyecto — guárdalo donde prefieras.

### Para restaurar un proyecto desde un respaldo

1. En "Mis proyectos", haz clic en **"Importar proyecto"** (junto a "Nuevo proyecto").
2. Elige el archivo `.json` que habías exportado antes.
3. THÖREN valida el archivo y, si es correcto, crea un nuevo proyecto en tu biblioteca con todo su contenido (diseño + imágenes).

**¿Cuándo usar esto?**
- Antes de actualizar THÖREN, si quieres una copia de seguridad extra.
- Si vas a cambiar de computadora o reinstalar tu navegador.
- Si quieres enviarle un proyecto a otra persona que también use THÖREN.
- Como copia de seguridad periódica de tus proyectos más importantes — recomendamos exportar un respaldo de cualquier proyecto en el que hayas invertido mucho tiempo.

**Nota honesta:** un respaldo importado es un proyecto **nuevo** en tu biblioteca (no reemplaza uno existente automáticamente) — así nunca corres el riesgo de sobrescribir accidentalmente un proyecto que ya tenías abierto. Si el archivo de respaldo está dañado o corrupto, THÖREN te lo dice claramente en vez de crear un proyecto roto.
