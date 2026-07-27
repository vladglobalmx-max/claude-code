# Plan post-lanzamiento — Release Candidate 1.0

Qué hacer después de publicar en Gumroad. El checklist de publicación en sí ya existe en `GUMROAD_LAUNCH_PLAN.md` §4 (revisado y finalizado en RC1, sin cambios necesarios); este documento cubre lo que viene después, pedido explícitamente para RC1.

## Checklist post-publicación

- [ ] Confirmar que la página de producto es visible y el botón de compra funciona (revisar en una ventana de incógnito, sin sesión de vendedor).
- [ ] Hacer una compra de prueba real (o usar el modo de prueba de Gumroad si está disponible) y confirmar que el archivo descargado coincide en checksum con `CHECKSUMS.sha256` del build publicado.
- [ ] Verificar que el email de confirmación de compra de Gumroad llega correctamente y no cae en spam.
- [ ] Revisar que el precio, el copy y las capturas se ven correctamente en escritorio Y en móvil (la mayoría del tráfico inicial de una página nueva suele venir de compartir en redes, a menudo desde el celular).
- [ ] Confirmar que el email de soporte (`soporte@bookfluence.shop`) recibe correctamente y que hay alguien revisándolo.
- [ ] Guardar (fuera del repositorio de código, en un lugar de referencia del negocio) una copia del `.zip` exacto publicado + su checksum, para poder atender cualquier ticket de soporte contra la versión exacta que un comprador tiene.

## Primeras 48-72 horas

- [ ] Revisar cada compra nueva —¿el checkout de Gumroad funcionó sin fricción? (Gumroad expone esto en su panel).
- [ ] Responder cualquier mensaje de soporte con el objetivo de servicio ya declarado (2-3 días hábiles) — en esta ventana inicial, más rápido si es posible, para las primeras impresiones.
- [ ] Revisar si aparece alguna reseña o comentario público (Gumroad permite reseñas) y responder con cortesía a cualquiera, positiva o negativa.

## Plan para recibir y procesar feedback

**Canal único en V1**: el correo de soporte. No hay formulario estructurado ni sistema de tickets separado — es la decisión ya tomada para V1 (sin infraestructura de soporte automatizada, ver `docs/product/05-Technical-Debt.md`).

**Proceso recomendado** (manual, deliberadamente simple):
1. Cada mensaje de soporte se responde individualmente.
2. Si un mensaje revela un problema real del producto (no solo una pregunta de uso), se anota en un registro simple — puede ser tan básico como una nota fechada con: qué reportó el comprador, en qué paso, y si parece ser un bug o una limitación conocida ya documentada.
3. Cada cierto tiempo (sugerido: antes de considerar la siguiente versión), revisar ese registro acumulado en vez de reaccionar a cada mensaje individual como si fuera una emergencia de producto.

## Lista priorizada de mejoras basada en futuros usuarios (framework, vacío por diseño)

Esta lista NO se puede poblar todavía — no existe un solo comprador real. Poblarla con ideas internas violaría exactamente el criterio que motivó Release Candidate 1.0 ("¿esto ayuda a que una persona compre y use THÖREN?" — ideas sin validar no responden esa pregunta). El formato queda listo para cuando exista feedback real:

| # | Reportado por (cuántos compradores) | Qué pidieron/qué les costó | Clasificación (A/B/C/D, mismo criterio YAGNI de Fase 4.2) | Decisión |
|---|---|---|---|---|
| — | — | — | — | — |

**Regla de alta para esta tabla**: un ítem entra aquí solo cuando lo generó feedback real de un comprador real (correo de soporte, reseña pública) — nunca una idea interna, por buena que parezca. Esto es la continuación directa del principio ya adoptado: "no quiero desarrollar nueva infraestructura salvo que aparezca una necesidad demostrada durante la validación con compradores reales."
