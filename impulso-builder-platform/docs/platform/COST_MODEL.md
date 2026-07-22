# Cost Model (conceptual) — Fase 4.1

> Estimación conceptual, no investigada con precios actuales de mercado — todas las cifras son **rangos de orden de magnitud declarados como supuestos**, no cotizaciones. Ver `docs/adr/0026-commercial-platform-boundaries.md` §Backend futuro para el modelo lógico de datos que motiva estas categorías.

## Modelo lógico de datos para un backend futuro (sección 19)
No se elige base de datos en esta fase. Entidades mínimas que un backend eventual necesitaría (relacional, dado que casi todo es "quién tiene derecho a qué, desde cuándo, por qué canal" — un dominio naturalmente relacional):

`users` · `products` · `purchases` · `entitlements` · `licenses` · `activations` · `devices` · `releases` · `downloads` · `audit_events`

## Comparación de opciones de backend (sin elegir todavía una implementación)

| Opción | Costo inicial | Complejidad | Escalabilidad | Ajuste al equipo actual (pequeño, sin backend hoy) |
|---|---|---|---|---|
| **Supabase** | Gratis en el tier inicial (rango conceptual) | Baja-media (Postgres + Auth + Storage integrados) | Buena hasta volumen medio | **Alto** — modelo relacional encaja directo con las 10 entidades de arriba; Auth/Storage ya incluidos evitan integrar 2-3 servicios separados |
| **Firebase** | Gratis en el tier inicial (rango conceptual) | Media (NoSQL exige modelar relaciones a mano) | Buena, probada a gran escala | Medio — el modelo de datos de Entitlements/Purchases es intrínsecamente relacional; forzarlo a documentos NoSQL añade fricción de modelado sin beneficio claro para este caso |
| **Backend propio (Node/Postgres en un VPS o serverless)** | Bajo en infra, alto en tiempo de desarrollo | Alta (todo se construye a mano: auth, migraciones, backups) | Depende enteramente de cómo se construya | Bajo para V1 — no hay evidencia todavía de que la flexibilidad extra valga el tiempo de construcción, con un equipo pequeño |
| **Serverless puro (funciones + un KV/Postgres administrado)** | Muy bajo en reposo (pago por uso) | Media | Buena | Medio — viable, pero fragmenta la superficie a mantener (funciones + DB por separado) sin un beneficio claro sobre Supabase para este volumen |
| **Sin backend permanente (integración inicial vía canal)** | Cero | Ninguna | No aplica (no hay servicio) | **Es la recomendación explícita para 4.1-4.3** — ver `V1_COMMERCIAL_RECOMMENDATION.md` |

**Recomendación**: **neutralidad ahora, Supabase como default declarado para cuando (no antes de que) exista evidencia real de necesitar backend** (Fase 4.4+) — razón principal: el modelo de datos ya identificado es relacional por naturaleza, y Supabase evita reconstruir Auth/Storage desde cero si Fase 4.5 (Cuentas) los necesita, sin comprometerse a usarlos de inmediato. `EntitlementService`/`ProjectStore` seguirán detrás de una interfaz propia (patrón ya usado con `StorageProvider`), así que esta elección es reversible sin reescribir capas 1-6.

## Estimación de costos operativos (rangos conceptuales, sin fuente de precios verificada)

| Categoría | Piloto (0-100 clientes) | 100 clientes | 1,000 clientes | 10,000 clientes |
|---|---|---|---|---|
| Hosting (SPA estática) | ~$0 (tier gratuito de cualquier host estático) | Bajo | Bajo-medio | Medio |
| Backend/DB (si se activa, Fase 4.4+) | $0 (no existe en V1) | Bajo (tier gratuito típico) | Bajo-medio | Medio |
| Auth (si se activa, Fase 4.5+) | $0 (no existe en V1) | Bajo | Bajo-medio | Medio |
| Storage (assets de usuario, si hay sync futuro) | $0 (100% local hoy) | N/A (no aplica sin Cloud Sync) | Bajo si se activa | Medio-alto si se activa |
| Email transaccional (soporte/recuperación) | ~$0 (manual, sin servicio dedicado en V1) | Bajo | Bajo | Medio |
| Error reporting / analytics | $0 (no implementado en 4.1) | Bajo si se activa | Bajo-medio | Medio |
| **Gumroad fees** (variable externa, no cotizada aquí) | Por transacción | Por transacción | Por transacción | Por transacción |
| Dominio | Bajo, anual | Igual | Igual | Igual |
| Soporte (tiempo humano, no cotizado en $) | Bajo (manual) | Bajo-medio | Medio (empieza a justificar automatización) | Alto sin automatización — reevaluar |
| Mantenimiento (tiempo humano) | Bajo | Bajo-medio | Medio | Medio-alto |

**Supuestos declarados**: todas las filas asumen los tiers gratuitos/iniciales típicos de este tipo de servicio se mantienen vigentes — no se verificó ningún precio actual (fuera de alcance de esta fase, sección 26 lo permite explícitamente marcando todo como estimación conceptual). El único costo variable real y no evitable es la comisión de Gumroad por transacción, externa a Impulso y no cotizada aquí.
