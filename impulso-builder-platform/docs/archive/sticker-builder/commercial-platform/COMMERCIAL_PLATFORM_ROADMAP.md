> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del lanzamiento comercial independiente de Sticker Builder v1.0.0 (RC1/Gumroad) — ese lanzamiento no ocurrirá bajo esta forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como evidencia de un proceso de release real, disciplinado y verificado — reutilizable como referencia si THÖREN necesita empaquetarse comercialmente en el futuro, pero no es una fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# Commercial Platform Roadmap — Fases 4.1 a 4.8

> Desglose de Fase 4 — Commercial Platform en sub-fases pequeñas, cada una con autorización explícita propia (misma disciplina que Epic 9 con sus Fases 9.1-9.5). Ninguna fase posterior a 4.1 se inicia sin autorización explícita — ver criterios de cierre de cada una.

## 4.1 — Commercial Platform Architecture & Product Packaging ✅ (esta fase)
- **Objetivo**: diseñar, sin implementar producto, los boundaries/modelos/estrategia de toda la capa comercial.
- **Entregables**: ADR-0026 a 0029, `COMMERCIAL_PRODUCT_MODEL.md`, `CAPABILITY_MODEL.md`, `LICENSING_THREAT_MODEL.md`, `V1_COMMERCIAL_RECOMMENDATION.md`, este roadmap, `COST_MODEL.md`, `@impulso/commercial-schema` (prototipo mínimo con tests).
- **Dependencias**: ninguna — parte de cero sobre el monorepo auditado.
- **Riesgos**: diseñar de más sin evidencia de un segundo consumidor real (mitigado limitando el código nuevo a un solo paquete de contrato de datos).
- **Criterios de cierre**: ver sección 31 del enunciado de la fase — todos cumplidos en el reporte ejecutivo final de esta fase.
- **Qué NO incluye**: nada de código de producto, ningún backend, ninguna integración real.

## 4.2 — Product Manifest & Capabilities
- **Objetivo**: hacer real (no solo diseñado) el `ProductManifest` y el `CapabilityProvider`, conectados por primera vez a `apps/sticker-builder`.
- **Entregables**: mecánica de entrega del manifest real decidida e implementada; `@impulso/capabilities` (nuevo paquete, capa 4) con `OpenCapabilityProvider` como default; wiring real en la app (sin cambiar ningún comportamiento visible todavía, ya que el provider por defecto concede todo); primer manifest real para "Sticker Builder" (edición única).
- **Dependencias**: `@impulso/commercial-schema` (4.1).
- **Riesgos**: introducir el wiring sin que el default "todo concedido" esté bien probado podría, por error, bloquear una feature existente — mitigado con tests de regresión explícitos que confirman que las 44 capacidades del Print Engine y el resto del editor siguen accesibles.
- **Criterios de cierre**: manifest real cargado en runtime, capabilities consultadas en al menos un punto real de la UI (ej. el wizard de exportación), cero regresión en tests/E2E existentes.
- **Qué NO incluye**: segunda edición real, entitlements, licensing, ningún canal de venta conectado.

## 4.3 — Entitlements & Local Activation
- **Objetivo**: dar vida al tipo `Entitlement` (4.1) con un flujo de activación local mínimo.
- **Entregables**: `@impulso/entitlements` (capa 5), `@impulso/licensing` (capa 6) con el primer modo más allá de `delivery-only` si se justifica (ej. pegar una clave simple, validada solo por formato); UI mínima de "activar"/"restaurar acceso".
- **Dependencias**: 4.2 (capabilities debe existir para que un Entitlement tenga algo que desbloquear).
- **Riesgos**: cualquier validación técnica nueva puede introducir el primer caso real de "bloquear a un comprador legítimo" — mitigado con periodo de gracia obligatorio desde el primer diseño (ver ADR-0028).
- **Criterios de cierre**: un `Entitlement` real puede emitirse (aunque sea manualmente) y ser leído por `capabilities`, con test de extremo a extremo.
- **Qué NO incluye**: integración con Gumroad todavía (ver 4.4), cuentas de usuario reales.

## 4.4 — Commerce Adapter / Gumroad Integration
- **Objetivo**: primer canal de venta real conectado.
- **Entregables**: `@impulso/commerce-adapters` (capa 7) con `GumroadAdapter`; evaluación con evidencia real de si conviene o no verificar licencias contra la API pública de Gumroad; documentación de qué necesitaría un backend si se decide construir uno.
- **Dependencias**: 4.3.
- **Riesgos**: dependencia de una API externa de terceros no probada todavía — mitigado evaluando antes de comprometerse (regla explícita de la fase 4.1: "no prometer viabilidad sin haberla probado").
- **Criterios de cierre**: al menos un flujo de compra real (aunque sea de prueba/sandbox de Gumroad) resulta en una experiencia funcional de principio a fin.
- **Qué NO incluye**: checkout embebido dentro de THÖREN (Gumroad sigue siendo el checkout), webhooks productivos si no hay backend todavía disponible.

## 4.5 — Account & Recovery
- **Objetivo**: decidir e implementar, si la evidencia de 4.1-4.4 lo justifica, una cuenta real (propia o vía Bookfluence).
- **Entregables**: a definir en su propia revisión previa — depende de qué tan lejos haya llegado 4.4 sin necesitar cuentas.
- **Dependencias**: 4.4.
- **Riesgos**: mayor superficie de seguridad (sesiones, contraseñas/OAuth) — requiere su propio threat model ampliado.
- **Criterios de cierre**: a definir en la revisión previa de esa fase.
- **Qué NO incluye**: no se anticipa aquí.

## 4.6 — Release & Update Delivery
- **Objetivo**: pipeline real de actualización de builds por canal/edición.
- **Entregables**: mecanismo de "reemplazar el archivo en Gumroad"/actualizar la SPA hospedada; primer uso real de `updateChannel` (`stable`/`beta`/`internal`).
- **Dependencias**: 4.2 (manifest), 4.4 (canal real).
- **Riesgos**: romper compatibilidad de proyectos entre versiones sin la política de la sección 23 ya implementada — mitigado exigiendo que 4.2 ya tenga esa política de compatibilidad resuelta antes de automatizar releases.
- **Criterios de cierre**: a definir en su revisión previa.
- **Qué NO incluye**: updater automático dentro de una app desktop (fuera de alcance hasta que exista una app desktop).

## 4.7 — Commercial UX
- **Objetivo**: construir la UI real de los wireflows diseñados en 4.1 §22 (activación, feature bloqueada, upgrade, etc.) — solo si para entonces existe una segunda edición/producto que lo justifique.
- **Entregables**: pantallas reales, con el mismo estándar de accesibilidad que Epic 9 (foco atrapado, teclado, responsive).
- **Dependencias**: 4.2-4.5.
- **Riesgos**: introducir fricción/lenguaje agresivo — mitigado reutilizando los principios ya fijados en 4.1 §22 (claro, nunca agresivo, siempre con recuperación).
- **Criterios de cierre**: a definir en su revisión previa.
- **Qué NO incluye**: no se anticipa aquí.

## 4.8 — Admin, Support & Hardening
- **Objetivo**: cerrar la Commercial Platform con el mismo rigor que Epic 9 / Fase 9.5 — hardening, panel de soporte mínimo, auditoría de seguridad real.
- **Entregables**: a definir en su revisión previa — probablemente incluye un threat model actualizado con evidencia real de las fases 4.2-4.7.
- **Dependencias**: todas las anteriores.
- **Riesgos**: acumulación de deuda técnica no revisada a lo largo de 4.2-4.7 — mitigado exigiendo, igual que en Epic 9, una matriz de trazabilidad propia para Fase 4 antes de declarar la épica cerrada.
- **Criterios de cierre**: a definir en su revisión previa.
- **Qué NO incluye**: no se anticipa aquí.

---

**Regla de gobierno para todo este roadmap**: cada fase requiere su propia autorización explícita antes de iniciar, exactamente como Epic 9 lo hizo fase por fase. Completar 4.1 no autoriza automáticamente 4.2.
