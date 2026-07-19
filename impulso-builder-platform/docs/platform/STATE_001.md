# STATE OF THE PLATFORM — 001

> Auditoría completa de Impulso Platform al cierre de Epic 5 (Project Library / Workspace), realizada como Epic 6 (Platform Consolidation). Evalúa el **producto completo** — no solo el código —, con puntuaciones justificadas en evidencia real (conteos de tests, cobertura, dependencias, superficie de API), no en impresión general. Documento de consolidación: no implementa nada, no abre nuevas épicas.

**Alcance auditado:** 8 paquetes (`document-schema`, `engine`, `renderer-konva`, `storage-kit`, `asset-library`, `template-library`, `project-library`, `export-engine`) + 1 app (`sticker-builder`). 863 tests automatizados, 0 dependencias circulares, 5 Épicas + 3 Foundations + 4 Editor Epics/Milestones cerrados.

---

## 1. Arquitectura — 9/10

**Evidencia:**
- Separación de tres niveles (Document Schema → Engine → Renderer) respetada sin excepción en 8 paquetes — verificado con `madge --circular` en cada uno, no solo declarado en documentación.
- El patrón "descriptor liviano + contenido pesado, memoria + IndexedDB, contract-tested" se repitió tres veces (Asset/Template/Project Library) y, al tercer caso real, se extrajo a `packages/storage-kit` — evidencia de que la arquitectura se autocorrige con disciplina, no que acumula deuda silenciosamente.
- Ninguna dependencia circular en absoluto entre los 8 paquetes + la app.
- `packages/engine/package.json` no depende de Konva — la promesa central de la arquitectura ("un cambio de renderer no toca el Engine") sigue siendo una garantía verificable, no una aspiración.

**Riesgos:**
- El "boceto de plugins" (`registerShapeTypes`/`registerExporters`/`registerToolPanels`/`registerRendererBindings`) descrito desde Fase 0 nunca se implementó ni se revisó — sigue siendo enteramente conceptual. No hay evidencia real de que esa forma sea la correcta hasta que exista un segundo módulo.
- `document-schema/src/index.ts` usa `export * from ...` (superficie implícita) mientras los otros 7 paquetes usan exports nombrados explícitos (superficie deliberada) — inconsistencia de estilo, no de sustancia (ver Auditoría de APIs, §7).

## 2. Reutilización — 8/10

**Evidencia:**
- `cloneProjectWithNewIds` (Engine) es reutilizado sin duplicación por `instantiateTemplate` (Template Library) y `duplicateProject` (Project Library) — la lógica de clonado recursivo de grupos nunca se reimplementó dos veces.
- `packages/storage-kit` es en sí mismo un caso de reutilización genuina extraída, no especulada.
- Asset Library, Template Library y Project Library son, en su diseño, 100% agnósticos de Sticker Builder — filtran por `moduleId` recibido, nunca lo asumen.

**Riesgos:**
- **Ninguna de estas afirmaciones de reutilización está probada con un segundo consumidor real todavía.** Toda la "reutilización" de plataforma es, hoy, estructural — el primer módulo que realmente la ejercite (Planner Builder u otro) es la única prueba que falta.
- El bridge `createThumbnailGenerator` (conecta Export Engine con Template/Project Library) vive privado en `apps/sticker-builder/src/app.ts` — correcto según el ADR de cada librería (ninguna quiere depender de Export Engine), pero un segundo módulo lo reimplementaría línea por línea. Candidato real a extracción cuando exista ese segundo módulo, no antes (ver Auditoría de Paquetes, §12).

## 3. Escalabilidad — 6/10

**Evidencia:**
- 14 decisiones de rendimiento documentadas en `PERFORMANCE_BUDGET.md`, cada una con complejidad/cuello de botella/estrategia futura — la disciplina de "documentar antes de que sea un problema" es real y consistente desde Foundation 3.
- El patrón preview-en-vivo/commit-al-soltar (mover/resize/rotar) ya evita multiplicar el costo por frame de gesto continuo.

**Riesgos:**
- El objetivo declarado del proyecto ("miles de objetos sin degradar la experiencia") **nunca se midió contra un documento real de ese tamaño** — todas las estrategias de mitigación (reconciliación incremental del Renderer, índice `objectId→ruta`, patches en vez de snapshots) están diseñadas, no implementadas ni validadas.
- La Workspace no tiene paginación/virtualización ni búsqueda — correcto al volumen actual, un riesgo real si el número de proyectos por usuario crece.
- Ningún módulo futuro (segundo Builder) ha ejercido la plataforma a escala — la "preparación para escalar a múltiples Builders" es, igual que la reutilización, teórica hasta el primer caso real.

## 4. Performance — 7/10

**Evidencia:**
- Cero optimización prematura, con cada decisión de "no optimizar todavía" documentada explícitamente (Performance Budget) — evita tanto la sobre-ingeniería como la sorpresa tardía.
- Costos reales identificados y mitigados donde importaba (ej. `layersPanel.ts` separando reconstrucción completa de actualización liviana tras un bug real detectado en Epic 1).

**Riesgos:**
- **Cero benchmarks automatizados.** Todo el razonamiento de rendimiento es cualitativo (complejidad Big-O razonada a mano), no medido con datos reales ni con un test de regresión de performance.
- El costo real de generar un thumbnail (rasterización PNG completa vía Konva headless) en cada "Guardar" explícito no está medido ni documentado en `PERFORMANCE_BUDGET.md` todavía (ver corrección menor aplicada en esta auditoría).

## 5. UX — 6/10

**Evidencia:**
- Disciplina "UX First" activa desde Editor 2, reforzada en Epic 5 con la regla de evaluación dual Arquitectura+UX y la práctica de UX Audits independientes.
- La primera UX Audit (Workspace, `docs/ux-audits/0001-workspace.md`) encontró y clasificó hallazgos reales y accionables, no genéricos.

**Riesgos:**
- El hallazgo más serio de toda la plataforma hasta la fecha: **salir del editor sin guardar descarta silenciosamente el trabajo, sin ningún aviso** — ningún producto de referencia (Figma/Illustrator/Canva) permite esto hoy en día.
- Solo la Workspace tiene una UX Audit formal — Editor, Templates y Export nunca fueron auditados bajo esta práctica (nació con Epic 5); es razonable esperar hallazgos similares sin descubrir todavía en esas áreas.
- Patrón recurrente de falta de navegación por teclado en grillas de tarjetas (galería de Templates Y Workspace comparten el mismo gap: miniatura/nombre son `<div>`/`<img>`/`<span>` con `click`, no elementos focusables).
- Un único punto de la app usa un `window.confirm()` nativo (Eliminar proyecto), rompiendo la consistencia visual que mantienen los demás diálogos.

## 6. Testing — 9/10

**Evidencia:**
- **863 tests automatizados** en total (93 document-schema + 225 engine + 144 renderer-konva + 22 asset-library + 61 export-engine + 28 template-library + 8 storage-kit + 36 project-library + 246 sticker-builder), **100% pasando**.
- Contract tests (misma suite corrida contra memoria e IndexedDB) para las 3 librerías de catálogo — garantiza intercambiabilidad real, no solo "se parecen".
- Verificación en navegador real (Playwright/Chromium) contra un build de producción en cada épica con superficie de UI, no solo tests unitarios con stubs.
- Bugs reales encontrados SOLO por esa verificación en navegador (ej. `selectionLayer` bloqueando handles por `listening:false` heredado — invisible para jsdom) — prueba de que la disciplina de doble verificación (unitaria + navegador real) no es ceremonial.

**Riesgos:**
- Sin tests de accesibilidad automatizados (ej. axe-core).
- Sin tests de regresión de performance.
- Solo un caso de snapshot visual real (comparación píxel a píxel editor-vs-PNG exportado, Epic 3) — ningún otro flujo tiene ese nivel de verificación visual automatizada.

## 7. Cobertura — 9/10

| Paquete | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `document-schema` | 100% | 100% | 100% | 100% |
| `engine` | 100% | 99.72% | 100% | 100% |
| `renderer-konva` | 99.74% | 98.29% | 98.36% | 99.74% |
| `asset-library` | 100% | 100% | 100% | 100% |
| `export-engine` | 99.59% | 99.22% | 100% | 99.59% |
| `template-library` | 100% | 100% | 100% | 100% |
| `storage-kit` | 100% | 92.85% | 90% | 100% |
| `project-library` | 100% | 100% | 100% | 100% |
| `apps/sticker-builder` | 98.75% | 93.1% | 92.55% | 98.75% |

Todos por encima del umbral permanente (90/90/90/85, ver `ENGINEERING_STANDARDS.md`). Los gaps restantes son, en su inmensa mayoría, ramas defensivas documentadas como imposibles/frágiles de reproducir de forma determinista en test (ej. `onerror` de `indexedDB.open`, verificado manualmente en navegador real en su lugar) o valores por defecto (`createIndexedDb*Store()` real) que un test en jsdom nunca ejercita — no cobertura fingida.

## 8. Documentación — 7/10

**Evidencia:**
- Los ADRs son, en profundidad, el punto más fuerte de todo el proyecto: 14 documentos, cada uno con Problema/Contexto/Alternativas evaluadas/Decisión/Consecuencias/Riesgos/Compatibilidad futura, sin excepción.
- Estándar de README por paquete (Qué es/qué no es, árbol, decisiones clave, riesgos, desarrollo, mejoras futuras) cumplido en los 9 paquetes/app.

**Riesgos (hallazgos reales de ESTA auditoría, ya corregidos donde fue seguro hacerlo):**
- `docs/ARCHITECTURE.md` estaba **5 épicas desactualizado** — describía tecnologías (React, Zustand, Tailwind, Radix, `idb`) que nunca se implementaron, y no mencionaba Asset Library, Export Engine, Templates ni Project Library en absoluto. **Corregido en esta auditoría** (ver §1 de este documento y el nuevo `docs/ARCHITECTURE.md`).
- `docs/product/06-Architecture-Decisions.md` (índice de lectura rápida de ADRs) se detenía en ADR-0009 — le faltaban los resúmenes de ADR-0010 a ADR-0014 (5 de 14 ADRs, más de un tercio del historial). **Corregido en esta auditoría.**
- `apps/sticker-builder/README.md` contenía una afirmación **factualmente incorrecta** ("Un solo slot de guardado en localStorage... cada Guardar sobrescribe el anterior") que dejó de ser cierta desde Epic 5. **Corregido en esta auditoría.**
- **Conclusión de proceso:** la disciplina de documentar lo NUEVO en cada épica es excelente; la disciplina de revisar si algo VIEJO quedó desactualizado por un cambio nuevo es la que falló — ningún proceso obligaba a ese barrido. Esta auditoría (y su repetición periódica) es exactamente el mecanismo que lo resuelve.

## 9. Calidad del código — 8/10

**Evidencia:**
- Cero `any` (estándar permanente respetado en los 8 paquetes + app).
- Sin código muerto detectado — funciones que dejaron de tener llamadores se eliminaron en el mismo cambio que las volvió innecesarias (ej. `saveProjectLocally`, `STICKER_SIZE_PRESETS`), no se dejaron "por si acaso".
- Decisión consistente de "no abstraer antes de un segundo caso real" aplicada y documentada explícitamente en múltiples ADRs — disciplina real, no solo un principio escrito.

**Riesgos:**
- **Filosofía de manejo de errores inconsistente entre paquetes**: `engine` usa un patrón Result (`dispatch` nunca lanza), `export-engine` lanza una clase `ExportError` propia, `document-schema` deja pasar excepciones de Zod directamente, y las tres librerías de catálogo (Asset/Template/Project) son funciones async que rechazan/lanzan sin un patrón Result. Ningún paquete está "equivocado" en aislamiento, pero no existe una convención única de la plataforma (ver Auditoría de APIs, §3).

## 10. Riesgos (consolidado, ordenado por impacto)

1. **Pérdida silenciosa de trabajo no guardado** al salir del editor (Workspace/Ctrl+O) — el hallazgo de mayor impacto de toda la plataforma (UX Audit 0001).
2. **Ninguna afirmación de reutilización multi-módulo está probada** — toda la arquitectura de "pilares reutilizables" depende de un segundo módulo real que todavía no existe.
3. **Ninguna afirmación de escalabilidad está medida** — ni a nivel de documento grande, ni a nivel de catálogo de proyectos/templates grande.
4. **Documentación de arquitectura desactualizada** hasta esta auditoría (ya corregido) — revela que el proceso no tenía un mecanismo de barrido periódico antes de esta práctica.
5. **Filosofía de manejo de errores inconsistente** entre paquetes — no bloquea nada hoy, pero dificulta que un consumidor futuro (un segundo módulo, o un plugin de terceros) prediga el comportamiento sin leer cada paquete por separado.
6. **Gaps de accesibilidad recurrentes** (navegación por teclado en grillas de tarjetas) — el mismo patrón, sin resolver, en dos lugares (Templates, Workspace).
7. **Autosave ausente en toda la plataforma** — alimenta directamente el riesgo #1.

## 11. Fortalezas (consolidado)

1. **Disciplina arquitectónica verificada, no declarada** — `madge --circular` en cada build, cero excepciones en 8 paquetes.
2. **ADRs de calidad excepcional y consistente** — 14 documentos, mismo formato riguroso, sin atajos.
3. **863 tests automatizados, cobertura ≥90% en todos los paquetes**, con contract tests genuinos y verificación en navegador real por épica — no solo tests unitarios con stubs.
4. **Autocorrección real de arquitectura**: `storage-kit` existe porque el proyecto notó su propia duplicación al tercer caso real y actuó, sin esperar una épica dedicada a "refactorizar".
5. **Cero atajos de calidad**: sin `--no-verify`, sin tests deshabilitados, sin `any`, sin código muerto acumulado.
6. **Reglas de proceso que se fortalecen con el tiempo**: UX First → evaluación dual Arquitectura+UX → práctica de UX Audits independientes — cada épica eleva la vara de la siguiente, no la mantiene plana.
7. **Cada épica se cierra con evidencia real** (muestras PNG/SVG reales, video/capturas de Playwright, no solo "los tests pasan").

---

## 12. Auditoría de Paquetes

**¿Debería fusionarse alguno?** No se detectó ningún candidato claro. `storage-kit` es el paquete más chico (79 líneas) pero sirve a 3 consumidores reales con cero lógica de dominio filtrada — el tamaño pequeño es la señal de que hizo bien su trabajo (una sola responsabilidad), no de que sobra.

**¿Debería dividirse alguno?** No se detectó ningún candidato. `engine` (1897 líneas) es el paquete más grande del núcleo, pero está internamente organizado en submódulos cohesivos (`commands/`, `geometry/`, `errors/`, `events/`, `cloning/`, `tree/`) — todo genuinamente "lógica del Engine", sin mezclar responsabilidades ajenas. `apps/sticker-builder/src` (3417 líneas de producción + 4553 de tests) es, por lejos, la unidad más grande de toda la plataforma, pero su organización interna ya es modular (un archivo por pantalla/diálogo/panel; el archivo más grande, `app.ts`, tiene ~470 líneas y una sola responsabilidad — orquestar el editor).

**¿Existe algún paquete innecesario?** No — los 8 paquetes tienen, cada uno, al menos un consumidor real activo (verificado con el grafo de dependencias de `docs/ARCHITECTURE.md` §3). La disciplina ya existente de "no construir un pilar hasta que haya un consumidor real" impidió que esto ocurriera.

**¿Existe algún paquete demasiado grande?** No de forma crítica. `engine` y `renderer-konva` son los dos más grandes del núcleo; ambos cohesivos, sin indicios de estar cargando responsabilidades que no les corresponden.

**Hallazgo real — tres paquetes con la misma forma, sin unificar más allá de `storage-kit`:** Asset Library, Template Library y Project Library comparten el patrón "descriptor liviano + contenido pesado, memoria + IndexedDB, contract-tested" — ya unificado a nivel de andamiaje IndexedDB (`storage-kit`), pero NO a nivel de la interfaz descriptor+contenido en sí (cada una define su propio `*Store` con su propia forma). Se evaluó — no se implementa — generalizar esto en un `CatalogStore<TDescriptor, TContent>` genérico: **se recomienda NO hacerlo todavía**. Los tres dominios difieren lo suficiente (Asset = solo binario, sin descriptor propio; Template = descriptor con `builtIn`/`tags` sin equivalente en un `Project`; Project = descriptor derivable del propio contenido) que forzar una interfaz genérica probablemente reduciría claridad más de lo que ahorraría código. Revisar si aparece un cuarto store con la misma forma.

**Hallazgo real — bridge de thumbnails no extraído:** la función que conecta Export Engine con Template/Project Library (generar un thumbnail PNG a partir de un `Project`) vive privada en `apps/sticker-builder/src/app.ts`, reutilizada 3 veces dentro de la misma app (sembrado de built-ins, Guardar como plantilla, Guardar en Workspace) pero invisible fuera de ella. Correcto según el diseño de cada librería (ninguna quiere depender de Export Engine) — el candidato de extracción real es un segundo módulo que necesite exactamente lo mismo, momento en el que "moverlo a un lugar compartido" es mecánico. No se actúa ahora, documentado para cuando corresponda.

## 13. Auditoría de APIs

**Nombres inconsistentes detectados:**
1. `TemplateStore.getContent(id)` devuelve `{project, thumbnail}` (envuelto); `ProjectStore.getProject(id)` devuelve el `Project` sin envolver (el thumbnail vive solo en el descriptor). Misma operación conceptual ("traer el contenido pesado"), nombre Y forma de retorno distintos entre dos abstracciones con forma casi idéntica.
2. Verbo distinto en cada capa para "clonar con ids frescos": Engine usa `cloneSceneObjectWithNewIds`/`cloneProjectWithNewIds`; Template Library lo envuelve como `instantiateTemplate`; Project Library lo envuelve como `duplicateProject`. Cada nombre agrega significado de dominio real (no es un error), pero vale la pena que quien lea las tres capas por primera vez sepa que son, en el fondo, la misma operación subyacente.

**Duplicación detectada (intencional, documentada, no un descuido):**
- `segmentsToSvgPathData`/`toPixels` son exportados por `document-schema` (dueño canónico desde Epic 3) Y re-exportados por `renderer-konva` (compatibilidad hacia atrás) — dos puntos de entrada alcanzan la misma función. Documentado en su momento (ADR-0012); se confirma aquí que sigue siendo así.

**Filosofía de errores no unificada** (ver también §9): `engine` = Result pattern; `export-engine` = clase de error propia lanzada; `document-schema` = excepciones de Zod sin envolver; Asset/Template/Project Library = reject/throw simple. Ningún consumidor hoy se ve afectado (cada paquete se usa de forma aislada, con su propio try/catch o chequeo de `.ok`), pero un módulo nuevo que consuma varios pilares a la vez tendría que aprender 4 convenciones distintas.

**Funciones innecesarias:** ninguna detectada en la superficie pública actual. El único caso reciente de una función que se volvió innecesaria (`saveProjectLocally`) ya fue eliminada como parte de Epic 5, no sobrevivió a esta auditoría como deuda.

**Oportunidades de simplificación:**
- Unificar `getContent`/`getProject` bajo un nombre común (ej. ambas `getContent`, o ambas `getProject`/`getTemplate` con la forma de retorno que corresponda a cada una) — cambio de nombre puro, sin tocar comportamiento; candidato natural para una futura limpieza de API (no aplicado ahora, ya que "no romper compatibilidad" es una regla explícita de esta auditoría, y ambos paquetes ya tienen consumidores reales en `apps/sticker-builder`).
- Nombrar de forma consistente los tres "Options" que acompañan a cada store IndexedDB (`IndexedDbAssetStoreOptions`/`IndexedDbTemplateStoreOptions`/`IndexedDbProjectStoreOptions`) — **ya son consistentes**, mencionado aquí como fortaleza confirmada, no como hallazgo.

**Consistencias confirmadas como fortalezas (no solo gaps):**
- Naming de factories de store: `createMemory*Store`/`createIndexedDb*Store` — idéntico en las 3 librerías de catálogo.
- Sufijo `Options` en toda opción de configuración inyectable, sin excepción, en los 8 paquetes.
- Convención `generateId`/`now` inyectables (nunca un default oculto de `crypto.randomUUID()` dentro del Engine) — respetada sin excepción desde Foundation 2.

---

## 14. PLATFORM SCORE

| Criterio | Puntuación | Explicación | Riesgos |
|---|---|---|---|
| **Arquitectura** | 9/10 | Separación de 3 niveles verificada (no solo declarada) en 8 paquetes; cero dependencias circulares; el proyecto se autocorrigió al extraer `storage-kit` en su tercer caso real de duplicación. | El boceto de arquitectura de plugins nunca se implementó ni se revisó con evidencia real. |
| **Reutilización** | 8/10 | Reuso genuino y verificado dentro de la plataforma actual (clonado, storage-kit); todos los pilares diseñados explícitamente agnósticos de Sticker Builder. | Cero prueba con un segundo módulo real — toda la tesis de "un núcleo, múltiples productos" sigue sin validarse en la práctica. |
| **Escalabilidad** | 6/10 | 14 decisiones de rendimiento documentadas con estrategia de mitigación futura clara. | El objetivo declarado ("miles de objetos") nunca se midió; Workspace sin paginación/búsqueda; nada probado a escala de plataforma. |
| **UX** | 6/10 | Disciplina UX First activa y en fortalecimiento continuo (evaluación dual, UX Audits); hallazgos ya identificados con acciones concretas. | Riesgo real de pérdida de trabajo no guardado; solo un bloque (Workspace) auditado formalmente; gaps de accesibilidad recurrentes. |
| **Performance** | 7/10 | Decisiones de rendimiento razonadas y documentadas de forma consistente; patrón preview/commit ya evita el peor costo (dispatch por frame). | Cero benchmarks automatizados; todo el razonamiento es cualitativo, no medido. |
| **Testing** | 9/10 | 863 tests, contract tests reales, verificación en navegador real por épica, bugs reales encontrados solo por esa disciplina. | Sin tests de accesibilidad ni de regresión de performance; snapshot visual limitado a un solo flujo. |
| **Cobertura** | 9/10 | Los 8 paquetes + la app superan el umbral permanente de 90/90/90/85; varios en 100% real. | Los gaps restantes están documentados como intencionales (ramas defensivas), no ocultos — riesgo bajo. |
| **Documentación** | 7/10 | ADRs de calidad excepcional y consistente (14, mismo formato riguroso); estándar de README cumplido en todos los paquetes. | 3 documentos centrales estaban desactualizados/incorrectos hasta esta auditoría (ya corregidos) — reveló ausencia de un proceso de barrido periódico. |
| **Mantenibilidad** | 8/10 | Cero `any`, cero código muerto, patrones consistentes de inyección (`now`/`generateId`), disciplina real de "no abstraer antes de tiempo". | Filosofía de manejo de errores no unificada entre paquetes — fricción real para un consumidor que use varios pilares a la vez. |
| **Preparación para múltiples Builders** | 7/10 | Document Schema 100% agnóstico de módulo; Templates/Project Library/Asset Library ya parametrizados por `moduleId` y probados con ese filtro. | Cada pantalla (Workspace, galería de Templates) se construyó ad-hoc en CSS/DOM directo en la app — un segundo módulo reimplementaría UI similar hasta que exista un Design System real (ya reconocido en Technical Debt). |

**Promedio simple:** 7.6/10 — una plataforma con fundamentos técnicos sólidos y verificados, cuyo mayor riesgo no es la calidad de lo construido sino la falta de validación en dos dimensiones que solo el tiempo y un segundo caso de uso real pueden probar: **reutilización multi-módulo** y **escalabilidad a documentos/catálogos grandes**.
