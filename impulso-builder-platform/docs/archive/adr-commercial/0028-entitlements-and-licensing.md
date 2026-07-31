> **ADR archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba la capa comercial de Sticker Builder como producto independiente — el problema que resuelve ya no existe en esa forma tras `../../product/THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de la decisión de arquitectura tomada en su momento. Ver [`../README.md`](../README.md) para el índice vigente de ADRs.

# ADR-0028 — Entitlements & Licensing V1 (Fase 4.1)

## Problema
¿Cómo se representa "este usuario/dispositivo puede usar esta capacidad", y qué mecanismo técnico concede/demuestra ese derecho — sin backend, sin auth productiva, sin DRM agresivo, y sin bloquear legítimamente a un comprador real?

## Contexto
- Auditoría (Fase 4.1 §1): la app es 100% cliente, sin red requerida para funcionar, sin secretos de ningún tipo en el bundle hoy (cero API keys, cero env vars). Cualquier mecanismo de licensing debe preservar esto — la sección 7 lo exige explícitamente ("no confiar en claves que puedan generarse únicamente mediante lógica visible en JavaScript", "no almacenar secretos privados dentro del frontend").
- El canal inicial recomendado es venta directa vía Gumroad hacia un mini-app descargable/con acceso por enlace (ver ADR-0029 y `V1_COMMERCIAL_RECOMMENDATION.md`) — no una plataforma SaaS con cuentas. Esto simplifica mucho el V1: no hace falta demostrar identidad de usuario, solo controlar la distribución de la propia entrega.
- `docs/platform/STATE_001.md` ya señala que ninguna filosofía de manejo de errores es consistente entre paquetes — un sistema de Entitlements que falle (red caída, licencia corrupta) debe fallar de forma segura y explícita, no silenciosamente, y nunca destruir proyectos existentes del usuario.

## Alternativas evaluadas (Licensing V1 — sección 7)
1. *Sin licencia técnica, solo entrega controlada* (Gumroad gatea quién recibe el enlace/descarga; la app nunca valida nada por sí misma) — más simple posible, cero superficie de ataque nueva, cero fricción, pero cero capacidad de revocar/verificar después de la entrega.
2. *Clave de licencia con activación online obligatoria* — descartada para V1: requiere backend siempre disponible (contradice "no elimines acceso abruptamente si el servicio está caído", sección 15) y contradice el objetivo inmediato (vender mini apps sin backend).
3. *Token firmado verificado localmente* (ej. JWT firmado con clave privada del vendedor, verificado con clave pública embebida en el cliente) — técnicamente sólido (no requiere red), pero exige generar/firmar tokens en algún lugar de confianza (no puede ser el propio frontend) — es decir, sigue exigiendo un mínimo de infraestructura de emisión, aunque la verificación sea offline.
4. *Combinación progresiva: (1) ahora, evolucionando hacia (3) sin retrabajo* — **elegida**. Ver decisión.

## Decisión tomada

### V1 (Fase 4.1-4.3): Entrega controlada, sin validación técnica en el cliente
El "licensing" de V1 **no es código dentro de Impulso** — es el propio Gumroad conteniendo el acceso: el comprador recibe un enlace de descarga/acceso único gestionado por Gumroad. La app **no** valida ninguna clave, no llama a ningún servicio de verificación, no bloquea ninguna funcionalidad basada en licencia. Esto corresponde a `licensingMode: "delivery-only"` en el `ProductManifest` (ADR-0027).

Justificación explícita de por qué esto NO es una carencia sino la elección correcta para V1: la sección 7 prohíbe DRM agresivo y exige "modo de recuperación" y "tolerancia a fallos del servicio" — la única forma de cumplir ambos con cero backend es no depender de ninguna validación en absoluto. Un comprador legítimo nunca puede quedar bloqueado por esto, porque no hay nada que pueda fallar de ese lado.

### Modelo de `Entitlement` (diseño, para Fase 4.3+)
Definido ya en `@impulso/commercial-schema` como contrato de datos (sin lógica de evaluación todavía — esa es capa 5, Fase 4.3):

```ts
interface Entitlement {
  entitlementId: string;
  subjectId: string;          // deviceId o userId futuro — nunca un email en claro
  productId: string;
  featureIds: string[];       // CapabilityId concedidos
  status: EntitlementStatus;  // "active" | "expired" | "revoked" | "suspended" | "pending" | "grace-period"
  source: string;             // ChannelId de origen
  issuedAt: string;            // ISO 8601
  expiresAt?: string;
  versionRange?: string;       // semver range de productVersion cubierto
  devicePolicy?: "single-device" | "unlimited" | "n-devices";
  metadata: Record<string, unknown>;
}
```

Admite, sin cambios de forma, los 6 casos exigidos por la sección 6 (pago único → `status: "active"`, `expiresAt: undefined`; suscripción futura → `expiresAt` real + renovación cambia `issuedAt`; promocional/interno → `source: "promotional"`/`"internal"`; bundle → un solo `entitlementId` con `featureIds` largo; trial → `expiresAt` corto + `status` transicionando a `"expired"`, nunca borrando datos). En V1 (delivery-only) **no se emite ningún `Entitlement` real** — el tipo existe como contrato, listo para Fase 4.3, pero no hay ningún servicio hoy que lo cree o lo lea.

### Amenazas consideradas (resumen — ver `docs/platform/LICENSING_THREAT_MODEL.md` para el detalle completo)
Con V1 sin validación técnica, la superficie de ataque relevante se reduce a: copia/redistribución del archivo/enlace (aceptada como riesgo de negocio, no de seguridad — ninguna app HTML/JS descargable puede protegerse completamente contra copia, y este ADR **no promete lo contrario**), y nada más — no hay claves que robar, no hay tokens que falsificar, no hay backend que atacar, porque no existen todavía.

## Consecuencias
- Cero código nuevo de licensing en el prototipo de esta fase más allá del tipo `Entitlement` (contrato de datos puro, sin evaluación).
- El primer comprador real de Fase 4.1-4.3 tiene una experiencia de "compra y usa" sin fricción — coherente con "baja fricción, no invasiva" (sección 7).
- Soporte para reembolsos/disputas se maneja 100% del lado de Gumroad (su propio sistema de reembolsos revoca el acceso a la descarga) — Impulso no necesita replicar ese estado en V1.

## Riesgos
- **Sin ninguna validación técnica, un enlace de descarga compartido indebidamente no puede detectarse ni revocarse desde el lado de Impulso** — riesgo de negocio aceptado explícitamente para V1, reevaluar en Fase 4.4 si el volumen de ventas lo justifica (posible introducción de `licensingMode: "license-key"` verificado contra la API pública de licencias de Gumroad, sin backend propio, evaluada en Fase 4.4 — no se promete su viabilidad técnica sin haberla probado).
- **El tipo `Entitlement` se diseña ahora sin un consumidor real** — mismo riesgo aceptado que en ADR-0026 para `commercial-schema`, mismo argumento de justificación (prototipo de validación arquitectónica explícitamente permitido).

## Compatibilidad futura
- Fase 4.3 (Entitlements & Local Activation) es donde este tipo empieza a tener un productor/consumidor real — probablemente generado localmente tras una activación manual (el usuario pega una clave que Gumroad le dio, la app la guarda localmente sin validarla contra nada más que su formato) como paso intermedio antes de cualquier verificación remota.
- Fase 4.4 (Commerce Adapter / Gumroad) es donde se evalúa, con evidencia real, si conectar la API de verificación de licencias de Gumroad vale la pena frente a mantener `delivery-only`.
