# GLOBAL QUOTE

**Quotation & Commercial Control System** para **GLOBAL SUPPLIER MTY S.A. DE C.V.**

Sistema empresarial de cotizaciones multilínea de negocio (TSS, TLL, GFB, TFS, JUN, GTX, GSM) que controla productos, costos, precios, márgenes, clientes, vendedores, autorizaciones, seguimiento comercial, conversión a pedido, historial, evidencias e indicadores — no es un generador de PDFs.

**Estado actual: Módulos 1 (Cimientos), 3 (Catálogo, alcance básico), 4 (Clientes y contactos, alcance básico), 5 (Motor de folios) y 6 (Cotizaciones, núcleo) construidos.** `docs/ARCHITECTURE.md` es el entregable pre-código (resumen ejecutivo, arquitecturas, roles y permisos, modelo de datos, flujo de cotización, folios, márgenes/autorización, mapa de pantallas y plan de MVP). El código vive en [`app/`](app/README.md): login (Auth.js), RBAC de 7 roles y líneas de negocio, catálogo de productos con costos/márgenes/precios, clientes/contactos con alcance de visibilidad por vendedor, un motor de folios atómico y sin colisiones (probado con 50 emisiones concurrentes), y ahora cotizaciones reales que emiten folio al crearse, resuelven precio automáticamente y se marcan para autorización cuando el margen cae por debajo del mínimo o el descuento excede el límite del vendedor — todo para la línea GFB, probado de extremo a extremo. Falta Módulo 2 (config por línea: bancos, términos y condiciones, plantillas), el workflow de autorización propiamente dicho, versionado y PDF, según `docs/ARCHITECTURE.md §10`.

Documento maestro: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Código: [`app/`](app/README.md).

## Relación con GAIOS y con `platform/`

- `platform/` (en la raíz de este repo) es el scaffold ya construido de **GAIOS Platform** — CRM, agentes de IA, oportunidades — para la misma empresa, Global Supplier MTY.
- **GLOBAL QUOTE es un sistema hermano, no un módulo dentro de `platform/`**: tiene su propio dominio (cotizaciones, folios, márgenes, catálogo con costos protegidos) y sus propias reglas de autorización, que son más estrictas que las de un CRM genérico.
- Ambos comparten empresa, líneas de negocio, usuarios/roles y clientes. La integración prevista (Fase 3, ver `docs/ARCHITECTURE.md#10`) es vía API: GLOBAL QUOTE expone cotizaciones/pedidos: GAIOS los consume para IA comercial (agentes, tableros, automatizaciones) sin duplicar la fuente de verdad de precios y costos.
- Cuando arranque la Fase 1 de código, este sistema vivirá en su propio directorio de aplicación (p. ej. `global-quote/app/`) con su propia base de datos — **no** reutiliza las migraciones de `platform/supabase/migrations/`, porque el modelo de datos de cotizaciones (folios, versiones, márgenes, autorizaciones) no existe ahí.

## Próximo paso

Con el núcleo de cotizaciones funcionando, lo siguiente según `docs/ARCHITECTURE.md §10` es Módulo 7 (autorizaciones con registro propio y pantalla de aprobar/rechazar — hoy solo hay una bandera) o Módulo 8 (versionado tras el envío).
