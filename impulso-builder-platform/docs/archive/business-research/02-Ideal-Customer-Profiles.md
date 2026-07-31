> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Investigación de mercado / estrategia comercial escrita para Sticker Builder como producto independiente vendido por separado — premisa contradicha por `../product/THOREN_PRODUCT_DIRECTION.md` (escenario D, aprobado). Se conserva íntegro como insumo de referencia (la investigación de mercado en sí sigue siendo informativa), nunca como fuente vigente de estrategia comercial de THÖREN — si THÖREN necesita una estrategia comercial propia en el futuro, se redacta de cero. Ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# 02 — Ideal Customer Profiles

> Cinco perfiles iniciales de usuario para Sticker Builder (el primer módulo de Impulso Platform). Estos perfiles se basan en patrones de comportamiento ampliamente documentados en el ecosistema de creadores/vendedores de productos físicos pequeños (Etsy, comunidades de maestros, planner communities, estudios creativos pequeños, agencias) — no en investigación de usuario propia de THÖREN, que todavía no existe. Cada sección **"Qué lo convencería de cambiar"** es, por naturaleza, una hipótesis de producto — se marca explícitamente **[HIPÓTESIS]** y debe validarse con entrevistas reales antes de diseñar features específicas alrededor de ella.

---

## Etsy Sticker Seller

Vende stickers (y productos relacionados: pegatinas, calcomanías, sticker sheets) como su negocio principal o secundario en Etsy u otro marketplace de e-commerce.

**Objetivos:**
- Sacar diseños nuevos rápido para mantener la tienda activa y responder a tendencias/temporadas (ej. stickers de temporada, fandom, nichos específicos).
- Que el archivo final sea imprimible sin sorpresas — un error de sangrado o de línea de corte significa un lote de impresión desperdiciado, dinero real perdido.
- Diferenciarse visualmente en un mercado saturado de productos similares.

**Frustraciones:**
- Herramientas genéricas (Canva) no garantizan que lo que se ve en pantalla sea lo que se imprime — descubrir un problema de sangrado/corte después de mandar a imprimir es costoso.
- Aprender Illustrator/Photoshop solo para poder controlar líneas de corte es una inversión de tiempo que compite directamente con el tiempo de vender.
- Gestionar docenas de diseños/variantes de producto sin una forma organizada de guardar/reabrir proyectos.

**Qué compra hoy:** una combinación de Canva (para el diseño visual) + tutoriales/plantillas de su proveedor de impresión (StickerGiant, Jukebox, MakeStickers, etc. — ver `03-Competitive-Landscape.md`) para simular manualmente el die-line, o Kittl si ya conoce herramientas más especializadas en merch/POD.

**Cómo descubre productos:** comunidades de vendedores de Etsy (foros, grupos de Facebook, subreddits de "Etsy sellers"), contenido de creadores en TikTok/YouTube mostrando su flujo de trabajo ("cómo hago mis stickers"), búsquedas directas tipo "cómo crear línea de corte para stickers".

**Qué lo convencería de cambiar [HIPÓTESIS]:** ver, en una demo o video corto, que el archivo exportado de THÖREN no requiere ningún paso manual de "simular" la línea de corte — que es un dato real desde el diseño, no una guía visual — y que eso reduce directamente el riesgo de un lote de impresión desperdiciado.

## Teacher Creator

Maestro/a o educador/a que crea y vende recursos educativos (incluyendo stickers de recompensa, calcomanías temáticas de aula) en plataformas como Teachers Pay Teachers, además de su trabajo docente.

**Objetivos:**
- Crear recursos visualmente atractivos para el aula y/o para vender, sin ser diseñador de formación.
- Reutilizar el mismo estilo/marca visual entre distintos productos (stickers, hojas de trabajo, tarjetas) — de ahí la relevancia futura de Worksheet Builder/Flashcard Builder como módulos hermanos (ver `../product/03-Architecture-Map.md`).
- Tiempo limitado — crea fuera de su horario de enseñanza, necesita eficiencia real.

**Frustraciones:**
- Sin tiempo para aprender herramientas de diseño complejas; cualquier curva de aprendizaje pronunciada es un costo de oportunidad frente a preparar clases.
- Necesita consistencia visual entre múltiples tipos de recursos, y hoy eso implica rehacer el mismo estilo en herramientas separadas (o dentro de la misma herramienta genérica, sin ayuda especializada por tipo de producto).
- Presupuesto personal, no de negocio — sensible al precio de las suscripciones.

**Qué compra hoy:** Canva (por su enorme adopción entre educadores y plantillas educativas específicas) y, para assets/fuentes/gráficos, Creative Fabrica u otras bibliotecas de recursos para crafters/educadores.

**Cómo descubre productos:** comunidades de Teachers Pay Teachers, grupos de Facebook de "TPT sellers", Pinterest (fuerte en el nicho educativo/planner), recomendaciones boca a boca entre colegas.

**Qué lo convencería de cambiar [HIPÓTESIS]:** que la misma herramienta (o familia de módulos, con el tiempo) le permita crear stickers Y otros recursos educativos con la misma interfaz aprendida una sola vez — el valor de "un núcleo, múltiples productos" (ver `../product/01-Product-Vision.md`, "Propuesta de valor") aplicado directamente a su necesidad de consistencia entre tipos de recurso.

## Planner Designer

Crea y vende planners, stickers para planners (functional stickers, decorative stickers) y contenido relacionado — un nicho históricamente muy activo en Etsy y comunidades propias ("planner community").

**Objetivos:**
- Producir sticker sheets con múltiples elementos pequeños y repetidos (íconos, washi, checklists) de forma eficiente, no un sticker a la vez.
- Mantener una identidad visual de marca reconocible entre temporadas/colecciones.
- Eventualmente, producir tanto el planner en sí (impreso o digital) como los stickers que lo acompañan — de ahí la relevancia directa de un futuro Planner Builder como módulo hermano.

**Frustraciones:**
- Organizar sticker sheets con docenas de elementos pequeños en una herramienta genérica es tedioso — alineación, tamaño consistente, disposición eficiente para impresión no son el foco de un editor de propósito general.
- El nicho tiene expectativas de calidad visual muy específicas (estética "planner", paletas de color, estilo de ícono) — una herramienta que no entiende nada de esas convenciones exige mucho trabajo manual.
- Igual que el vendedor de Etsy: cualquier error de producción (corte, sangrado) en un sticker sheet con muchos elementos pequeños es más costoso de corregir que en un sticker único.

**Qué compra hoy:** Canva (adopción muy fuerte en la comunidad de planners, con plantillas específicas del nicho), Kittl (para quienes ya buscan algo más especializado en merch/stickers), Creative Fabrica (para fuentes/gráficos/íconos del estilo "planner").

**Cómo descubre productos:** Pinterest (canal dominante en este nicho específicamente), Instagram, comunidades dedicadas de planner addicts/planner sellers, YouTube ("planner with me" y tutoriales de creación de stickers).

**Qué lo convencería de cambiar [HIPÓTESIS]:** herramientas específicas para trabajar con sticker sheets (múltiples elementos pequeños, repetición, disposición eficiente para impresión) que una herramienta genérica no prioriza — validar si esto amerita una funcionalidad dedicada dentro de Sticker Builder o si corresponde directamente al futuro Planner Builder.

## Small Creative Business

Un pequeño negocio o estudio (2-10 personas, o un solo fundador con ayuda ocasional) que produce productos físicos de papelería/regalo (stickers, tarjetas, etiquetas, empaques) como parte de un catálogo más amplio, no un vendedor individual de un solo tipo de producto.

**Objetivos:**
- Producir consistentemente varios tipos de producto bajo una misma marca, con calidad de producción confiable (no pueden permitirse errores de impresión a escala de negocio).
- Escalar la producción de diseño sin escalar proporcionalmente el equipo — necesitan eficiencia de herramienta, no solo de talento.
- Mantener control de marca (colores, tipografía, estilo) consistente entre todo lo que producen.

**Frustraciones:**
- Herramientas separadas para cada tipo de producto (una para stickers, otra para packaging, otra para tarjetas) fragmentan el flujo de trabajo y el archivo de marca.
- Necesitan colaborar internamente (aunque sea de forma simple) — algo que ninguna herramienta 100% individual/local resuelve todavía (ver `../product/05-Technical-Debt.md`, "Colaboración en tiempo real").
- Presión de tiempo de entrega real hacia clientes/canales de venta — un error de producción no es solo una pérdida de material, es un retraso de entrega.

**Qué compra hoy:** una combinación de Canva Business/Teams (para el equipo) y, para trabajo más exigente, Illustrator — dependiendo del nivel de sofisticación del equipo de diseño interno.

**Cómo descubre productos:** recomendaciones de otros negocios del rubro, comunidades B2B de papelería/regalo, búsquedas orientadas a "herramienta de diseño para equipos pequeños", ferias/eventos del sector.

**Qué lo convencería de cambiar [HIPÓTESIS]:** que THÖREN ofrezca, con el tiempo, varios módulos (Sticker Builder + futuros Bundle Builder/Journal Builder) bajo una misma cuenta y coherencia de marca — hoy esto no es posible (sin cuentas, sin colaboración, ver `../product/05-Technical-Debt.md`), así que este segmento probablemente NO es viable para THÖREN en su etapa Alpha/Beta actual, y su conversión depende de capacidades que hoy son deuda técnica deliberada, no features en desarrollo activo.

## Agency

Agencia de diseño/marketing pequeña o mediana que produce piezas de producto físico (stickers promocionales, merchandising de marca) como un servicio más dentro de su oferta a clientes, no como su negocio principal.

**Objetivos:**
- Entregar trabajo de calidad profesional a clientes con marca propia (no genérico) en plazos ajustados.
- Minimizar el tiempo dedicado a tareas de producción técnica (setup de sangrado/corte) que no son el valor diferencial que venden a sus clientes (la idea creativa sí lo es; el ajuste técnico de imprenta no).
- Facturar el trabajo de forma rentable — el tiempo de un diseñador de agencia es más caro que el de un vendedor individual de Etsy.

**Frustraciones:**
- Herramientas genéricas exigen que un diseñador con experiencia "pierda" tiempo en configuración técnica de impresión que una herramienta especializada podría resolver de forma más directa.
- Necesitan handoff limpio hacia el proveedor de impresión del cliente (que varía por proyecto) — cualquier atadura a un servicio de impresión propio de la herramienta (como Kittl Print) es una fricción, no una conveniencia, cuando el cliente ya tiene su propio proveedor.
- Volumen de proyectos simultáneos — necesitan poder retomar/organizar múltiples proyectos de clientes distintos sin perder trabajo.

**Qué compra hoy:** Illustrator (el estándar de facto en agencias con diseñadores formados) para trabajo que exige control total; Canva Business para trabajo más rápido/menos exigente cuando el cliente no requiere ese nivel de control.

**Cómo descubre productos:** recomendaciones dentro de la industria de diseño/marketing, comunidades profesionales (LinkedIn, foros de diseño), casos de uso mostrados por herramientas en conferencias/eventos del sector.

**Qué lo convencería de cambiar [HIPÓTESIS]:** que THÖREN reduzca el tiempo de setup técnico de producción sin sacrificar el control que un diseñador de agencia espera tener — y que el archivo exportado sea genuinamente agnóstico de proveedor de impresión (a diferencia de Kittl Print), condición no negociable para un cliente que ya tiene su propia imprenta de confianza. Este segmento probablemente requiere primero que exista colaboración/cuentas de equipo (ver `../product/05-Technical-Debt.md`) antes de ser viable — no es un ICP de la etapa Alpha/Beta, sino de una etapa posterior si se valida la demanda.

---

## Cómo se usa este documento

Estos cinco perfiles no tienen el mismo peso hoy: **Etsy Sticker Seller**, **Teacher Creator** y **Planner Designer** son los más alineados con lo que Sticker Builder puede servir en su etapa Alpha/Beta actual (uso individual, sin cuentas, sin colaboración — ver `../product/04-Roadmap.md`). **Small Creative Business** y **Agency** dependen de capacidades hoy deliberadamente pospuestas (cuentas, colaboración, ver `../product/05-Technical-Debt.md`) — son perfiles válidos para la visión de largo plazo, no objetivos de adquisición de las etapas actuales. Cualquier decisión de producto que priorice a un perfil sobre otro debe reconocer explícitamente esta diferencia de viabilidad actual.
