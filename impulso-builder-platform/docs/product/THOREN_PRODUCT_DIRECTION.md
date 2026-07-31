# THÖREN — Dirección de Producto

**Fecha:** 2026-07-31
**Naturaleza de este documento:** un análisis estratégico, no técnico ni de experiencia. Responde una sola pregunta — ¿cuál debe ser realmente el producto? — sin proteger ningún trabajo ya hecho y sin justificar ninguna decisión pasada. No modifica ningún documento existente, no escribe código, no abre ninguna fase nueva.
**Punto de partida:** este documento no asume que "más" es mejor, ni que lo ya construido merece continuar solo por existir. Evalúa cuatro escenarios sobre las dos líneas de trabajo que hoy conviven en el proyecto sin que nadie haya decidido formalmente su relación (hallazgo de `THOREN_PROJECT_STATUS_v1.0.md` §6.3):

1. **Sticker Builder** — editor de diseño tradicional (herramientas, capas, wizard de exportación), catálogo comercial de 63 plantillas (14 construidas, 0% de assets reales producidos), paquete comercial RC1 ya empaquetado y verificado, Beta Comercial planeada y pausada, nunca publicada en Gumroad.
2. **THÖREN 2.0** — Motor Creativo determinista + experiencia conversacional sin edición (Concepto E), una sola receta y una sola ocasión implementadas, en Fase de Validación de Usuario, cero personas ajenas al equipo la han probado todavía.

---

## Los cuatro escenarios

### A. Mantener ambos productos independientes (misma marca, dos experiencias)

**Ventajas:** ningún trabajo se descarta; se capturan dos segmentos de cliente distintos (quien quiere control total vs. quien quiere velocidad); Sticker Builder puede generar ingreso mientras THÖREN 2.0 termina de validarse.

**Desventajas:** bajo una sola marca, ofrecer un editor completo y una experiencia que promete explícitamente "nunca vas a necesitar editar" es una contradicción visible para cualquier cliente que vea ambas — mina la promesa central de THÖREN 2.0 en el momento exacto en que se intenta validar si esa promesa funciona.

**Costo de mantenimiento:** alto — dos superficies de producto, dos catálogos de soporte, dos flujos de onboarding, bajo un solo equipo que hasta hoy ha operado como una sola persona con asistencia de IA.

**Claridad para el cliente:** baja. "THÖREN" dejaría de significar una sola cosa.

**Escalabilidad:** pobre para el tamaño de equipo actual; exige duplicar atención en cada decisión futura.

**Diferenciación:** se diluye — ninguno de los dos productos queda como "la razón por la que existe THÖREN".

**Potencial comercial:** ingreso inmediato de Sticker Builder, potencial incierto de THÖREN 2.0; ninguno de los dos recibe atención completa.

**Complejidad técnica:** manejable — ambos ya comparten `document-schema`/`export-engine`/`print-engine` sin conflicto.

**Riesgo:** dividir el foco exactamente cuando la pregunta más importante del proyecto (¿la ausencia de edición funciona con una persona real?) necesita atención total.

**Velocidad de lanzamiento:** Sticker Builder podría publicarse hoy; THÖREN 2.0 sigue su propio ritmo de validación sin aceleración real por mantener ambos.

**Monetización:** dos fuentes de ingreso potenciales, ninguna con foco dedicado.

**Impacto en la documentación existente:** ninguno nuevo requerido de inmediato, pero perpetúa exactamente la ambigüedad sin resolver que esta auditoría encontró.

---

### B. Sticker Builder como producto separado, THÖREN 2.0 como otro (marcas explícitamente distintas)

**Ventajas:** resuelve la confusión de marca del escenario A; cada producto puede comunicar su propia promesa sin contradecir a la otra; preserva el valor de ambas apuestas.

**Desventajas:** exige ejecutar un rebranding real (nombre, identidad, posicionamiento) para uno de los dos productos — trabajo nuevo, no solo una decisión; sigue exigiendo dos equipos de atención donde hoy hay uno.

**Costo de mantenimiento:** alto — igual que A, más el costo de sostener dos marcas independientes en el mercado (dos audiencias, dos mensajes, dos canales).

**Claridad para el cliente:** alta — es la principal ventaja real de este escenario.

**Escalabilidad:** pobre para el tamaño de equipo actual, igual que A.

**Diferenciación:** alta, pero condicionada a ejecutar la separación completa, no a medias.

**Potencial comercial:** similar a A, con mejor conversión esperada en ambos por la claridad de marca — pero sigue siendo dos apuestas simultáneas, no una.

**Complejidad técnica:** igual que A a nivel de código; agrega complejidad organizativa (dos historias de marca que mantener consistentes).

**Riesgo:** el mismo riesgo de foco dividido que A, más el riesgo de ejecución del propio rebranding.

**Velocidad de lanzamiento:** Sticker Builder podría lanzarse bajo su propio nombre de inmediato; el rebranding es trabajo adicional antes de poder hacerlo bien.

**Monetización:** igual potencial que A, mejor ejecutado — pero sigue sin resolver la pregunta de dónde debe ir la atención del equipo primero.

**Impacto en la documentación existente:** el más alto de los cuatro escenarios — prácticamente todo documento que hoy asume "THÖREN Sticker Builder" como una sola entidad necesitaría reescritura de nombre y posicionamiento.

---

### C. Absorber Sticker Builder completamente dentro de THÖREN (como "Modo Avanzado")

Este escenario ya tiene un lugar reservado, aunque condicional, en la arquitectura congelada: `THOREN_CREATIVE_ENGINE.md` §16 permite que el editor libre, la barra de herramientas, el inspector y el wizard de exportación "puedan seguir existiendo únicamente dentro de un eventual Modo Avanzado, nunca en el recorrido por defecto".

**Ventajas:** reutiliza el trabajo de ingeniería del editor completo (no solo el motor de impresión/exportación, ya reutilizado de todas formas) como una vía secundaria de valor — un camino de "graduación" para quien quiera más control después de ver lo que el Motor Creativo genera; una sola marca, un solo catálogo de soporte, el menor costo incremental de los escenarios que conservan ambos.

**Desventajas — y esta es la más seria de todo el documento:** introducir un Modo Avanzado descubrible, incluso como opción secundaria, crea exactamente la vía de escape que la Fase de Validación de Usuario existe para detectar si hace falta o no. Si un participante busca editar y *la encuentra*, la sesión deja de medir lo que `THOREN_USABILITY_TEST_PLAN.md` quiere medir — si la persona **necesita** editar, no si **puede**. Absorber Sticker Builder ahora contaminaría la única pregunta que el proyecto no puede permitirse contestar mal.

**Costo de mantenimiento:** el más bajo de los tres escenarios que conservan ambos productos — un solo release, un solo equipo, una sola base de código consolidada.

**Claridad para el cliente:** media — funciona si se comunica con disciplina ("no lo necesitas, pero está ahí si de verdad lo quieres"); falla si el marketing se apoya en "¡también tiene un editor completo!", porque eso invalida la promesa central frente al cliente antes incluso de que la use.

**Escalabilidad:** buena — un solo producto que crece en profundidad, no en superficie.

**Diferenciación:** intacta *si* el Modo Avanzado permanece genuinamente secundario; en riesgo real si no.

**Potencial comercial:** el más alto en teoría — un embudo único (generación rápida gratuita o barata → modo avanzado de producción de impresión real como nivel pagado) que aprovecha exactamente la profundidad técnica que Sticker Builder ya construyó (imposición, preflight, sangrado, línea de corte) y que THÖREN 2.0 por sí solo no necesita para su recorrido por defecto.

**Complejidad técnica:** media-alta a corto plazo (conectar dos experiencias con reglas de dependencia distintas), pero no es invención nueva — la arquitectura ya la previó.

**Riesgo:** el más alto de los tres escenarios que conservan trabajo, precisamente porque el riesgo no es de ejecución sino de **validez del experimento que ya está corriendo**.

**Velocidad de lanzamiento:** no acelera nada hoy — el Modo Avanzado es, por diseño, posterior a la validación, no paralelo a ella; mientras tanto, RC1 queda archivado sin publicarse, no lanzado.

**Monetización:** el mejor modelo a largo plazo de los cuatro, condicionado a que la validación de THÖREN 2.0 tenga éxito primero — no es una opción de corto plazo bajo ninguna lectura honesta.

**Impacto en la documentación existente:** moderado — los documentos de Sticker Builder se reencuadran como especificación de un "Modo Avanzado" futuro, no se descartan; el plan de Beta Comercial y el lanzamiento en Gumroad tal como están definidos hoy dejan de tener sentido y deberían cerrarse formalmente.

---

### D. Cancelar Sticker Builder como línea de producto comercial independiente, concentrar todos los recursos en THÖREN 2.0

**Aclaración necesaria antes de listar ventajas y desventajas:** "cancelar" aquí se refiere específicamente al editor tradicional, el catálogo comercial de 63 plantillas y el lanzamiento en Gumroad como producto independiente — no al motor de impresión, exportación ni al esquema de documento, que THÖREN 2.0 ya reutiliza sin modificarlos y seguirá necesitando. No se pierde ingeniería de plataforma; se descontinúa una línea de producto de cara al cliente.

**Ventajas:** máximo foco posible para el tamaño real de equipo que este proyecto tiene hoy; elimina por completo la ambigüedad que la auditoría encontró, en vez de reencuadrarla o posponerla; protege sin condiciones la validez del experimento de validación en curso — no existe ninguna vía de escape hacia un editor que contamine la lectura de las sesiones; coincide con el juicio ya emitido por el propio proyecto: `THOREN_PRODUCT_EXPERIENCE_AUDIT.md` calificó la experiencia del editor, ya comercialmente lista, como carente de "efecto wow" — la reinvención completa nació de esa conclusión, no de una idea paralela.

**Desventajas:** se renuncia a un ingreso real y disponible de inmediato (RC1 está construido, probado y listo para publicar hoy); si la hipótesis central de THÖREN 2.0 resultara refutada tras la validación, el proyecto se queda sin ningún producto alternativo generando ingreso mientras se re-piensa el rumbo — es la apuesta de mayor varianza de las cuatro.

**Costo de mantenimiento:** el más bajo de los cuatro, de forma permanente.

**Claridad para el cliente:** la más alta posible — un producto, una promesa, sin excepción.

**Escalabilidad:** la mejor de las cuatro para un equipo pequeño.

**Diferenciación:** totalmente protegida — es el único escenario sin ningún riesgo de dilución de la promesa central.

**Potencial comercial:** condicionado enteramente al éxito de THÖREN 2.0, que todavía no tiene ni un solo dato de usuario real ni un modelo de precios definido — el potencial es alto si la apuesta es correcta, y nulo en el corto plazo si no lo es.

**Complejidad técnica:** la más baja hacia adelante — una sola superficie de producto que mantener, aunque la profundidad del motor de impresión/exportación permanece (y sigue siendo necesaria).

**Riesgo:** el más alto en términos financieros/de continuidad (todo el negocio depende de una sola hipótesis todavía sin validar); el más bajo en términos de claridad estratégica y de integridad del proceso de validación ya en marcha.

**Velocidad de lanzamiento:** no lanza nada nuevo de inmediato — pero cierra, de forma limpia y sin ambigüedad, la pregunta que hoy bloquea cualquier afirmación completa sobre qué es THÖREN.

**Monetización:** cero en el corto plazo desde Sticker Builder (ingreso renunciado, no diferido); dependiente por completo de que THÖREN 2.0 defina y valide un modelo de monetización propio, que hoy no existe en ningún documento.

**Impacto en la documentación existente:** bajo en volumen de escritura futura — el catálogo comercial, el plan de Beta Comercial y los documentos de lanzamiento de Gumroad se cierran formalmente (un cierre, no una reescritura), y todo el esfuerzo de documentación futura se concentra en un solo dominio de decisión, resolviendo directamente la fragmentación que esta auditoría encontró.

---

## Comparación directa

| | A. Ambos, una marca | B. Ambos, dos marcas | C. Absorber (Modo Avanzado) | D. Cancelar Sticker Builder |
|---|---|---|---|---|
| Costo de mantenimiento | Alto | Alto | Medio-bajo | **Bajo** |
| Claridad para el cliente | Baja | Alta | Media | **Alta** |
| Escalabilidad (equipo actual) | Pobre | Pobre | Buena | **Buena** |
| Diferenciación de THÖREN | Diluida | Preservada | En riesgo | **Protegida** |
| Potencial comercial a corto plazo | Medio | Medio | Bajo | Bajo |
| Potencial comercial a largo plazo | Medio | Medio | **Alto (condicional)** | Alto (condicional) |
| Complejidad técnica | Media | Media | Media-alta | **Baja** |
| Riesgo estratégico/de validación | Alto | Alto | **El más alto** | Bajo |
| Riesgo financiero/continuidad | Bajo | Bajo | Bajo | **Alto** |
| Velocidad de lanzamiento (hoy) | Sticker Builder: sí | Sticker Builder: sí (tras rebrand) | Ninguno | Ninguno |
| Impacto en documentación | Bajo | **Muy alto** | Medio | Bajo |

Ninguna columna gana en las once filas — esa es exactamente la naturaleza de una decisión estratégica real. La pregunta no es cuál escenario no tiene desventajas, sino cuál desventaja está dispuesto el proyecto a aceptar dado lo que dice, con sus propias palabras, que quiere ser.

---

## Recomendación

**D — Cancelar Sticker Builder como línea de producto comercial independiente, concentrar todos los recursos en THÖREN 2.0.**

El argumento decisivo no es de costos ni de arquitectura — ambos favorecen a D, pero no serían suficientes por sí solos para justificar renunciar a un ingreso real y disponible hoy. El argumento decisivo es de **coherencia con lo que el propio proyecto ya decidió, con evidencia, hace dos días**: `THOREN_PRODUCT_EXPERIENCE_AUDIT.md` no encontró que el editor de Sticker Builder fuera técnicamente deficiente — lo encontró **comercialmente listo y aun así carente de la reacción que un producto necesita para ganar**. Esa auditoría no fue un ejercicio paralelo; fue el origen textual, citado explícitamente, de `THOREN_VISION_2.md` y de toda la cadena de documentos que este proyecto ha construido y congelado desde entonces. Mantener Sticker Builder vivo — en cualquiera de los escenarios A, B o C — es, en la práctica, no terminar de creer en la conclusión de esa auditoría.

El escenario C es la opción más seductora porque parece no sacrificar nada — pero es, de las cuatro, la que más directamente amenaza la fase en la que el proyecto está *hoy*: introducir una vía de escape hacia un editor, aunque sea "avanzada" y "eventual", arriesga invalidar la lectura de la Fase de Validación de Usuario que ya está en curso. Un Modo Avanzado puede ser una decisión correcta **después** de validar que la experiencia sin edición funciona — no antes, y no en paralelo.

El riesgo real de D —quedarse sin ingreso de respaldo si THÖREN 2.0 no logra validarse— es genuino y no debe minimizarse. Pero es un riesgo de negocio a asumir con los ojos abiertos, no una razón para diluir la apuesta ya hecha. Un producto que compite consigo mismo por la atención del cliente y del equipo no reduce ese riesgo — solo lo reparte en dos apuestas peores en vez de concentrarlo en una apuesta clara.

**Si THÖREN fuera mi empresa, elegiría D — cancelar Sticker Builder como producto independiente y concentrar todos los recursos en THÖREN 2.0 — porque el proyecto ya demostró, con su propia auditoría, que un editor bien construido no es la razón por la que alguien elegiría esta marca, y seguir sosteniéndolo divide exactamente el foco que la validación de la única idea que sí podría serlo necesita para tener una respuesta limpia.**
