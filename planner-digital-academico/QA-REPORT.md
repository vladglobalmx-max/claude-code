# QA Report — Planner Digital Académico 2026 (v1.0.0)

Método: revisión de código, verificación de sintaxis (`node --check`) y pruebas automatizadas end-to-end con Playwright/Chromium headless contra `index.html` cargado vía `file://`, además de inspección visual de capturas de pantalla en escritorio, tableta y móvil, en tema claro y oscuro.

## 1. Pruebas ejecutadas y resultado

| Prueba | Resultado |
|---|---|
| Primer inicio (sin datos previos) | ✅ Muestra aviso de privacidad → onboarding |
| Onboarding completo manual (9 pasos, perfil/ciclo/materias/grupos/evaluación/estudiantes) | ✅ Crea ciclo, materia, grupo y perfil correctamente; `onboardingCompleted=true` |
| Onboarding con "Probar con datos de ejemplo" | ✅ Carga datos de Mariana y va directo al panel |
| Privacidad (checkbox obligatorio) | ✅ Botón "Continuar" permanece deshabilitado hasta marcar la casilla |
| PIN — establecer | ✅ `AuthService.setPin` genera hash SHA-256 con sal aleatoria vía Web Crypto |
| PIN — verificación correcta/incorrecta | ✅ PIN correcto valida `true`; PIN incorrecto valida `false` sin exponer el PIN real |
| Ciclo escolar — crear/activar/cerrar/archivar/duplicar | ✅ Solo un ciclo activo a la vez; al activar uno nuevo el anterior pasa a "Próximo" con aviso |
| Periodos y días inhábiles | ✅ CRUD dentro de Configuración → Ciclo y periodos |
| Materias / Grupos | ✅ Alta, edición, archivado, colores, duplicado de grupo |
| Estudiantes — alta manual | ✅ |
| Pegado de lista | ✅ Parseo por línea `Nombre, número`, inserta N estudiantes |
| Importación CSV | ✅ Vista previa antes de importar; detecta filas sin nombre, filas vacías y posibles duplicados; columnas desconocidas se listan y se ignoran |
| Neutralización de inyección de fórmulas en CSV exportado | ✅ Valores que inician con `= + - @` se anteponen con `'` en la exportación; comillas y comas se escapan correctamente |
| Conflicto de horario | ✅ `ScheduleService.findConflicts` detecta traslapes por día/hora; UI exige confirmación explícita para guardar con conflicto |
| Calendario (mes/semana/día/agenda/ciclo escolar) | ✅ Navegación entre vistas, alta/edición/eliminación de eventos, eventos recurrentes (diaria/semanal) |
| Unidades — cálculo de avance | ✅ Con planeaciones ligadas usa `impartidas/total`; sin planeaciones usa avance manual. Verificado con casos 0/1, 1/2 |
| Planeaciones — crear/duplicar/reasignar/plantilla | ✅ |
| Marcar planeación como impartida | ✅ Modal con 4 preguntas de reflexión + bandera de seguimiento requerido |
| Asistencia — registro y "marcar todos presentes" | ✅ |
| Asistencia — resumen (%, ausencias, retardos, consecutivas) | ✅ Genera alerta "Revisar asistencia" a partir de 3 ausencias consecutivas (sin lenguaje disciplinario) |
| Evaluaciones — categorías y ponderación | ✅ Bloquea el cálculo final y muestra el mensaje "Las categorías suman N%. Ajusta las ponderaciones..." cuando la suma ≠ 100% |
| **Calificaciones — pendiente vs. cero vs. ausente vs. exento** | ✅ Ver sección 2 (verificación detallada) |
| Redondeo (normal/arriba/abajo) y decimales | ✅ 87% → 8.7 (normal), 9 (arriba, 0 decimales), 8 (abajo, 0 decimales) |
| Conversión de escalas (0-10, 0-100, letras, niveles, acreditado) | ✅ Sin `NaN` en ningún caso, incluyendo valores límite |
| Seguimiento estudiantil | ✅ Estados y categorías conforme a especificación; lenguaje neutral en textos de ayuda |
| Comunicación familiar / Reuniones | ✅ Incluye conversión de acuerdo en evento/seguimiento/meta/actividad |
| Sustituciones (plan y reporte) | ✅ |
| Recursos / Inventario (incrementar, reducir, préstamo, reposición) | ✅ |
| Metas docentes / Desarrollo profesional | ✅ Horas acumuladas mostradas como registro personal, no certificación |
| Revisión semanal (automática + reflexiva) | ✅ Cálculo automático correcto (clases impartidas/planeadas, asistencia, seguimientos abiertos, avance de unidades) |
| Reportes e impresión | ✅ 12 tipos de reporte generan ventana de impresión sin errores; CSS de impresión oculta navegación/botones y muestra fecha + marca |
| Exportación de respaldo JSON | ✅ Incluye `schemaVersion`, `appVersion`, `exportedAt` y datos completos |
| Restauración de respaldo | ✅ Vista previa con conteos, requiere confirmación + PIN, crea respaldo previo automático |
| Exportación CSV (estudiantes, asistencia, calificaciones, inventario) | ✅ BOM UTF-8 incluido para compatibilidad con Excel |
| Recarga de página conservando datos | ✅ `localStorage` persiste; confirmado recargando `Store.load()` tras guardar |
| Recuperación ante datos dañados | ✅ Con `localStorage` corrupto, `Store.load()` recupera desde `__autobackup` sin perder los datos de la sesión previa |
| Vista móvil (390px) | ✅ Navegación inferior + menú "Más", tarjetas apiladas |
| Vista tableta (820px) | ✅ Usa el layout compacto (bottom-nav), sin recortes |
| Vista escritorio (1280px+) | ✅ Barra lateral fija, tablas completas |
| Tema oscuro | ✅ Corregido un problema de contraste (texto azul oscuro ilegible sobre fondos de acento oscuros en botones secundarios, cifras de tarjetas y etiquetas); ahora usa la variable `--en-tinte` adaptable por tema |
| Navegación por teclado | ✅ `Tab`/`Shift+Tab` con trampa de foco dentro de modales, `Esc` cierra y restaura el foco anterior |
| Errores de consola durante navegación completa por las 22 rutas + interacciones anteriores | ✅ 0 errores (`pageerror`/`console.error`) registrados |

## 2. Verificación detallada del motor de calificaciones

Caso de prueba construido sobre los datos de demostración (grupo 5.º A, categorías Tareas/Participación/Proyectos 20% cada una y Exámenes 40%):

| Estudiante | Escenario | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| Aitana | Todas las categorías calificadas normalmente (10, 8, 9, 9/10) | 9.0 | **9** ✅ |
| Bruno | Un cero explícito en Tareas (0/10) | El cero cuenta en el promedio (6.8), no se excluye | **6.8** ✅ |
| Camila | Exenta de la única evaluación de Tareas | Categoría excluida y ponderaciones restantes renormalizadas a 100% (no bloquea el resultado) | **9** ✅ (corregido; ver nota) |
| Dylan | Ausente en la única evaluación de Tareas | No se asume cero ni se excluye automáticamente: bloquea el resultado final como "Pendiente" hasta que se resuelva | **Pendiente** ✅ |
| Elena | Evaluación de examen sin calificar | "Pendiente" (nunca se muestra como 0 ni como `NaN`) | **Pendiente** ✅ |
| — | Ponderaciones alteradas a sumar 95% | Bloquea el cálculo con estado de configuración | **`status:"config"`, sin resultado numérico** ✅ |

**Nota de corrección aplicada durante QA:** la primera implementación trataba "exento en la única evaluación de una categoría" igual que "categoría sin calificar", mostrando "Pendiente" indefinidamente. Se corrigió `GradeService` para distinguir explícitamente cuando una categoría no aplica a un estudiante (exento) — en ese caso se excluye del cálculo y las ponderaciones restantes se renormalizan proporcionalmente — de cuando simplemente falta calificar (bloquea el resultado). Ambas rutas se volvieron a probar tras el cambio.

Fórmulas verificadas (ver también Ayuda dentro de la app):
```
resultado          = puntosObtenidos / puntosMáximos
promedioCategoría   = Σ(resultado × pesoInterno) / Σ(pesoInterno)      [solo evaluaciones calificadas]
calificaciónFinal   = Σ(promedioCategoría × ponderaciónCategoría)      [normalizado si hay categorías exentas]
```

## 3. Criterios de aceptación (sección 39 del encargo)

Los 30 criterios fueron revisados; todos se cumplen. Los más relevantes verificados de forma automatizada:

- ✅ Abre por doble clic (archivo único `index.html`, sin build).
- ✅ Funciona sin internet (sin peticiones de red, sin CDN, sin fuentes remotas).
- ✅ Completa onboarding y guarda datos al recargar.
- ✅ Protege módulos sensibles mediante PIN opcional (Web Crypto, hash + sal).
- ✅ Permite varios ciclos, materias y grupos; importa estudiantes; configura horarios y detecta conflictos.
- ✅ Crea y duplica unidades y planeaciones; registra asistencia; calcula calificaciones correctamente distinguiendo pendiente/cero/ausente/exento.
- ✅ Registra seguimientos y comunicaciones; genera e imprime reportes; exporta/restaura respaldo; exporta CSV seguro.
- ✅ Funciona entre 360 px y 2560 px; sin errores de consola detectados en el recorrido de pruebas.
- ✅ No hay botones sin función: cada acción visible en las pantallas revisadas dispara una operación real sobre `Store` o abre un formulario/reporte funcional.
- ✅ No depende de servicios externos ni copia el material de referencia (paleta, tipografía e iconos son de elaboración propia a partir de la guía de marca proporcionada).

## 4. Limitaciones conocidas / seguimiento sugerido

- La cobertura de pruebas se realizó por automatización dirigida a los flujos de mayor riesgo (cálculo de calificaciones, horario, respaldo/restauración, PIN, importación) más inspección visual; no sustituye una ronda de uso real prolongado por un docente.
- Los formatos nativos de `<input type="date">`/`<input type="time">` siguen el idioma/formato del sistema operativo o navegador del usuario; el "Formato de fecha" configurado en la app solo controla las fechas que la app misma da formato (listas, reportes), no el widget nativo del navegador.
- No se probó en Safari/Firefox reales (solo Chromium); la app no usa APIs propietarias, por lo que se espera compatibilidad, pero se recomienda una verificación manual adicional antes de distribuir ampliamente.
