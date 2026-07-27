# UX de la Template Library (Diseño, no implementación)

**Alcance: exclusivamente diseño de experiencia.** Ningún flujo aquí descrito fue construido; ningún archivo de `apps/sticker-builder` fue modificado. Este documento asume el modelo de datos y la arquitectura de `TEMPLATE_LIBRARY_ARCHITECTURE.md` y el catálogo de contenido de `TEMPLATE_CATALOG_v1.md` — no los repite, los usa como base para especificar cómo se siente usarlos.

---

## 1. Flujos de usuario

### 1.1 Usuario nuevo, primera vez que crea un proyecto

1. Clic en "Nuevo proyecto" desde Mis Proyectos (sin cambios respecto a hoy).
2. Se abre la Template Gallery. **Estado inicial**: sin ningún filtro activo, tab "Todos" seleccionada, orden por defecto = destacados/curados (no alfabético ni por fecha — un usuario nuevo no tiene "recientes" ni "más usados" todavía, así que esas tabs existen pero muestran su propio estado vacío, ver §5).
3. El usuario explora visualmente (scanea el grid) o escribe en la búsqueda. Sin conocimiento previo del catálogo, el descubrimiento visual (grid + categorías) es el camino principal — la búsqueda por texto sirve mejor al usuario que ya sabe lo que busca (§1.3).
4. Clic en una card → Template Detail (nunca crea el proyecto directamente desde el grid, ver arquitectura §5 punto 7) → el usuario confirma que es lo que quiere viendo la descripción/caso de uso/tamaño real → "Usar este template".
5. Se instancia (`instantiateTemplate`, ya existente) y se abre el editor. **Nunca más de 3 clics** desde "Nuevo proyecto" hasta estar editando (Gallery → Card → Detail → Usar).
6. La opción "Personalizado" (ya existente hoy) permanece siempre visible y accesible en un clic desde la Gallery, para el usuario que no quiere partir de ningún template — este camino no se alarga ni se esconde solo porque el catálogo creció.

### 1.2 Usuario que regresa, ya usó templates antes

- La tab "Recientes" ya tiene contenido (últimos templates usados, ver arquitectura §4.3) — es la tab que debería recibir el foco visual por defecto para un usuario recurrente, **no** "Todos" (que es mejor para descubrimiento, no para retomar un flujo conocido). Esto es una decisión de producto a validar con datos reales de uso, no una certeza — se documenta como hipótesis de diseño, no como requisito rígido.
- Si el usuario ya marcó favoritos, esa tab compite con "Recientes" por atención por defecto — la resolución recomendada: mostrar "Recientes" primero (más probable que sea justo lo que se busca repetir), con "Favoritos" a un clic de distancia, no dos.

### 1.3 Usuario que sabe exactamente qué busca (power user)

- Atajo de teclado para enfocar la búsqueda al abrir la Gallery (`/` o `Cmd/Ctrl+F` interno al panel, no el buscador del navegador — mismo patrón ya usado en apps como Linear/Notion, consistente con la inspiración de diseño ya establecida para THÖREN en fases anteriores).
- Escribir texto filtra en tiempo real (debounce corto, ~150ms, ya es el patrón usado en el Inspector de la app para campos numéricos — se reutiliza el mismo ritmo de respuesta, no se inventa uno nuevo).
- Los filtros de faceta (categoría/forma/dificultad/premium) son atajo para el usuario que ya sabe "quiero algo redondo de Food & Beverage" sin necesidad de escribir texto — deben poder combinarse con la búsqueda de texto, no ser mutuamente excluyentes.
- Para el usuario más avanzado: navegar el grid completo por teclado (flechas) sin mouse, abrir Detail con Enter, volver con Escape — ver §2.

### 1.4 Guardar un template propio ("Guardar como plantilla")

Flujo actual (nombre + descripción → guardar) se extiende, no se reemplaza:

1. Mismo punto de entrada de hoy.
2. Campos actuales (nombre, descripción) permanecen obligatorio/opcional como hoy.
3. **Nuevos campos, todos opcionales, con valores sugeridos automáticamente cuando sea posible** (ver arquitectura §9 punto 2 — sugerencia de metadata, no obligación): categoría (dropdown de las 19 de `TEMPLATE_CATALOG_v1.md`, con opción "Sin categoría" seleccionada por defecto — nunca forzar una elección), forma (auto-detectada del die-line del proyecto cuando sea posible, editable), tags (campo de texto libre, chips).
4. Guardar sin llenar ningún campo nuevo debe seguir funcionando exactamente igual que hoy — la extensión nunca convierte un flujo de 2 campos en uno de 6 obligatorios.

### 1.5 Ciclo completo de vida de un template guardado por el usuario

- Ver todos sus templates propios: filtro implícito (no una faceta más) — una tab o sección separada "Mis plantillas" dentro de la Gallery, ya que son cualitativamente distintos de los de catálogo (el usuario puede borrarlos, no puede comprarlos, no tienen categoría curada por THÖREN necesariamente).
- Borrar un template propio: ya existe hoy (botón de borrar en la card si `!builtIn`), se mantiene igual, con confirmación (mismo patrón de confirmación ya usado en otras acciones destructivas de la app, ej. eliminar proyecto).
- Editar/renombrar un template ya guardado: **no existe hoy y no se resuelve en este documento** — ADR-0013 ya lo marca como deferred; se mantiene fuera de alcance también aquí, consistente (ver roadmap).

---

## 2. Accesibilidad y teclado

### 2.1 Principio

La Template Gallery es, funcionalmente, una lista de selección con vista previa — el mismo patrón de interacción que un selector de archivos o una galería de imágenes. Debe navegarse completamente sin mouse, con el mismo nivel de soporte que ya tiene el resto de THÖREN (la Fase 7.3.5 ya hizo una auditoría de accesibilidad completa sobre la app — este diseño se alinea a ese estándar ya alcanzado, no a uno nuevo).

### 2.2 Especificación de teclado

| Tecla | Acción |
|---|---|
| `Tab` / `Shift+Tab` | Mover el foco entre: buscador → filtros → tabs → primera card → siguiente card... → "Personalizado" |
| Flechas (↑↓←→) | Dentro del grid de cards (una vez el foco entra al grid), moverse entre cards en su disposición visual real (no solo orden secuencial de tabulación) — mismo patrón que un grid de archivos de sistema operativo |
| `Enter` / `Space` sobre una card | Abre Template Detail (equivalente a clic en la card) |
| `Enter` sobre el botón "Usar" (dentro de Detail o revelado por foco en la card) | Instancia el template y abre el editor |
| `Escape` | Cierra Template Detail y devuelve el foco exactamente a la card desde la que se abrió (nunca al inicio del grid — perder la posición al cerrar un detalle es una regresión de UX conocida en este tipo de galerías) |
| `/` | Enfoca la búsqueda desde cualquier punto de la Gallery |
| Flechas dentro de un `<select>`/lista de filtros | Comportamiento nativo del control, sin interceptar |

### 2.3 Lectores de pantalla

- Cada card anuncia: nombre, categoría, dificultad, y si es premium — en ese orden, como un solo texto accesible (`aria-label` compuesto), no como fragmentos sueltos que el lector deba ensamblar.
- El conteo de resultados tras aplicar un filtro se anuncia vía región `aria-live="polite"` (ej. "24 templates encontrados") — mismo patrón ya usado en el feedback de Preflight de Fase 9 (que también anuncia resultados dinámicos de validación).
- Los badges (§ arquitectura 5.3) nunca transmiten información solo por color — siempre acompañados de texto (ya es la política general de la app desde la auditoría de accesibilidad de Fase 7.3.5, se hereda sin excepción aquí).

### 2.4 Contraste y estados visuales

- Texto de categoría/dificultad sobre el fondo de card cumple WCAG AA (4.5:1 mínimo) usando los tokens de color ya establecidos de THÖREN (Fjord sobre Stone/Paper ya está validado en el sistema de diseño existente).
- El foco de teclado es visualmente idéntico en peso al hover de mouse (mismo halo/elevación) — nunca un estilo de foco más débil que el de hover, error común que penalizaría a quien navega por teclado.

---

## 3. Velocidad y escalabilidad de UX

### 3.1 Umbral de virtualización

Con el catálogo inicial de 63 templates (`TEMPLATE_CATALOG_v1.md`) **no hace falta virtualización** — se renderiza el grid completo sin problema perceptible. El umbral recomendado para activar virtualización de scroll (renderizar solo las cards visibles + un margen, reciclando nodos DOM al hacer scroll) es de **~150-200 templates simultáneos visibles** (es decir, después de aplicar los filtros activos — si el catálogo total crece a 2,000 pero un filtro lo reduce a 40 resultados, no hace falta virtualizar esos 40). Esto es coherente con que la Catalog Query Layer (arquitectura §1.2) ya opera en memoria — el costo real está solo en el DOM, no en la consulta.

### 3.2 Carga de thumbnails

- Los thumbnails (`Blob`) se cargan solo para las cards dentro del viewport + un margen de precarga (una o dos filas antes de que sean visibles) — nunca las 63 (ni las 2,000 futuras) de una sola vez.
- Estado transitorio mientras carga un thumbnail: un placeholder de color sólido derivado de `suggestedColors[0]` del propio template (arquitectura §1.3) — da una pista visual de la paleta del template incluso antes de que la imagen real aparezca, en vez de un gris genérico sin información.

### 3.3 Percepción de velocidad en búsqueda/filtro

- Ninguna interacción de búsqueda/filtro muestra un spinner de carga — al operar 100% en memoria (arquitectura §1.2/§4.1), la respuesta debe sentirse instantánea. Si en el futuro un catálogo remoto (marketplace) introduce latencia real de red, esa latencia se absorbe con un estado de "cargando más resultados" al hacer scroll (paginación progresiva), nunca bloqueando la interacción de escritura en el buscador.

---

## 4. Consistencia con el resto de la aplicación

- Tipografía, color, espaciado: mismos tokens de diseño ya usados en Mis Proyectos/Workspace — la Gallery no introduce un lenguaje visual nuevo.
- El patrón de card (preview + nombre + acciones en hover) ya existe hoy en la grilla de "Mis proyectos" — la Template Card (arquitectura §5) es una evolución de ese mismo patrón, no una invención paralela; esto reduce carga cognitiva (el usuario ya sabe cómo se comporta una card en esta app).
- Los diálogos/paneles (Template Detail) siguen el mismo lenguaje de modal/panel ya usado en `newProjectDialog.ts`/`saveAsTemplateDialog.ts` — mismo comportamiento de foco atrapado y cierre con `Escape` que ya se implementó y se auditó rigurosamente para el wizard de exportación de producción (Fase 9.4/9.5).
- Mensajes en español, tono directo y honesto — mismo principio de voz ya aplicado en toda la documentación y UI comercial de fases anteriores (nunca prometer más de lo que el template realmente resuelve).

---

## 5. Estados vacíos y de error

| Situación | Qué mostrar |
|---|---|
| Catálogo cargando por primera vez | Skeleton de cards (bloques grises con la forma exacta de una card) — nunca una pantalla en blanco ni un spinner de página completa. |
| Búsqueda/filtro sin resultados | Mensaje claro ("No encontramos templates para esos filtros") + botón directo para limpiar filtros — nunca un grid vacío sin explicación. |
| Tab "Recientes" sin historial (usuario nuevo) | Mensaje breve invitando a explorar "Todos" — nunca una tab que parezca rota. |
| Tab "Favoritos" vacía | Mensaje breve explicando cómo marcar un favorito (ícono de estrella en la card) — enseña la función en el momento en que el usuario topa con el vacío, no antes. |
| Template premium sin acceso | Se ve, se puede abrir en Detail, pero "Usar" lleva a la pantalla de adquisición del pack correspondiente (arquitectura §8.1) — nunca un candado sin explicación de cómo desbloquearlo. |
| Fallo al cargar un thumbnail individual | Placeholder de color (§3.2) permanece, sin ícono de "imagen rota" — un thumbnail faltante no debe verse como un error del sistema. |
| Fallo real de `TemplateStore` (IndexedDB no disponible, cuota, etc.) | Mismo patrón de manejo de errores ya construido para el resto de la persistencia de la app (Epic 8 — "Manejo de errores de IndexedDB/cuota") — se reutiliza esa lógica, no se diseña una nueva. |

---

## 6. Resumen de principios (para no perderlos en el detalle)

1. Nunca más de 3 clics de "Nuevo proyecto" a "editando".
2. Cero llamadas a red/IndexedDB en cada tecla de búsqueda.
3. Todo lo que funciona hoy (grid simple, "Personalizado", guardar con 2 campos) sigue funcionando exactamente igual — esto es una ampliación, no una migración forzada.
4. Accesible por teclado al mismo nivel que el resto de la app, sin excepciones.
5. Ningún estado vacío se siente como un error; ningún error se siente como un callejón sin salida.
