# THÖREN — Plan de Implementación

**Fecha:** 2026-07-30
**Naturaleza de este documento:** el puente entre `THOREN_TECHNICAL_ARCHITECTURE.md` y el código. Es un plan de ejecución, no una implementación — sin tareas de Jira, sin código. Cada fase es pequeña, se completa y se demuestra por separado, y produce algo que un equipo pequeño puede enseñar a alguien más al terminarla.
**Precondición:** la arquitectura de seis módulos (Dominio de Documento, Motor de Impresión, Motor de Exportación, Motor Creativo, Flujo de Experiencia, Interfaz) queda aprobada y no se reabre aquí. Este plan no rediseña nada — decide en qué orden construirlo.

La secuencia sigue la propuesta original, ajustada en dos puntos que se explican en su fase correspondiente: la Fase 1 no construye un modelo de documento desde cero (ya existe y está probado) — establece y verifica su reutilización como base estable; y se señala explícitamente dónde la Fase 4 y la Fase 5 pueden avanzar en paralelo si el equipo crece.

---

## Fase 1 — Núcleo del Documento

**Objetivo.** Confirmar y exponer, como una base estable y mínima, el contrato que el Motor Creativo va a necesitar del Dominio de Documento, el Motor de Impresión y el Motor de Exportación — sin descubrir sorpresas de compatibilidad después de haber construido encima.

**Alcance.** Verificar que el modelo de documento ya existente puede representar una composición simple (un objeto de texto centrado dentro de una forma geométrica). Construir un único adaptador delgado y nuevo que traduzca parámetros simples (contenido, tipografía, color, arquetipo geométrico mínimo) en un documento válido usando las primitivas de layout ya existentes. Confirmar la exportación de ese documento a SVG con el Motor de Exportación ya existente, sin modificarlo. **Fuera de alcance:** cualquier noción de receta, interpretación de intención, o interfaz nueva.

**Dependencias.** Ninguna — es la primera fase. Se apoya en el Dominio de Documento, el Motor de Impresión y el Motor de Exportación ya existentes.

**Módulos/clases nuevas.** Un único adaptador de "composición básica" — la única pieza de código nueva de esta fase, deliberadamente pequeña.

**Interfaces públicas.**
- `componer(parámetros) → Document`
- `exportarSVG(Document) → archivo`

Ambas ya casi existen dispersas en el sistema actual; aquí se consolidan y documentan como el contrato formal que el resto del plan va a usar sin volver a cuestionarlo.

**Pruebas automatizadas.** Unitarias del adaptador (dado un conjunto de parámetros, el documento resultante tiene la estructura esperada, para al menos dos arquetipos geométricos distintos). Una prueba de extremo a extremo mínima: parámetros → documento → SVG, verificando que el archivo contiene el texto correcto.

**Riesgos.** Que el sistema de layout paramétrico ya existente, pensado originalmente para plantillas fijas, no se preste a ser invocado desde fuera de su contexto original sin fricción. *Mitigación:* si aparece esa fricción, se resuelve con la capa de adaptación ya prevista en la Arquitectura Técnica — nunca modificando el núcleo probado.

**Definition of Done.** El adaptador de composición básica genera documentos válidos para al menos dos arquetipos distintos, ambos exportables a SVG sin error, con toda la suite de pruebas en verde.

**Entregable demostrable.** Un harness mínimo (no una pantalla nueva) donde alguien del equipo pasa "Marcela & Andrés" + una tipografía + un color, y obtiene un SVG real y descargable. Prueba puramente técnica, pero verificable a simple vista.

---

## Fase 2 — Motor Creativo v1

**Objetivo.** Demostrar la tubería completa Intérprete → Receta → Composición con una sola receta, produciendo un primer lote genuinamente generado a partir de una frase real — no estático.

**Alcance.** Un Intérprete de intención mínimo, basado en reglas, que extrae ocasión y contenido personal de una frase (cubriendo los casos comunes descritos en `THOREN_CREATIVE_ENGINE.md` §4). Una receta completamente desarrollada con tres arquetipos (por ejemplo, "Elegante" para bodas). Un Selector trivial (una sola receta disponible en esta fase). El paso de Composición conectado de verdad al núcleo de la Fase 1. Verificaciones de calidad mínimas y estructurales únicamente (texto no desbordado, contraste suficiente) — el Filtro de calidad completo llega en la Fase 5.

**Dependencias.** Fase 1 completa.

**Módulos/clases nuevas.** El Intérprete de intención. La definición de datos de la primera receta (paleta, tipografía, arquetipos, motivos, reglas). La lógica de Composición que instancia un arquetipo de esa receta con el contenido interpretado.

**Interfaces públicas.**
- `interpretar(frase) → Intent`
- `generarLote(Intent) → Composition[]`

**Pruebas automatizadas.** Pruebas de tabla para el Intérprete contra un corpus de frases de boda variadas, incluyendo los casos límite simples de `THOREN_CREATIVE_ENGINE.md` §14 (frase corta, informal, con fragmentos). Pruebas basadas en propiedades para la Composición: para cualquier Intent válido, la salida nunca viola las reglas declaradas de la receta. Una prueba de integración de extremo a extremo: frase → tres composiciones válidas y distintas, todas exportables a SVG.

**Riesgos.** Que el Intérprete se ajuste en exceso a los ejemplos usados durante su construcción y falle ante frases reales distintas. *Mitigación:* el corpus de pruebas crece con frases reales recogidas en cada sesión de prueba manual del equipo, no solo con ejemplos inventados de antemano.

**Definition of Done.** Dada cualquier frase razonable sobre una boda, el sistema produce tres composiciones válidas y distintas entre sí (arquetipo distinto cada una), dentro del presupuesto de tiempo de `THOREN_TECHNICAL_ARCHITECTURE.md` §7, con toda la suite en verde.

**Entregable demostrable.** Un harness de prueba mínimo (todavía no la Beta) donde se escribe una frase de boda real y aparecen tres SVGs genuinamente generados, con el nombre correcto y composiciones visiblemente distintas entre sí.

---

## Fase 3 — Flujo de Experiencia

**Objetivo.** Conectar el Motor Creativo de la Fase 2 a la Beta ya existente, reemplazando sus tres propuestas estáticas por contenido real — reproduciendo exactamente el recorrido de `THOREN_EXPERIENCE_BLUEPRINT.md`, sin que quien la use note ninguna diferencia salvo que el contenido ahora es genuinamente suyo.

**Alcance.** Formalizar el Flujo de Experiencia como la máquina de estados descrita en la Arquitectura Técnica (hoy vive implícita dentro de la lógica de la Beta). Conectar sus transiciones a llamadas reales al Motor Creativo y al Motor de Exportación. Adaptar la Interfaz existente para suscribirse a este flujo formal, sin lógica de negocio propia.

**Dependencias.** Fase 2 completa.

**Módulos/clases nuevas.** El Flujo de Experiencia como módulo propio (estado + transiciones + los puntos de integración hacia el Motor Creativo y el Motor de Exportación).

**Interfaces públicas.** Los estados y acciones que la Interfaz consume — por ejemplo, `estadoActual()`, `avanzar()`, `elegir(composición)`, `obtener()` — sin exponer jamás, a través de esta frontera, el nombre de una receta, una puntuación de calidad, ni ningún parámetro interno de composición.

**Pruebas automatizadas.** Pruebas de la máquina de estados en sí misma (transiciones válidas e inválidas). Una prueba de contrato que verifique explícitamente la ausencia de fuga de información interna entre el Flujo de Experiencia y la Interfaz. Una prueba de extremo a extremo sobre la interfaz real confirmando que el recorrido ocurre en el orden y el ritmo exactos del Blueprint, ahora con datos reales detrás.

**Riesgos.** Que conectar generación real (aunque rápida) rompa sutilmente el ritmo ya afinado de la Beta actual. *Mitigación:* medir tiempos reales contra los objetivos de rendimiento desde el primer día de esta fase, nunca al final como una revisión posterior.

**Definition of Done.** La Beta se comporta, de principio a fin, exactamente como hoy desde la perspectiva de quien la usa — pero las propuestas que aparecen provienen genuinamente del Motor Creativo.

**Entregable demostrable.** La Beta desplegada, en el mismo enlace de siempre, generando propuestas reales para bodas. Puede enviarse a Vladimir o a un tester externo sin ninguna advertencia de que "esto es solo una demostración".

---

## Fase 4 — Variantes

**Objetivo.** Activar "más como esta" de forma real y acotada, tal como lo definen `THOREN_CREATIVE_ENGINE.md` §9-10.

**Alcance.** El Generador de variantes, conectado a la receta ya validada en fases anteriores. El límite duro (una ronda, máximo tres variantes) implementado sin excepciones. El gesto de interfaz correspondiente, integrado dentro del mismo instante de "recorrer las propuestas" ya descrito en el Blueprint — nunca como un paso nuevo en la línea de tiempo.

**Dependencias.** Fase 3 completa.

**Módulos/clases nuevas.** El Generador de variantes (dentro del Motor Creativo). Un estado adicional del Flujo de Experiencia que representa "explorando variantes de esta dirección", con su contador de rondas ya usadas.

**Interfaces públicas.**
- `generarVariantes(composiciónSemilla) → Composition[]` (máximo 3), expuesta únicamente al Flujo de Experiencia.

**Pruebas automatizadas.** Que el límite de una ronda se respeta sin excepción, incluyendo intentos deliberados de forzarlo en la prueba. Que las variantes difieren estructuralmente de la semilla (arquetipo o motivo distinto, nunca un simple recoloreado). Una prueba de extremo a extremo del gesto completo sobre la interfaz real.

**Riesgos.** Que el límite de una sola ronda se sienta abrupto en la práctica, no solo en el papel. *Mitigación:* validar esto específicamente en las próximas sesiones de `THOREN_USABILITY_TEST_PLAN.md`, y ajustar el número solo con esa evidencia — nunca por intuición.

**Definition of Done.** Pedir "más como esta" siempre entrega hasta tres variantes genuinamente distintas; pedirlo una segunda vez sobre la misma dirección nunca ofrece opciones nuevas, con la suite de pruebas del límite duro en verde.

**Entregable demostrable.** En la Beta desplegada, alguien pide "más como esta" sobre una propuesta de boda, ve tres variantes reales y distintas, y confirma que una segunda solicitud ya no genera nada nuevo.

*Nota de secuencia:* esta fase y la Fase 5 dependen ambas de la Fase 3, pero no dependen entre sí de forma directa — un equipo con más de una persona puede avanzarlas en paralelo sin conflicto.

---

## Fase 5 — Calidad

**Objetivo.** Activar el Filtro de calidad completo y ampliar de una receta a varias, para que el lote inicial varíe genuinamente según la ocasión descrita.

**Alcance.** Las verificaciones completas de `THOREN_CREATIVE_ENGINE.md` §11 y la clasificación de cinco niveles de §12. Tres o cuatro recetas adicionales. El Selector real, activado con la tabla de afinidad para un primer subconjunto de ocasiones (por ejemplo: boda, negocio, regalo).

**Dependencias.** Fase 3 completa (puede avanzar en paralelo a la Fase 4, ver nota arriba).

**Módulos/clases nuevas.** El Filtro de calidad completo (verificadores + clasificador). Las definiciones de datos de las nuevas recetas. El Selector real con la tabla de afinidad.

**Interfaces públicas.**
- `validar(Composition) → Validation` (con la clasificación de cinco niveles).

Ninguna interfaz definida en fases anteriores cambia de forma — esta fase profundiza lo que ya existe detrás del mismo contrato.

**Pruebas automatizadas.** Casos de referencia (composiciones conocidas como buenas y como malas) para verificar que cada nivel de clasificación se mantiene estable. Pruebas de que el Selector activa el subconjunto correcto de recetas según la tabla de afinidad. Instrumentación de la tasa de rechazo como parte de las pruebas de integración, no solo como métrica de producción.

**Riesgos.** Que el Filtro de calidad resulte demasiado estricto, alargando los tiempos de generación por reintentos excesivos. *Mitigación:* monitorear la tasa de rechazo desde el primer despliegue de esta fase y calibrar umbrales con evidencia real, nunca a ciegas.

**Definition of Done.** El lote inicial varía de forma visible según la ocasión descrita; ninguna composición por debajo de "profesional" llega jamás a la interfaz; la tasa de rechazo está medida y es estable.

**Entregable demostrable.** Describir una boda y describir un negocio en la misma Beta produce lotes visiblemente distintos entre sí, ambos con la misma calidad consistente.

---

## Fase 6 — Escalabilidad

**Objetivo.** Ampliar el sistema a la totalidad de ocasiones y productos previstos, y conectar la extensión de impresión en volumen al Motor de Impresión real — sin tocar el núcleo, como prueba de que la arquitectura realmente lo permite.

**Alcance.** Completar la tabla de afinidad a las catorce categorías de `THOREN_CREATIVE_ENGINE.md` §6. Completar las siete recetas. Evaluar y, si aplica, extender el Intérprete de intención a un idioma adicional. Conectar la pregunta diferida de "¿necesitas varias copias?" al Motor de Impresión real (imposición, Preflight, PDF de producción) en lugar de la confirmación simulada de la Beta actual.

**Dependencias.** Fase 5 completa.

**Módulos/clases nuevas.** Ninguna estructural — esta fase es, deliberadamente, sobre todo contenido (recetas y datos de afinidad) más la conexión real de una extensión ya prevista desde la Arquitectura Técnica.

**Interfaces públicas.** Ninguna nueva. Esta fase es, en sí misma, la prueba de que las fases anteriores construyeron una arquitectura que crece sin reestructurarse.

**Pruebas automatizadas.** Cada receta y ocasión nueva pasa por la misma suite de calidad ya existente antes de integrarse — nunca con un umbral relajado. Una prueba de extremo a extremo de la extensión de impresión real, desde la confirmación en la Beta hasta un PDF de producción descargado.

**Riesgos.** Cuello de botella en la autoría de recetas y arquetipos nuevos, que es trabajo de diseño, no solo de ingeniería. *Mitigación:* tratar la autoría de recetas como un flujo de trabajo continuo del equipo de diseño, no como una tarea técnica de una sola vez.

**Definition of Done.** Las catorce categorías de ocasión están mapeadas; las siete recetas existen y pasan el Filtro de calidad; la extensión de impresión en volumen produce un archivo de producción real y válido.

**Entregable demostrable.** La promesa completa del producto, de punta a punta, terminando en un archivo de producción real — esta fase es, en efecto, la candidata a versión comercial completa.

---

## Matriz final

| Fase | Objetivo | Resultado visible | Riesgo principal | Dependencias |
|---|---|---|---|---|
| 1 — Núcleo del Documento | Establecer una base reutilizada y probada para componer y exportar. | Un SVG real generado desde un harness técnico. | El kit de layout existente no se presta a reutilizarse sin fricción. | Ninguna |
| 2 — Motor Creativo v1 | Probar la tubería completa con una receta. | Tres SVGs reales y distintos desde una frase de boda. | El Intérprete se sobreajusta a los ejemplos de construcción. | Fase 1 |
| 3 — Flujo de Experiencia | Conectar el motor real a la Beta ya existente. | La Beta genera contenido real, sin que se note el cambio desde afuera. | Los tiempos reales rompen el ritmo ya afinado. | Fase 2 |
| 4 — Variantes | Activar "más como esta", acotado. | Tres variantes reales; una segunda solicitud no ofrece nada nuevo. | El límite de una ronda se siente abrupto en la práctica. | Fase 3 (en paralelo a Fase 5) |
| 5 — Calidad | Filtro completo + varias recetas. | Ocasiones distintas producen lotes visiblemente distintos, misma calidad. | El Filtro es demasiado estricto y alarga tiempos. | Fase 3 (en paralelo a Fase 4) |
| 6 — Escalabilidad | Cobertura completa + impresión real. | Producto completo, con archivo de producción real al final. | Cuello de botella en autoría de contenido creativo. | Fase 5 |

---

## Recomendación: la fase mínima para una Beta privada con usuarios reales

**La Fase 3 es el punto mínimo viable.** Es la primera fase en la que la Beta deja de mostrar contenido estático y genera algo real de principio a fin, cumpliendo la promesa central ("menos de un minuto", sin edición, con revelación) para al menos un caso de uso completo (bodas). A partir de la Fase 3, puede entregarse a Vladimir y a un usuario externo sin ninguna advertencia de que se trata de una demostración — exactamente el criterio de éxito que se fijó para la Beta.

La condición de esa recomendación: una Beta lanzada en la Fase 3 debe reclutarse **con cuidado de que el caso de uso coincida con la única ocasión soportada** (bodas) — no tendría sentido todavía probarla con alguien que necesita etiquetas para su negocio, porque el Selector aún no tiene más que una receta que ofrecer. Ampliar la Beta a un grupo de usuarios con necesidades diversas debería esperar a la **Fase 5**, que es cuando el lote empieza a variar genuinamente según la ocasión y la calidad está garantizada por el Filtro completo — ese es el punto en el que una Beta privada más amplia, con perfiles de usuario distintos, deja de depender de que el equipo elija con cuidado a quién invitar.

En resumen: **Fase 3 para validar la magia central con el público correcto y acotado; Fase 5 para abrir la Beta a la diversidad de casos de uso que el producto final promete.**
