# THÖREN — Brand System

**Fuente de verdad**: `THOREN_Manual_de_Marca.pdf`, versión 1.0.0, entregado por Vlad (agosto 2026), basado en assets previamente aprobados. Este documento es un resumen operativo para desarrollo — ante cualquier duda o conflicto, el PDF manda.

Este documento existe para que ninguna sesión futura vuelva a inventar colores, tipografía o símbolo por su cuenta. Si algo no está definido aquí ni en el manual, es una decisión pendiente — no una que un agente deba tomar por su cuenta.

## Nombre oficial

**THÖREN** — con diéresis (Ö) obligatoria en todo momento. Nunca usar `THOREN`, `Thören` ni `Thoren` como sustituto visual de la marca.

## Símbolo

El símbolo oficial es **Þ (thorn)**, en color Ember fijo (`#9C4E27`) — nunca se recolorea, rota, deforma ni reconstruye libremente.

**Área de resguardo**: margen libre alrededor del símbolo equivalente al ancho de su propio trazo vertical. No colocar texto, otros logos ni bordes de contenedor dentro de esa zona.

**Tamaños mínimos**:
- Símbolo: 16px. Por debajo, usar solo el ícono de aplicación con fondo de contención.
- Wordmark: 12px. La diéresis debe permanecer visible en todo momento — es el rasgo distintivo de la marca.

## Paleta oficial

| Nombre | Hex | HSL | Uso |
|---|---|---|---|
| **Stone** | `#EDEAE2` | `hsl(44 23% 91%)` | Fondo principal en modo claro; superficie neutra de baja saturación. |
| **Basalt** | `#23282B` | `hsl(202 10% 15%)` | Texto principal en modo claro; fondo profundo en modo oscuro (sidebar). |
| **Fjord** | `#4B6673` | `hsl(200 21% 37%)` | Texto secundario, metadatos, subtítulos — frío y sobrio. |
| **Ember** | `#9C4E27` | `hsl(20 60% 38%)` | Acento primario: símbolo, botones de acción, foco, elementos interactivos clave. Ajustado por el manual para pasar contraste AA (5.94:1) sobre texto blanco. |
| **Moss** | `#5C6E4F` | `hsl(95 16% 37%)` | Acento secundario: estados positivos/confirmación. Uso puntual, no como acento principal. |
| **Paper** | `#F7F5EF` | `hsl(45 33% 95%)` | Superficies de tarjeta/diálogo sobre el fondo Stone. |

### Mapeo a tokens de implementación (`src/app/globals.css`)

| Token CSS (`--gso-*`) | Color de marca | Nota |
|---|---|---|
| `--gso-bg` | Stone | Fondo de página |
| `--gso-surface` | Paper | Cards, diálogos, superficies elevadas |
| `--gso-surface-2` | derivado de Stone | Hover/fills sutiles — el manual no define este caso puntual |
| `--gso-border` | derivado de Stone | Bordes — el manual no define este caso puntual |
| `--gso-ink` | Basalt | Texto principal |
| `--gso-ink-soft` | Fjord | Texto secundario/metadata |
| `--gso-ink-faint` | derivado de Fjord | Texto terciario — el manual no define este caso puntual |
| `--gso-accent` / `--gso-accent-ink` | Ember / blanco | Acento primario / texto sobre acento |
| `--gso-success` | Moss | Estados positivos |
| `--gso-warning`, `--gso-danger` | **fuera del manual** | Semántica funcional de UI (no identidad de marca) — sin cambios respecto al valor previo |
| `--gso-sidebar-bg` | Basalt | Único fondo oscuro de la app |
| `--gso-sidebar-ink` | Paper | Texto sobre sidebar |
| `--gso-sidebar-ink-soft` / `--gso-sidebar-border` | derivados de Paper/Basalt | El manual no define casos puntuales de sidebar (es un concepto de esta implementación, no del manual) |

## Reglas de uso — prohibido

- No deformar ni estirar el símbolo.
- No cambiar el color Ember del símbolo bajo ninguna circunstancia.
- No rotar el símbolo.
- No usar otra tipografía ni minúsculas en el wordmark.
- No usar el símbolo/wordmark sobre fondos de bajo contraste.
- No combinar con otras marcas sin espaciado propio.
- **No inventar una identidad visual alternativa** (colores, símbolo o tipografía) que no esté en este documento o en el manual — si falta algo, repórtalo como pendiente, no lo improvises.

## Tipografía

**Pendiente de definir.** El manual especifica únicamente características (sans-serif geométrica, alto contraste, todo mayúsculas, peso bold/extrabold para el wordmark) — el nombre comercial de la fuente y su licencia de uso **no están documentados** en los assets entregados.

Estado actual de este repo: **Inter (`next/font/google`) es una fuente de UI provisional**, no la fuente oficial del wordmark THÖREN. Se usa únicamente para el cuerpo de la interfaz (botones, tablas, formularios), nunca declarada como "la tipografía de THÖREN". Antes de imprimir empaque físico o publicar el ícono en una app store, hay que confirmar la fuente exacta del wordmark.

## Assets aprobados vs. pendientes

| Elemento | Archivo fuente | Estado |
|---|---|---|
| Logotipo — fondo claro | `01logofondoclaro.png` | Aprobado — **no disponible en este repositorio** |
| Logotipo — fondo oscuro | `02logofondooscuro.png` | Aprobado — **no disponible en este repositorio** |
| Símbolo aislado | `03simboloaisladogrande.png` | Aprobado — **no disponible en este repositorio** |
| Ícono de aplicación | `10iconoaplicacion.png` | Aprobado — **no disponible en este repositorio** |
| Tipografía del wordmark | — | Pendiente (no identificada) |
| Archivos vectoriales (.svg/.ai) | — | Pendiente (no entregados) |
| Guía de tono de voz / copy | — | Pendiente (no definida) |

**Importante**: los 4 PNG aprobados existen y están referenciados en el manual, pero no fueron adjuntados como archivos junto con el PDF — solo se recibió el manual. Mientras no se incorporen al repositorio, cualquier lugar de la UI que necesite el símbolo/logotipo usa temporalmente el carácter Unicode **Þ** como sustituto tipográfico (nunca una recreación aproximada del trazo/curva del diseño original aprobado). Esto debe reemplazarse por el asset real en cuanto esté disponible.

## Prohibición explícita

Ninguna sesión de desarrollo debe proponer, improvisar o sustituir colores, símbolo o tipografía de THÖREN por decisión propia. Este documento y `THOREN_Manual_de_Marca.pdf` son las únicas fuentes de verdad. Cualquier vacío (tipografía exacta, archivos vectoriales, tono de voz) es una pregunta para Vlad, no una decisión de implementación.
