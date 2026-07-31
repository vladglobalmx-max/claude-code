> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del lanzamiento comercial independiente de Sticker Builder v1.0.0 (RC1/Gumroad) — ese lanzamiento no ocurrirá bajo esta forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como evidencia de un proceso de release real, disciplinado y verificado — reutilizable como referencia si THÖREN necesita empaquetarse comercialmente en el futuro, pero no es una fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# Buyer Validation Report — THÖREN Sticker Builder v1.0.0

**Estado: APROBADA.** El propietario del producto confirmó personalmente, sobre el ZIP de distribución real y en su propia máquina (no en el entorno de desarrollo), que la validación manual de comprador quedó completada y que la aplicación funciona correctamente.

## Metodología

A diferencia de las verificaciones automatizadas (unit/E2E, que también pasan en verde — ver `FINAL_RELEASE_CHECKLIST.md`), esta validación se ejecutó exactamente como la viviría un comprador real:

- Sin tests automatizados ni revisión de código como criterio de aceptación.
- Descarga del ZIP real de distribución, ejecutado en la máquina real del comprador (no en el sandbox de desarrollo).
- Cada paso ejecutado y confirmado por una persona, un paso a la vez.
- Ante cualquier bug encontrado: alto inmediato, diagnóstico, corrección, reconstrucción del ZIP, y reanudación desde ese mismo punto — nunca se avanzó con un bug conocido pendiente.

## Alcance cubierto

- Localización, verificación de contenido y extracción del ZIP de distribución.
- Ejecución del launcher (Windows/macOS-Linux) y apertura correcta de la aplicación.
- Inspección visual crítica de la primera pantalla (sin asumir nada).
- Creación de un proyecto nuevo, guardado, cierre completo de la app, reapertura, confirmación de persistencia.
- Creación de varios stickers: texto, importación de imágenes PNG.
- Edición de texto, duplicar, eliminar, Deshacer/Rehacer.
- Exportación a PNG y SVG.
- Exportación para impresión (asistente completo, perfiles Digital PNG y Print PDF).
- Respaldo de proyecto (Exportar respaldo) y restauración (Importar proyecto), incluyendo la garantía de que un proyecto existente nunca se sobrescribe.
- Revisión general de la interfaz en busca de texto cortado, botones invisibles, errores ortográficos o elementos desalineados.

## 1. Bugs críticos (encontrados y corregidos durante esta validación)

| # | Bug | Causa raíz | Corregido en | Verificación |
|---|---|---|---|---|
| 1 | Imágenes importadas mal posicionadas/desbordando el sticker | Mezcla de unidades física (mm de página) vs. canónica (px de objects) al insertar | `0.17.4` → causa raíz real en `0.17.5` | Chromium real, escenario exacto reportado (sticker 50×50mm + imagen 441×529px) |
| 2 | Imágenes desaparecían al reabrir un proyecto guardado | El primer montaje del editor no precargaba binarios de imagen antes del render | `0.17.6` | Recarga completa de página + verificación de píxel real (magenta puro tras reabrir) |
| 3 | Botón principal de "Exportar para impresión" invisible (blanco sobre blanco) | Conflicto de especificidad CSS | Ciclo previo de RC1 (`0.17.2`) | E2E de regresión (`getComputedStyle`), confirmado que falla sin el fix |
| 4 | Importar un respaldo sobrescribía un proyecto existente con el mismo id | `handleImportBackup` guardaba el project importado sin regenerar sus ids | Ciclo previo de RC1 (`0.17.1`) | Round-trip real export→import, conteo de tarjetas antes/después |

Los bugs #3 y #4 se encontraron y corrigieron en el ciclo de validación previo a esta sesión (parte del mismo RC1); se listan aquí por completitud del historial de validación de comprador.

## 2. Bugs menores (encontrados y corregidos)

| # | Bug | Corregido en | Verificación |
|---|---|---|---|
| 1 | Contorno de foco crudo del navegador en el título del diálogo de bienvenida | Ciclo previo de RC1 (`0.17.3`) | E2E real (Chromium), accesibilidad confirmada intacta |
| 2 | Un proyecto recién importado desde un respaldo no generaba miniatura (ícono de imagen rota en "Mis proyectos") | `0.17.7` | Chromium real, round-trip completo crear→exportar→importar |

## 3. Hallazgo sin resolver (documentado, no bloqueante)

Un proyecto de prueba específico —reutilizado extensamente a lo largo de toda esta sesión de validación, a través de múltiples reconstrucciones del ZIP— quedó con la miniatura de su tarjeta rota, sin ningún error verificable en consola del navegador. No se reprodujo en ningún proyecto nuevo ni en ningún proyecto recién importado. Es puramente cosmético (el proyecto abre, edita y exporta con normalidad). Documentado en `KNOWN_LIMITATIONS_v1.0.0.md` para referencia de soporte.

## 4. Recomendaciones (no bloqueantes, para backlog)

- Advertir al usuario cuando un respaldo resulta pesado (fotos de alta resolución sin comprimir).
- Ninguna otra fricción real surgió durante esta validación — el resto del flujo (crear, editar, duplicar, deshacer/rehacer, exportar en sus 3 formas, respaldo/restauración, persistencia) funcionó sin sorpresas.

## Recomendación de publicación (dada durante la validación)

**Sí, se recomendó publicar** — los bugs críticos que hubieran arruinado la primera experiencia de un comprador real fueron encontrados en la validación en vivo (no en una auditoría de código) y quedaron corregidos y verificados en la máquina real del validador, no solo en el sandbox de desarrollo. El único hallazgo pendiente es cosmético, aislado a un proyecto de prueba con un historial atípico, y no se reprodujo en el flujo normal de un comprador.

## Confirmación final

> "La validación manual del comprador quedó completada. Confirmo que probé personalmente THÖREN Sticker Builder y la aplicación funciona correctamente."
>
> — Propietario del producto, autorizando el hito Final Release Preparation — Version 1.0.0.
