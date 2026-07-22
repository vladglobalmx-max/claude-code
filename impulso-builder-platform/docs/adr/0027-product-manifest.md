# ADR-0027 — Commercial Product Manifest (Fase 4.1)

## Problema
ADR-0026 estableció que un `Commercial Product` es el paquete vendible que agrupa Modules/Features, y que su modelo de datos vive en `@impulso/commercial-schema` (capa 3). Este ADR responde una pregunta más concreta: **¿en qué formato se describe un producto comercial concreto, dónde vive ese archivo, y cómo se valida?** — sin todavía construir el runtime que lo consuma (eso es Fase 4.2).

## Contexto
- Auditoría (Fase 4.1 §1) confirmó: cero variables de entorno usadas hoy, cero configuración runtime — la app es 100% estática en build-time. Esto significa que un manifest de producto puede resolverse en build-time (qué build generar) o en runtime (un JSON que la app carga al iniciar) — ambas son técnicamente viables hoy, ninguna requiere infraestructura nueva.
- Existe ya un archivo de configuración de build por app (`apps/sticker-builder/vite.config.ts`, con 3 entradas Rollup: `main`, `printEngineHarness`, `printPreviewHarness`) — el manifest de producto no debe convertirse en un cuarto entry-point de build, es datos, no código.
- `docs/product/PRODUCT_BACKLOG.md` ya reconoce "Print Engine" como la feature diferenciadora comercial más madura (Epic 9, cerrada) — el primer manifest real (fixture de este ADR) modela exactamente ese caso: Sticker Builder con y sin Print Engine.

## Alternativas evaluadas

**¿Dónde vive el manifest?**
1. *Variable de entorno inyectada en build* — descartada para V1: obligaría a generar N builds distintos por edición (contradice §13, "evitar forks de código por cliente"), y el proyecto hoy no tiene ningún pipeline de CI/CD que orqueste builds paramétricos.
2. *Un archivo `commercial-product.json` cargado en runtime por la app, validado con el schema de `commercial-schema`* — **elegida**. Un solo build sirve N ediciones con solo cambiar qué manifest se sirve/incluye — exactamente el patrón "single build, manifest-driven" recomendado en la sección de empaquetado (ver §13, resuelto también en este ADR).
3. *Manifest remoto, resuelto por HTTP en cada carga* — descartada para V1: requeriría backend (fuera de alcance de 4.1-4.3) y rompería el uso offline (la app debe arrancar sin red, ver ADR-0028/offline).

**¿Cómo se valida?**
1. *Sin validación, confiar en el JSON* — descartada: un manifest corrupto o de una versión de schema vieja podría dejar la app en un estado inconsistente sin ninguna señal.
2. **Validación Zod estricta al cargar, con fallback determinista a un manifest "todo incluido" si falta o es inválido** — **elegida**: nunca bloquea al usuario por un manifest malformado (coherente con "no romper proyectos existentes" de la sección 11), pero sí registra el problema de forma diagnosticable.

## Decisión tomada

### Formato: `commercial-product.json`
Versionado explícitamente (`schemaVersion`, independiente de `productVersion`). Campos mínimos (tipados y validados en `@impulso/commercial-schema`, `src/productManifest.ts`):

```jsonc
{
  "schemaVersion": 1,
  "productId": "sticker-builder-professional",
  "productVersion": "1.0.0",
  "edition": "professional",
  "modules": ["sticker-builder"],
  "capabilities": ["sticker.core", "export.png", "export.svg", "print.professional"],
  "branding": { "displayName": "Sticker Builder Professional", "shortName": "Sticker Builder" },
  "support": { "email": "soporte@ejemplo.com", "docsUrl": null },
  "updateChannel": "stable",
  "licensingMode": "delivery-only",
  "termsReference": null,
  "buildMetadata": { "builtAt": null, "commit": null }
}
```

- `capabilities` es la lista de `CapabilityId` que este producto **incluye por defecto** — no es una promesa de que están técnicamente gateadas todavía (en 4.1 nada lo está; ver ADR-0026 Consecuencias). Es el vocabulario que Fase 4.2 usará para construir el `CapabilityProvider` real.
- `licensingMode` es un enum abierto pensado para evolucionar sin romper el schema: `"delivery-only"` (V1, ver ADR-0028), `"license-key"`, `"account-bound"` — agregar un modo nuevo no es un cambio breaking del schema en sí.
- `termsReference`/`buildMetadata.commit` son deliberadamente nullable — no se inventan datos que no existen todavía (no hay pipeline de build que inyecte un commit hash hoy).
- **Nunca contiene secretos** — ni claves de API, ni credenciales, ni nada usado para validar autenticidad criptográfica de una licencia (eso, si existe, vive fuera del bundle del cliente — ver ADR-0028).

### Dónde vive el schema
Dentro de `@impulso/commercial-schema` (no un paquete `@impulso/product-manifest` separado — ver ADR-0026, decisión de no crear paquetes sin consumidor real todavía). Si Fase 4.2 demuestra que la *resolución* de manifests (herencia entre ediciones, overrides por canal) necesita lógica no-trivial más allá de tipos+validación, ese código puede extraerse a su propio paquete en ese momento — no antes.

### Dónde vive el archivo real
No se decide en esta fase — es explícitamente una decisión de Fase 4.2 (¿un archivo estático en `apps/sticker-builder/public/`? ¿generado en build a partir de configuración del monorepo? ¿servido por un backend futuro?). Este ADR fija el **formato y el contrato de validación**, no la mecánica de entrega — evita que 4.1 se convierta en una implementación completa quntes de tiempo.

## Consecuencias
- Cualquier producto comercial futuro (bundle, edición white-label, asset pack) se describe con el mismo formato — no se inventa un formato nuevo por tipo de producto.
- El prototipo de esta fase (`packages/commercial-schema/src/testUtils/fixtures.ts`) incluye un manifest fixture real y su validación, sirviendo de documentación ejecutable del formato.

## Riesgos
- **El fallback "todo incluido" ante un manifest inválido podría, en teoría, exponer features premium a un usuario sin la edición correspondiente** — aceptado conscientemente para V1 porque en 4.1-4.3 nada está técnicamente gateado de todas formas (ver ADR-0026); debe revisarse en Fase 4.2 cuando exista gating real, posiblemente invirtiendo el fallback a "mínimo común" en ese momento.
- **`licensingMode` como string abierto (no discriminated union todavía)** — se eligió así porque en 4.1 solo existe un modo real (`delivery-only`); convertirlo en discriminated union con payloads específicos por modo es trabajo de Fase 4.3 cuando el segundo modo (`license-key`) tenga forma concreta.

## Compatibilidad futura
- Fase 4.2 decide la mecánica de entrega del archivo real y construye el `CapabilityProvider` que lee `capabilities` de este manifest.
- Fase 4.3 da forma real a los modos de `licensingMode` más allá de `delivery-only`.
- Fase 4.6 (Release & Update Delivery) usa `updateChannel` para decidir qué build ofrecer a qué producto.
