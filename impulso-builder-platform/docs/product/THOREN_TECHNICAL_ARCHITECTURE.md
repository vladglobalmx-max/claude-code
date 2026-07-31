# THÖREN — Arquitectura Técnica

**Fecha:** 2026-07-30
**Naturaleza de este documento:** arquitectura, no implementación. Sin código, sin diagramas de clases, sin elección de librerías. Diseña cómo se divide el sistema para que el producto descrito en `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md` y `THOREN_CREATIVE_ENGINE.md` pueda construirse sin reinterpretaciones — y sin comprometerse a más estructura de la que el sistema realmente necesita.
**Precondición:** los cuatro documentos de producto quedan congelados y no se reabren aquí. Este documento no diseña experiencia — diseña cómo hacerla real.

**El criterio que gobierna cada decisión de este documento:**

> "¿Esta arquitectura ayuda a que THÖREN siga sintiéndose como un diseñador profesional invisible?"

Si una decisión técnica no puede responder que sí a esa pregunta, no pertenece aquí, sin importar cuán elegante parezca en abstracto.

---

## 1. Arquitectura general

THÖREN se divide en **seis módulos**, ni uno más. Tres ya existen y están probados; tres son nuevos:

**Ya existentes, reutilizados sin cambios de fondo:**
- **Dominio de Documento** — el modelo canónico de proyecto/documento/página/objeto, y los comandos que lo mutan. Es la base sobre la que todo lo demás se apoya.
- **Motor de Impresión** — geometría de layout, tipografía, imposición, sangrado, marcas de corte, Preflight, renderizado a PDF/PNG. El activo más sólido del sistema actual, según la propia auditoría de producto.
- **Motor de Exportación** — adaptadores que convierten un documento ya compuesto en un archivo real (SVG, PNG, PDF).

**Nuevos, construidos para esta etapa:**
- **Motor Creativo** — el "cerebro": interpreta la frase, decide qué direcciones de estilo son relevantes, compone propuestas reales usando el Motor de Impresión como maquinaria interna, genera variantes, y filtra calidad. Es un único módulo cohesivo con cinco responsabilidades internas bien separadas (sección 2) — no cinco módulos publicables por separado. Cinco paquetes independientes para algo de este tamaño sería complejidad que el sistema no necesita todavía.
- **Flujo de Experiencia** — el "sistema nervioso": la máquina de estados que implementa, paso a paso, el recorrido exacto descrito en el Blueprint (conversación → pensando → propuestas → revelación → obtener → confirmación → pregunta de impresión). No sabe nada de tipografía ni de recetas — solo sabe en qué momento del recorrido está el usuario y a quién pedirle qué.
- **Interfaz** — la "cara": lo que la persona realmente ve y toca. Hoy es la Beta ya construida; podría rehacerse por completo en el futuro sin que ningún otro módulo se entere.

Un séptimo módulo, la **Biblioteca de Assets** (ya existente), permanece disponible pero opcional — solo se activa si una composición referencia una imagen o logo provisto por el usuario.

**Independencia:** Dominio de Documento, Motor de Impresión y Motor de Exportación no saben que el Motor Creativo existe — pueden evolucionar (nuevos perfiles de impresión, nuevos formatos de exportación) sin tocar nada de lo nuevo. El Motor Creativo puede evolucionar (nuevas recetas, nueva lógica de interpretación) sin tocar el Motor de Impresión ni la Interfaz, siempre que su contrato público no cambie de forma. La Interfaz puede rediseñarse por completo sin que el Flujo de Experiencia ni el Motor Creativo cambien una sola línea.

## 2. Responsabilidades

| Módulo | Única responsabilidad | Lo que nunca decide |
|---|---|---|
| Dominio de Documento | Representar un proyecto/documento y las operaciones válidas sobre él. | No sabe qué es una receta, una ocasión, ni un estilo. |
| Motor de Impresión | Calcular geometría de layout, tipografía, imposición y validar producción (Preflight). | No decide qué contenido componer ni con qué intención creativa. |
| Motor de Exportación | Convertir un documento ya compuesto en un archivo final. | No decide si el documento está terminado o es "suficientemente bueno". |
| Motor Creativo | Convertir una frase + contenido real en propuestas terminadas y validadas. | No decide cómo se ve la interfaz, ni cuándo mostrar qué pantalla. |
| Flujo de Experiencia | Orquestar en qué momento del recorrido está el usuario y qué módulo llamar a continuación. | No compone nada, no interpreta texto, no decide calidad — solo coordina. |
| Interfaz | Renderizar el estado actual del Flujo de Experiencia y capturar la entrada del usuario. | No contiene ninguna regla de negocio ni de calidad. |

**Las cinco responsabilidades internas del Motor Creativo** (documentadas en detalle en `THOREN_CREATIVE_ENGINE.md`, aquí solo como estructura interna):

- *Intérprete de intención* — texto libre → `Intent`.
- *Sistema de recetas* — datos curados de estilo + tabla de afinidad ocasión→receta.
- *Composición* — `Intent` + `Recipe` → `Composition`, llamando internamente al Motor de Impresión.
- *Generación de variantes* — una `Composition` elegida → hermanas dentro de la misma `Recipe`.
- *Filtro de calidad* — valida cada `Composition` antes de que salga del Motor Creativo.

Cada una es una responsabilidad de una sola cosa, verificable de forma aislada (sección 8), pero viven dentro de un mismo módulo porque comparten el mismo ciclo de vida y los mismos tipos de datos — separarlas en paquetes distintos añadiría fronteras que nadie más necesita cruzar.

## 3. Flujo de datos

De la frase al SVG descargado, paso a paso:

1. La persona escribe su frase en la **Interfaz**.
2. La Interfaz entrega el texto crudo al **Flujo de Experiencia** — nunca lo interpreta ella misma.
3. El Flujo de Experiencia pide al **Motor Creativo** "interpreta esto y genera un lote".
4. Dentro del Motor Creativo: el Intérprete de intención produce un `Intent`; el Sistema de recetas elige 4-5 `Recipe` relevantes según la tabla de afinidad; por cada receta, el paso de Composición elige un arquetipo y llama al **Motor de Impresión** (geometría, tipografía) para producir una `Composition` candidata, expresada internamente como un documento del **Dominio de Documento**; el Filtro de calidad valida cada candidata — si falla, se reintenta dentro de la misma receta o se sustituye por la siguiente receta relevante.
5. El Motor Creativo devuelve al Flujo de Experiencia un lote de `Composition` ya validadas, con metadatos mínimos de presentación (orden, si tiene variantes disponibles) — nunca el nombre de la receta ni puntuaciones internas.
6. El Flujo de Experiencia actualiza su estado; la **Interfaz**, suscrita a ese estado, muestra las propuestas con el ritmo pausado ya definido en el Sistema de Interacción.
7. La persona elige una (opcionalmente pide "más como esta" primero, lo que repite el paso 4 acotado a esa sola dirección).
8. El Flujo de Experiencia envuelve la `Composition` elegida como un `Project` (concepto ya existente del Dominio de Documento) y transiciona a la revelación.
9. Al tocar "Obtener", el Flujo de Experiencia pide al **Motor de Exportación** el archivo por defecto (SVG) y dispara la descarga.
10. Si la persona confirma que necesita varias copias para imprenta, el Flujo de Experiencia entrega ese mismo `Project` al **Motor de Impresión** para imposición/Preflight/PDF de producción — la misma tubería que ya existe y funciona hoy, invocada al final, no antes.

Ningún paso de este flujo requiere que un módulo "de abajo" (Dominio de Documento, Motor de Impresión, Motor de Exportación) sepa que el Motor Creativo existe — todos reciben, en el fondo, exactamente el mismo tipo de documento que ya sabían procesar antes de esta etapa.

## 4. Dependencias

Regla general: **las dependencias solo apuntan hacia abajo, nunca hacia los lados entre módulos nuevos, nunca hacia arriba desde los módulos probados.**

- Interfaz → depende únicamente de Flujo de Experiencia. Nunca importa Motor Creativo, Motor de Impresión, Motor de Exportación ni Dominio de Documento directamente — si necesita algo de ellos, lo pide a través del Flujo de Experiencia.
- Flujo de Experiencia → depende de Motor Creativo y de Motor de Exportación/Motor de Impresión. Nunca depende de la Interfaz (podría alimentar a más de una interfaz distinta sin cambiar).
- Motor Creativo → depende de Dominio de Documento y de Motor de Impresión (los reutiliza como maquinaria interna). Nunca depende de Flujo de Experiencia ni de Interfaz.
- Motor de Impresión y Motor de Exportación → dependen solo de Dominio de Documento. Nunca dependen de Motor Creativo, Flujo de Experiencia ni Interfaz — son la capa más antigua y probada, y no deben enterarse de que la capa nueva existe.
- Dominio de Documento → no depende de ningún otro módulo del sistema.

**Qué nunca debe pasar:** que Motor de Impresión importe algo del Motor Creativo (invertiría la capa probada para servir a la nueva, arriesgando lo que ya funciona); que la Interfaz contenga una sola línea que sepa el nombre de una receta o el motivo de un rechazo de calidad (rompería, a nivel de código, el principio de que esa información nunca debe exponerse); que dos módulos nuevos (Motor Creativo, Flujo de Experiencia) terminen llamándose mutuamente en ambas direcciones — la relación siempre es de uno hacia el otro, nunca circular.

**Cómo se evita el acoplamiento:** con una verificación automatizada de límites de dependencia como parte de la integración continua (qué módulo puede importar a cuál), no solo como una convención documentada — de modo que una violación de estas reglas falle la build, no dependa de que alguien la note en revisión de código.

Una distinción sutil que vale la pena dejar explícita: los **tokens visuales de la Interfaz** (su propio claro/oscuro, su propia tipografía de chrome) y la **Paleta/Tipografía de una Receta** son conceptos completamente distintos, aunque ambos hablen de "colores y letras". Una Receta describe el contenido que se imprime; la Interfaz describe la aplicación que lo muestra. Nunca deben compartir la misma fuente de valores.

## 5. Modelo de dominio

Entidades principales, sin hablar todavía de cómo se almacenan:

- **Intent** — la estructura resultante de interpretar la frase del usuario: ocasión, contenido personal (nombres, marca, fecha, producto, cantidad), señales explícitas de tono/color, restricciones.
- **Recipe** — un sistema de estilo curado: intención visual, paletas permitidas, parejas tipográficas permitidas, arquetipos de layout permitidos, motivos ornamentales, densidad, reglas de jerarquía y espaciado, usos recomendados/a evitar, formalidad, expresividad.
- **Palette** — un pequeño conjunto de colores con roles definidos (dominante, acento, fondo), asociado a una o más Recipes.
- **Typography** — una pareja de roles tipográficos (principal/secundario) con características definidas (peso, contraste, tracking), asociada a una Recipe.
- **Layout** (arquetipo) — una estructura compositiva con espacios para contenido y reglas de cómo ese contenido se distribuye dentro de ella; pertenece a una Recipe.
- **CreativeDirection** — una Recipe activada para un Intent específico: "esta receta, elegida como relevante para este pedido, lista para generar" — el paso intermedio entre la receta abstracta y una pieza concreta.
- **Composition** — una pieza generada y concreta: un Layout resuelto con contenido real, Typography y Palette específicas, expresado en última instancia como un documento del Dominio de Documento. Es lo que la persona ve como "una propuesta".
- **Variant** — una Composition generada como hermana de otra dentro de la misma CreativeDirection, con referencia a su origen (para la mecánica de "más como esta" y para los límites de exploración).
- **Validation** — el resultado que el Filtro de calidad produce para una Composition: clasificación (rechazada / técnicamente correcta / visualmente competente / profesional / sobresaliente), qué verificaciones pasó o falló, qué se corrigió automáticamente.
- **Project** — el artefacto persistente que envuelve la Composition elegida, reutilizando el concepto de proyecto ya existente en el Dominio de Documento.
- **Asset** — un recurso visual provisto por el usuario o el sistema (logo, imagen) que una Composition puede referenciar.
- **Export** — la solicitud/resultado de convertir un Project en un archivo real, en el formato que corresponda (SVG por defecto; PDF de producción si se confirma la impresión en volumen).

Ninguna de estas entidades necesita, en esta etapa, un modelo de persistencia propio distinto al que el Dominio de Documento ya resuelve para "Project" — Intent, Recipe, Composition y Validation viven y mueren dentro de una sesión de generación; solo el Project elegido necesita sobrevivir más allá de ese momento.

## 6. Extensibilidad

**Agregar una receta nueva:** se añade como datos (paleta, tipografía, arquetipos, motivos, reglas) siguiendo la misma forma que las siete ya definidas — no requiere tocar el Intérprete, el Selector, ni el Filtro de calidad. Antes de activarse para usuarios reales, pasa por el mismo Filtro de calidad que cualquier composición generada (sección 19 de `THOREN_CREATIVE_ENGINE.md`).

**Agregar un producto u ocasión nuevos:** se añade una fila a la tabla de afinidad ocasión→receta. Si la ocasión requiere un formato físico distinto, ese formato se define en el Motor de Impresión (que ya soporta múltiples perfiles) — el Motor Creativo no necesita saber de formatos físicos, solo de qué recetas son relevantes.

**Agregar un formato de salida nuevo:** se añade como un adaptador más en el Motor de Exportación — ni el Motor Creativo ni el Flujo de Experiencia necesitan cambiar, porque ambos ya tratan la exportación como "pide un archivo de tal tipo", no como una implementación concreta.

**Agregar un idioma nuevo:** el Intérprete de intención y las Recipes (en lo que respecta a tipografía/motivos) son independientes del idioma del contenido — el idioma vive en el contenido del usuario, nunca en la estructura de la receta. Agregar soporte a un idioma nuevo es principalmente trabajo del Intérprete de intención (reconocer sus patrones de frase), no una reestructuración del motor.

**Ninguna de estas extensiones requiere modificar el núcleo** (Dominio de Documento, Motor de Impresión, Motor de Exportación) — todas ocurren agregando datos o adaptadores nuevos alrededor de un núcleo estable.

## 7. Performance

Objetivos técnicos preliminares — nunca alcanzados con demoras artificiales, tal como exige el Sistema de Interacción:

| Etapa | Tiempo máximo aceptable |
|---|---|
| Interpretación de la frase | 150 ms |
| Composición de una pieza individual | 300 ms |
| Validación de calidad por pieza | 150 ms (en paralelo a la siguiente composición) |
| Primera propuesta visible desde que el usuario termina de escribir | 1.5 s |
| Lote completo (4-5 propuestas) | 3 s |
| Ronda de variantes (hasta 3) | 2 s |
| Exportación por defecto (SVG) | 500 ms |
| Exportación de producción (PDF con imposición, ruta diferida) | sin restricción estricta — ocurre después del momento de éxito, nunca antes |

La distinción del último renglón es deliberada: el presupuesto de velocidad estricto protege el camino que sostiene la promesa de un minuto; la extensión opcional de impresión en volumen, al vivir después de ese momento, puede tomar el tiempo real que necesite sin comprometer la experiencia central.

## 8. Testing

**Por módulo, de forma aislada:**
- *Dominio de Documento / Motor de Impresión / Motor de Exportación:* ya cuentan con su propia suite (existente, no se reabre aquí).
- *Intérprete de intención:* pruebas dirigidas por tabla contra un corpus amplio de frases de ejemplo, incluyendo cada caso límite de la sección 14 de `THOREN_CREATIVE_ENGINE.md` (frases cortas, ambiguas, contradictorias, informales).
- *Sistema de recetas:* verificación de que cada receta declarada tiene, como mínimo, los tres arquetipos exigidos y que ninguna combinación interna se sale de sus propias reglas (densidad, paleta).
- *Composición:* pruebas basadas en propiedades — para cualquier combinación válida de Intent + Recipe, la Composition resultante nunca viola las reglas declaradas de esa receta (densidad, jerarquía, capacidad de texto).
- *Filtro de calidad:* casos de referencia (composiciones conocidas como buenas y como malas) para verificar que la clasificación en los cinco niveles se mantiene estable al cambiar el motor.
- *Flujo de Experiencia:* pruebas de la máquina de estados en sí misma — que nunca permite dos transiciones simultáneas, que respeta el orden exacto del Blueprint.

**Del sistema completo:**
- Pruebas de integración de extremo a extremo, desde una frase cruda hasta un lote validado, corridas contra un corpus fijo representativo de la tabla de afinidad — verificando tamaño del lote, ausencia de arquetipos repetidos, clasificación mínima "profesional", y tiempos dentro del presupuesto de la sección 7.
- Pruebas de contrato entre Flujo de Experiencia y Motor Creativo, verificando explícitamente que la información que cruza esa frontera nunca incluye el nombre de una receta, una puntuación de calidad, ni ningún parámetro interno de composición.
- Pruebas de extremo a extremo sobre la interfaz real (heredando la disciplina ya usada en el sistema actual), verificando que las escenas ocurren en el orden y con el ritmo del Blueprint.

**Obligatorias en integración continua:** las pruebas de cada módulo aislado, la prueba de contrato de "no fuga de información interna", y una prueba de presupuesto de tiempo que falle la build si cualquier etapa supera su máximo aceptable. Las pruebas de calidad estética de recetas nuevas requieren, además, revisión humana antes de integrarse — no todo lo que hace "bueno" a un diseño es verificable solo por código.

## 9. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Las primitivas del Motor de Impresión, pensadas originalmente para plantillas fijas, resultan insuficientes para la variación generativa. | Se envuelven con una capa de adaptación dentro del Motor Creativo, sin modificar el Motor de Impresión en sí — preserva la estabilidad de lo ya probado. |
| Las verificaciones estéticas del Filtro de calidad son difíciles de codificar con confianza total. | Empezar con un conjunto pequeño y muy revisado de combinaciones receta+arquetipo donde la calidad está garantizada por construcción, ampliando el conjunto de reglas de forma incremental. |
| El Intérprete de intención clasifica mal frases con formas inesperadas. | Mantener un corpus de regresión creciente (alimentado por las señales futuras de `THOREN_CREATIVE_ENGINE.md` §17) y mantener su lógica aislada para poder iterarla sin tocar el resto del motor. |
| Los objetivos de rendimiento de la sección 7 resultan optimistas frente a la complejidad real de las recetas. | Medir desde la Fase 1 del roadmap, con el presupuesto de tiempo como parte de la integración continua, nunca como una revisión posterior. |
| Presión por "solo esta vez" saltarse un límite de módulo (la Interfaz llamando directo al Motor Creativo, por ejemplo). | Verificación automatizada de límites de dependencia (sección 4) que falle la build, no solo una convención documentada. |
| Cuello de botella en la autoría de recetas/arquetipos al intentar escalar a muchas ocasiones. | El roadmap (sección 10) crece deliberadamente despacio en número de recetas; autoría de contenido creativo se trata como un flujo de trabajo continuo, no una tarea de una sola vez. |

## 10. Roadmap técnico

Cada fase termina en algo que una persona real puede usar de principio a fin — nunca meses de construcción sin poder probar nada.

**Fase 1 — Una ocasión, una receta, tubería real.** Intérprete de intención mínimo (basado en reglas), una receta completamente desarrollada con tres arquetipos, Composición conectada de verdad al Motor de Impresión, Filtro de calidad mínimo (solo verificaciones estructurales: desbordamiento, contraste, colisiones). Se conecta al Flujo de Experiencia ya existente, reemplazando las tres propuestas estáticas de la Beta actual por tres composiciones genuinamente generadas para una sola ocasión (por ejemplo, bodas). **Resultado utilizable:** alguien describe una boda real y recibe propuestas reales, con el mismo ritmo y tiempos de siempre — desde afuera, nada cambió salvo que ahora es real.

**Fase 2 — Varias recetas y el Selector.** Se agregan 3-4 recetas más y se activa la tabla de afinidad. **Resultado utilizable:** el lote inicial varía genuinamente según la ocasión descrita, no siempre la misma receta.

**Fase 3 — Variantes y límites de exploración.** Se activa el Generador de variantes con sus topes duros (una ronda, tres variantes, nunca generación especulativa). **Resultado utilizable:** "más como esta" funciona de verdad, y de forma acotada.

**Fase 4 — Filtro de calidad completo.** Se implementan todas las verificaciones y la escala de cinco niveles completa; solo "profesional" o "sobresaliente" llegan a la interfaz. **Resultado utilizable:** consistencia visible de calidad en todas las recetas, no solo en la primera bien pulida.

**Fase 5 — Más ocasiones/productos y la extensión de impresión real.** Se amplía la tabla de afinidad a las catorce categorías de `THOREN_CREATIVE_ENGINE.md` §6, y la pregunta diferida de "¿necesitas varias copias?" deja de ser una confirmación simulada y pasa a invocar de verdad el Motor de Impresión (imposición, Preflight, PDF de producción). **Resultado utilizable:** la promesa completa del producto, de punta a punta, con archivo de producción real.

Una propiedad importante de este roadmap: **el contrato público entre Flujo de Experiencia y Motor Creativo no cambia de fase a fase** — solo lo que hay detrás de ese contrato se vuelve progresivamente más real. Eso es, en sí mismo, evidencia de que los límites de módulo están bien puestos.

## 11. Principios de arquitectura

- Módulos pequeños, en número — seis, no veinte.
- Alta cohesión dentro de cada módulo, bajo acoplamiento entre ellos.
- Composición sobre herencia, en el sentido literal del propio Motor Creativo: una Composition se arma combinando piezas (Layout + Typography + Palette), nunca extendiendo una jerarquía de clases de "tipos de diseño".
- Reglas antes que IA — cada pieza de este sistema es determinista y auditable antes de considerar cualquier componente probabilístico.
- Determinismo antes que creatividad infinita — la variedad vive en un catálogo curado y acotado de recetas y arquetipos, nunca en generación sin límites.
- Calidad antes que cantidad — ningún módulo tiene permitido sacrificar el Filtro de calidad a cambio de más velocidad o más variedad.
- El dominio manda sobre la tecnología — las entidades de la sección 5 se definen por lo que significan para el producto, no por cómo terminen implementándose o almacenándose.
- Los límites de módulo son los límites de responsabilidad de producto — que la Interfaz no pueda importar el Motor Creativo no es una regla técnica arbitraria, es la misma regla de "la jerga nunca llega a la persona" convertida en código.

## 12. Criterio final

> "¿Esta arquitectura ayuda a que THÖREN siga sintiéndose como un diseñador profesional invisible?"

Cada uno de los seis módulos existe porque una persona real, en algún punto del recorrido, necesita que algo específico ocurra en silencio y bien hecho: que su frase se entienda, que se le proponga algo ya resuelto, que la calidad nunca sea negociable, que el archivo final llegue. Ninguno existe por elegancia técnica en abstracto.

---

## Nota sobre la simplificación

Antes de entregar este documento se revisó buscando complejidad innecesaria. El cambio más importante de esa revisión: la primera versión de este diseño consideraba publicar las cinco responsabilidades del Motor Creativo (Intérprete, Recetas, Composición, Variantes, Filtro) como cinco módulos independientes. Se descartó — viven dentro de un mismo módulo cohesivo (sección 1) porque comparten ciclo de vida y tipos de datos, y porque cinco fronteras publicables no protegen nada que una buena separación interna no proteja igual de bien, a un costo de coordinación mucho menor. El resultado final tiene seis módulos en total, tres de ellos ya existentes — no doce, no veinte. Cualquier adición futura a esta arquitectura debería justificarse con el mismo estándar: una frontera nueva solo se gana su lugar si protege algo que de otra forma se rompería.
