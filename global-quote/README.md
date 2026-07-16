# GLOBAL QUOTE

**Quotation & Commercial Control System** para **GLOBAL SUPPLIER MTY S.A. DE C.V.**

Sistema empresarial de cotizaciones multilínea de negocio (TSS, TLL, GFB, TFS, JUN, GTX, GSM) que controla productos, costos, precios, márgenes, clientes, vendedores, autorizaciones, seguimiento comercial, conversión a pedido, historial, evidencias e indicadores — no es un generador de PDFs.

**Estado actual: de la Fase 1 completa (Módulos 1–10) solo falta el Módulo 2 (líneas de negocio y configuración). Construidos: 1 (Cimientos), 3 (Catálogo, alcance básico), 4 (Clientes y contactos, alcance básico), 5 (Motor de folios), 6 (Cotizaciones, núcleo), 7 (Autorizaciones), 9 (PDF, construido antes del 8 a petición explícita), 8 (Versionado) y 10 (Auditoría).** `docs/ARCHITECTURE.md` es el entregable pre-código (resumen ejecutivo, arquitecturas, roles y permisos, modelo de datos, flujo de cotización, folios, márgenes/autorización, mapa de pantallas y plan de MVP). El código vive en [`app/`](app/README.md): login (Auth.js), RBAC de 7 roles y líneas de negocio, catálogo de productos con costos/márgenes/precios, clientes/contactos con alcance de visibilidad por vendedor, un motor de folios atómico y sin colisiones (probado con 50 emisiones concurrentes), cotizaciones reales que emiten folio al crearse y resuelven precio automáticamente, un workflow de autorización completo (motor de reglas de margen/monto/vigencia/descuento con una matriz de autoridad por rol, bandeja de excepciones, aprobar/rechazar con nota, rechazo que regresa a borrador), generación real de PDF (plantilla de marca por línea, encabezados y pie repetidos por página con QR, bloqueada mientras la cotización está en borrador o pendiente de autorización), versionado real (editar una cotización enviada congela un snapshot inmutable y sube el folio a `-V2`, `-V3`...), y ahora un registro de auditoría append-only de verdad: reforzado con triggers de Postgres que rechazan `UPDATE`/`DELETE` incluso desde el rol dueño de la tabla (un `REVOKE` no habría funcionado — el dueño de una tabla siempre tiene privilegios plenos en Postgres, sin importar el `GRANT`), con cambios a crédito/descuento/vendedor asignado y a costo/margen de producto ya quedando registrados y consultables en `/admin/audit` — todo para la línea GFB, probado de extremo a extremo. Falta el Módulo 2 (bancos, términos y condiciones, impuestos por línea), según `docs/ARCHITECTURE.md §10`.

Documento maestro: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Código: [`app/`](app/README.md).

## Relación con GAIOS y con `platform/`

- `platform/` (en la raíz de este repo) es el scaffold ya construido de **GAIOS Platform** — CRM, agentes de IA, oportunidades — para la misma empresa, Global Supplier MTY.
- **GLOBAL QUOTE es un sistema hermano, no un módulo dentro de `platform/`**: tiene su propio dominio (cotizaciones, folios, márgenes, catálogo con costos protegidos) y sus propias reglas de autorización, que son más estrictas que las de un CRM genérico.
- Ambos comparten empresa, líneas de negocio, usuarios/roles y clientes. La integración prevista (Fase 3, ver `docs/ARCHITECTURE.md#10`) es vía API: GLOBAL QUOTE expone cotizaciones/pedidos: GAIOS los consume para IA comercial (agentes, tableros, automatizaciones) sin duplicar la fuente de verdad de precios y costos.
- Cuando arranque la Fase 1 de código, este sistema vivirá en su propio directorio de aplicación (p. ej. `global-quote/app/`) con su propia base de datos — **no** reutiliza las migraciones de `platform/supabase/migrations/`, porque el modelo de datos de cotizaciones (folios, versiones, márgenes, autorizaciones) no existe ahí.

## Próximo paso

Con Auditoría funcionando de extremo a extremo, el único pendiente de la Fase 1 según `docs/ARCHITECTURE.md §10` es el Módulo 2 (líneas de negocio y configuración: bancos, términos y condiciones, impuestos). Después sigue la Fase 2 (Módulos 11+: seguimiento, pedidos, dashboards).
