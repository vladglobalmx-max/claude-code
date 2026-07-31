> **ADR archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba la capa comercial de Sticker Builder como producto independiente — el problema que resuelve ya no existe en esa forma tras `../../product/THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de la decisión de arquitectura tomada en su momento. Ver [`../README.md`](../README.md) para el índice vigente de ADRs.

# ADR-0029 — Distribution Strategy: canales, Gumroad y Bookfluence (Fase 4.1)

## Problema
¿Cómo llega Impulso a un comprador real? ¿Qué papel juega cada canal (Gumroad, Bookfluence, venta directa) y cómo se mantiene el dominio creativo desacoplado de cualquiera de ellos?

## Contexto
- Auditoría (Fase 4.1 §1): la app hoy es una SPA estática sin service worker/PWA/manifest, sin CI/CD, sin hosting configurado. Es un punto de partida limpio — ninguna decisión de distribución previa ata las manos de esta fase.
- Objetivo de negocio explícito: vender mini apps digitales mediante Bookfluence, Gumroad, u otros marketplaces externos — **no** diseñar la arquitectura exclusivamente para SaaS.
- ADR-0026 ya fija que ningún paquete de capas 1-2 (dominio creativo) puede depender de un adaptador de comercio — este ADR decide qué hay del lado de "capa 7" (Commerce Adapters) sin construirlo todavía.

## Alternativas evaluadas — canales (sección 5)

| Canal | Seguridad | Compra | Updates | Soporte | Costo | Offline | Complejidad operativa |
|---|---|---|---|---|---|---|---|
| Web hospedada (SPA en un dominio propio) | Depende 100% de infra propia (inexistente hoy) | Requiere checkout propio | Automáticas (siempre la última versión) | Requiere infra propia | Hosting continuo | No aplica (siempre online) | Alta para V1 (nada de esto existe) |
| PWA instalable | Igual que arriba + necesita manifest/SW (ninguno existe hoy) | Igual | Requiere estrategia de cache-busting | Igual | Similar | Sí, una vez instalada | Alta — trabajo nuevo no trivial |
| Paquete descargable offline (zip/build estático) | Sin backend que atacar, pero sin control post-entrega | Depende de dónde se compre | Manual (el usuario re-descarga) | Vía email/canal de venta | Casi cero (solo hosting del archivo) | Total | Baja |
| App desktop (Electron/Tauri) futura | Superficie nueva a asegurar (firma de código, updates) | Requiere infra de distribución de instaladores | Requiere updater propio | Igual que desktop apps de referencia | Media-alta | Total | Alta — fuera de alcance de 4.1 |
| Acceso vía enlace con licencia | Tan seguro como el enlace en sí (sin backend, no hay más que proteger) | Depende del canal que lo entregue | Requiere reemitir el enlace | Vía canal de venta | Bajo | Sí si la app ya cachea localmente | Baja-media |
| **Gumroad** | Gumroad procesa el pago (PCI fuera de Impulso); Impulso nunca toca datos de tarjeta | Checkout ya construido, confianza de marca externa, cero fricción de integración | Gumroad permite reemplazar el archivo del producto; notifica compradores | Gumroad tiene su propio flujo de reembolso/soporte de pago | Comisión por venta (variable, externa) | Total una vez descargado | **Baja** — cero backend propio requerido |
| **Bookfluence** | Depende de su propia infraestructura (fuera del control directo de Impulso) | Puede o no tener checkout propio (a confirmar con su equipo) | Depende de su modelo (catálogo/CMS) | Puede centralizar soporte/cuentas a futuro | Desconocido (depende del acuerdo) | Depende de cómo sirva el contenido | Media — depende de integración |
| Otros marketplaces que entregan archivos (Etsy, Hotmart) | Similar a Gumroad, cada uno con su propio modelo de pago | Checkout ya construido | Varía por marketplace | Varía | Comisión variable | Total | Baja, pero fragmenta el proceso de release si se usan varios a la vez |

**No se afirma que un archivo HTML/JS descargable pueda protegerse completamente contra copia** (restricción explícita de la sección 5) — todas las filas de la tabla que involucran una entrega de archivo comparten esa limitación por igual; se documenta como riesgo aceptado de negocio, no de seguridad, en `LICENSING_THREAT_MODEL.md`.

## Decisión tomada

### Rol de cada canal
- **Gumroad = el canal de venta/checkout/entrega inicial.** Aloja el listado del producto, procesa el pago, entrega el acceso (enlace/descarga), y — si Fase 4.4 lo justifica — puede emitir/verificar claves de licencia sin que Impulso opere su propio backend de pagos. Es el `GumroadAdapter` de capa 7 (ADR-0026), consumido detrás de una interfaz `CommerceAdapter` genérica para que un segundo proveedor (Etsy, Hotmart, un futuro checkout propio) se agregue sin tocar capas 1-6.
- **Bookfluence = storefront, marketing y (a futuro) centro de cuentas — nunca el motor interno de los Builders.** En V1 (4.1-4.3), su papel es exclusivamente de landing/catálogo/contenido educativo que enlaza hacia el checkout de Gumroad — no procesa pagos, no aloja lógica de Impulso. En fases posteriores (4.5+, Identity), Bookfluence es candidato natural a convertirse en el "centro de cuentas/descargas" si V1 demuestra que hace falta cuenta — pero eso es una decisión diferida, no tomada aquí.
- **Separación dura**: `marketing site` (Bookfluence) ≠ `commerce` (Gumroad hoy, posible motor propio a futuro) ≠ `identity` (inexistente en V1, candidato futuro) ≠ `application runtime` (Impulso mismo, 100% independiente de los tres anteriores salvo por leer un `ProductManifest`/`Entitlement`).

### Interfaz `CommerceAdapter` (diseño conceptual, sin implementación productiva en 4.1)
```ts
interface CommerceAdapter {
  channelId: ChannelId;
  describePurchase(reference: string): Promise<PurchaseDescriptor>;
  // Ningún tipo de Gumroad (webhooks, payload específico) se filtra fuera de la implementación concreta.
}
```
`GumroadAdapter implements CommerceAdapter` traduce el vocabulario específico de Gumroad (license key, product permalink, sale id) hacia el vocabulario neutral de `EntitlementService` (capa 5) — ningún Builder ni ningún paquete de capa 1-4 conoce el nombre "Gumroad". No se implementan webhooks en esta fase (el entorno actual no tiene backend que los reciba) — se documenta qué necesitaría un backend futuro: un endpoint HTTPS público, verificación de firma del webhook de Gumroad, idempotencia por `sale_id`, y persistencia de la `Entitlement` resultante.

## Consecuencias
- El objetivo de negocio inmediato (vender mini apps vía Bookfluence/Gumroad) queda cubierto sin construir NINGÚN backend nuevo — la distribución V1 es: build estático de Impulso + listado en Gumroad enlazado desde Bookfluence.
- Ninguna decisión de esta fase le cierra la puerta a SaaS futuro (Fase 4 sección 4.C) — la interfaz `CommerceAdapter`/`EntitlementService` es agnóstica de si el "producto" es un pago único descargable o una suscripción con cuenta.

## Riesgos
- **Bookfluence depende de infraestructura fuera del control directo de este proyecto** — su rol exacto de integración (¿link simple? ¿SSO futuro? ¿catálogo sincronizado?) requiere una conversación con quien opera Bookfluence, fuera del alcance técnico de esta fase; se documenta como pregunta abierta, no como decisión tomada por default.
- **Usar múltiples marketplaces simultáneamente (Gumroad + Etsy + Hotmart) fragmenta el proceso de release** (cada uno con su propio ciclo de actualización de archivo) — aceptado como complejidad futura, no resuelto en 4.1; la recomendación de V1 (ver `V1_COMMERCIAL_RECOMMENDATION.md`) es un solo canal inicial (Gumroad) precisamente para evitar esto hasta tener evidencia de demanda en más de un canal.

## Compatibilidad futura
- Fase 4.4 construye `GumroadAdapter` real (sin webhooks todavía, posiblemente solo verificación manual/periódica).
- Fase 4.5 (Account & Recovery) es donde se decide si Bookfluence se convierte en el centro de cuentas, o si se construye uno propio.
- Fase 4.6 (Release & Update Delivery) decide el mecanismo real de "reemplazar el archivo en Gumroad" como parte del pipeline de release.
