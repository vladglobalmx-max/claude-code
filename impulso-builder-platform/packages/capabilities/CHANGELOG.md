# Changelog — @impulso/capabilities

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Fase 4.2: Commercial MVP

### Agregado
- Paquete nuevo (capa 4 de la arquitectura comercial, ver ADR-0026) — primera implementación real de `CapabilityProvider`.
- `createOpenCapabilityProvider()` — default seguro, concede todo.
- `createManifestCapabilityProvider(manifest)` — concede exactamente las capabilities del manifest.
- `loadCapabilityProvider(rawManifest, options)` — política de fallo del manifest: `"open-fallback"` (default, nunca silencioso — expone `diagnostics`) o `"throw"` (fallo estricto, para herramientas de build).
- Conectado a `apps/sticker-builder` — primer consumidor real (ver su CHANGELOG).
- 11 tests, 100% cobertura.
