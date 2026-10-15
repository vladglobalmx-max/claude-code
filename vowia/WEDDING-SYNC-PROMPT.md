# PROMPT PARA CLAUDE CODE: WEDDING SYNC DASHBOARD

## 1. VISIÓN GENERAL DEL PROYECTO

Crear **WEDDING SYNC**, un planificador de bodas revolucionario diseñado específicamente para parejas con diferentes visiones, estilos y prioridades sobre su boda.

### Problema que Resuelve
- Decisiones paralizadas por desacuerdo (¿elegancia vs. diversión?)
- Uno de los dos es "invisible" en decisiones importantes
- Falta comunicación asincrónica sobre gustos y prioridades
- No hay claridad sobre quién decide qué
- Fricción pareja durante planificación → relación tensionada

### Mercado Objetivo
- **Parejas heterosexuales/LGBTQ+** 28-40 años
- **Presupuesto**: $15K-$50K
- **Personalidad**: Perfeccionista vs. Espontáneo / Presupuesto vs. Estética / Tradición vs. Modernidad
- **Ubicación**: Preferentemente ciudades progresistas (pero global)
- **Disposición a pagar**: $47-67 USD (producto premium)

---

## 2. ARQUITECTURA TÉCNICA

### Stack
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- **Storage**: localStorage del navegador (sin backend)
- **Responsividad**: Mobile-first, funciona en dispositivos 380px a 2560px
- **Compatibilidad**: Navegadores modernos (Chrome, Firefox, Safari, Edge)
- **Deployment**: Archivo único index.html (venta en Etsy)

### Restricciones Críticas
- ❌ CERO backend / base de datos
- ❌ CERO APIs externas
- ❌ CERO librerías externas (jQuery, Bootstrap, etc.)
- ✅ Almacenamiento local únicamente
- ✅ Archivo único, auto-contenido
- ✅ Funciona sin conexión a internet

---

## 3. ESTRUCTURA DE DATOS

### Objeto Principal (localStorage)
```javascript
{
  partners: {
    her: { 
      name: string,
      emoji: string,
      color: string 
    },
    him: { 
      name: string,
      emoji: string,
      color: string 
    }
  },
  
  wedding: {
    date: ISO string,
    totalBudget: number,
    guestCount: number,
    type: enum ['traditional', 'modern', 'intimate', 'beach', 'garden', 'destination'],
    location: string,
    currency: string
  },
  
  priorities: {
    her: {
      aesthetic: 1-10,
      budget: 1-10,
      tradition: 1-10,
      [custom]: 1-10
    },
    him: {
      budget: 1-10,
      aesthetic: 1-10,
      fun: 1-10,
      [custom]: 1-10
    }
  },
  
  decisions: [
    {
      id: timestamp,
      title: string,
      owner: enum ['her', 'him', 'shared'],
      category: enum ['ceremony', 'reception', 'catering', 'budget', 'guests', 'venue', 'decor', 'other'],
      status: enum ['pending', 'conflict', 'agreed'],
      herOption: string,
      hisOption: string,
      sharedOption: string,
      agreementLevel: 0-100,
      notes: string,
      createdAt: timestamp,
      resolvedAt: timestamp or null
    }
  ],
  
  conflicts: [
    {
      id: timestamp,
      decisionId: reference,
      title: string,
      herPerspective: string,
      hisPerspective: string,
      status: enum ['open', 'resolved', 'mediated'],
      mediationNotes: string
    }
  ]
}
```

---

## 4. NAVEGACIÓN & PESTAÑAS

```
┌─ 📊 Dashboard (Inicio)
├─ ✓ Decisiones (CRUD)
├─ 🔥 Conflictos (Vista especializada)
├─ ⭐ Prioridades (Comparison chart)
├─ 👥 Pareja (Información básica)
├─ 📊 Comparador (Side-by-side analysis)
├─ 📥 Exportar (JSON + CSV)
└─ ⚙️ Configuración (Tema, idioma, reset)
```

---

## 5. FUNCIONALIDADES POR PESTAÑA

### 📊 DASHBOARD (Pantalla Principal)

**Componentes:**
1. **Dual Partner Section** (Lado a lado)
   - Avatar + Nombre editable
   - Status cards: Decididas / En debate / Sin tocar
   - Priority meter (3-5 categorías por persona)
   
2. **Agreement Meter** (Centro)
   - Barra de progreso % acuerdo general
   - Número grande del porcentaje
   - Color: Rojo <30% | Amarillo 30-70% | Verde >70%
   
3. **Quick Conflicts Preview** (Abajo)
   - Máximo 3 conflictos actuales
   - Clickeable para ir a pestaña "Conflictos"
   - Ícono 🔥 + resumen de cada uno

**Interactividad:**
- Las prioridades (barras) son clickeables para editar
- El acuerdo se recalcula en tiempo real
- Los nombres se pueden editar inline

---

### ✓ DECISIONES

**Vista Lista:**
- Grid de decisiones con filtros:
  - Por estado (Pendiente / Conflicto / Acordado)
  - Por categoría
  - Por responsable (Ella / Él / Compartida)

**Cada decisión tiene:**
- Checkbox de estado
- Título + categoría + responsable
- Campos inline para opción ella / él
- Campo de notas
- Botones: Acordar | Marcar Conflicto | Editar | Eliminar

**Agregar Nueva:**
- Input modal o inline form
- Auto-focus en título
- Validación: Título + Responsable + Categoría requeridos

**Editar:**
- Click en cualquier fila abre modal expandido
- Vista completa con más espacio para escribir

---

### 🔥 CONFLICTOS

**Vista Especializada para Resolver Conflictos**
- Filtro: Todos / Solo Abiertos / Solo Resueltos
- Para cada conflicto:
  - Título grande del tema
  - Box izquierda (👰 color rosa): Opción Ella + Argumento
  - Box derecha (🤵 color azul): Opción Él + Argumento
  - Sección central: Soluciones propuestas / Compromiso
  - Área de notas mediadoras
  - Botones: "Hemos llegado a acuerdo" | "Necesitamos mediador" | "Pausar"

**Lógica:**
- Si una decisión está en conflicto, aparece aquí automáticamente
- Solo aparecen decisiones con status='conflict'
- Al resolver, se mueve a 'agreed'

---

### ⭐ PRIORIDADES

**Tabla Comparativa:**
- Columna izquierda: Categoría de prioridad
- Columna centro-izquierda: Barra visual (ELLA) + Número
- Columna centro-derecha: Barra visual (ÉL) + Número
- Columna derecha: Diferencia (|x - y|)

**Edición:**
- Sliders interactivos por cada persona y categoría
- Rango 1-10
- Se actualiza la tabla automáticamente
- Posibilidad de agregar prioridades custom

**Análisis:**
- Indicador visual de "Coincidencias" (verde)
- Indicador visual de "Diferencias importantes" (rojo)
- Sugerencia: "Enfócate en los 3 temas donde más se diferencian"

---

### 👥 PAREJA

**Información Editable:**
- Nombre Ella + Nombre Él
- Fecha de boda (con countdown automático)
- Presupuesto total + moneda
- Número estimado de invitados
- Tipo de boda (dropdown)
- Ubicación/Destino

**Estadísticas:**
- Días hasta boda
- Presupuesto por persona
- Presupuesto por invitado
- Progreso general de planificación (%)

**Acciones:**
- Botón para "Comenzar nueva boda" (nueva entrada de datos)
- Botón para "Limpiar todo" (con double-confirmation)

---

### 📊 COMPARADOR (BONUS PESTAÑA)

**Análisis Paralelo:**
- Tabla de "compatibility matrix"
- Muestra puntos de acuerdo
- Muestra puntos de fricción
- Sugiere temas donde pueden ceder/comprometer

**Visualizaciones:**
- Heatmap simple (rojo = conflicto, verde = acuerdo)
- Gráfico de tendencias (mejora el acuerdo con el tiempo?)
- Lista de "Quick Wins" (decisiones fáciles que subirían el acuerdo %)

---

### 📥 EXPORTAR

**Opciones de Descarga:**
1. **JSON completo** - Backup total para restaurar
2. **CSV Decisiones** - Para Excel/Sheets (Tema | Responsable | Categoría | Estado | Opciones | Notas)
3. **PDF Reporte** (si es posible sin librerías)
   - Portada: Nombres + Fecha
   - Resumen: % acuerdo, conflictos, próximas decisiones
   - Lista completa de decisiones
   - Prioridades comparadas

**Importar:**
- Input file que acepte JSON previo
- Validación antes de sobrescribir

---

### ⚙️ CONFIGURACIÓN (OPCIONAL)

- Tema: Light / Dark
- Idioma: Español / English / Portugués
- Resetear datos con confirmación doble
- Ver versión actual
- Información de privacy (todo local)

---

## 6. DISEÑO VISUAL & UX

### Paleta de Colores
```css
Primary (Oro): #d4a574
Secondary (Gris): #4a4a4a
Accent Ella (Rosa suave): #e8b4c4
Accent Él (Azul suave): #a8c5d6
Success (Verde): #8bc34a
Danger (Rojo): #e74c3c
Warning (Naranja): #f39c12
Background: #f5f3f0
Card Background: #faf8f5
Border: #e0dcd6
```

### Tipografía
- Headings: 'Segoe UI' bold
- Body: 'Segoe UI' regular
- Monoespacio para números grandes

### Componentes Principales
1. **Header**: Degradado oro, logo "💍 WEDDING SYNC", tagline
2. **Nav Tabs**: Minimalista, subrayado en primary color
3. **Partner Sections**: Border-top en color de cada uno, sombra suave
4. **Cards**: Blancas, border 1px, hover effect
5. **Botones**: Primary color, hover = más oscuro + shadow
6. **Inputs**: Borde gris, focus = borde primary + shadow
7. **Modals**: Overlay oscuro 40%, white card centered, close button

### Responsividad
- **Desktop (>1024px)**: Dual layout completo
- **Tablet (768px-1023px)**: Dual apilado, nav más compacto
- **Mobile (<768px)**: Single column, nav horizontal scrollable, inputs full-width

---

## 7. INTERACTIVIDAD & COMPORTAMIENTO

### Guardado Automático
- Guardar en localStorage después de CADA cambio
- No pedir confirmación (es local)
- Toast/snackbar silencioso al guardar
- Indicador visual (ej: pequeña animación)

### Validación
- Título de decisión: requerido, min 3 caracteres
- Responsable: requerido (ella/él/compartido)
- Categoría: requerido
- Fecha: formato ISO valido
- Presupuesto: número positivo
- Invitados: número positivo

### Cálculos Automáticos
- Agreement meter = (decisiones acordadas / total decisiones) * 100
- Diferencia de prioridades = |valor ella - valor él|
- Días hasta boda = date difference
- % planificación = (decisiones acordadas / target decisiones) * 100
- Presupuesto por invitado = totalBudget / guestCount

### Notificaciones
- Toast success: "✓ Decisión agregada"
- Toast warning: "⚠️ Hay 3 conflictos por resolver"
- Toast error: "❌ Error al guardar"
- Alert para acciones destructivas (con double-confirmation)

---

## 8. FLUJO DE USO TÍPICO

1. **Primer acceso**
   - Página de "Bienvenida" o auto-navegar a 👥 Pareja
   - Ingresar: Nombres, fecha boda, presupuesto, tipo boda
   - Saltar a Dashboard

2. **Dashboard**
   - Ver estado actual
   - Notar áreas de conflicto (rojo)
   - Clickear en pestaña "Decisiones"

3. **Decisiones**
   - Agregar 10-15 decisiones principales
   - Categorizar cada una
   - Cada uno define sus opciones

4. **Conflictos**
   - Revisar dónde no coinciden
   - Negociar / Encontrar compromiso
   - Marcar como "Acordado"

5. **Prioridades**
   - Slider para entender qué importa a cada uno
   - Descubrir coincidencias ocultas
   - Ajustar expectativas

6. **Exportar**
   - Descargar backup JSON cada semana
   - Compartir CSV con planificador si contratan

---

## 9. FEATURES AVANZADAS (BONUS)

- **Undo/Redo**: Mantener stack de cambios (últimos 20)
- **Modo Oscuro**: Toggle en header
- **Notas de Voz** (opcional): Grabar argumento sobre conflicto
- **Compartir**: Generar URL única (requeriría backend mínimo)
- **Recordatorios**: Mostrar qué decidir cada semana
- **Categorías Custom**: Agregar categorías personalizadas
- **Budget Tracker**: Conectar presupuesto a decisiones
- **Guest List**: Submenú para manejar invitados
- **Timeline**: Gantt chart simple de tareas por mes

---

## 10. TESTING REQUERIDO

- ✅ Guardar y recuperar datos de localStorage
- ✅ Edición inline funciona correctamente
- ✅ Cálculos de acuerdo son precisos
- ✅ Filtros en decisiones funcionan
- ✅ Exportar JSON es valido
- ✅ Exportar CSV abre correctamente en Excel
- ✅ Mobile responsivo en 375px, 768px, 1024px
- ✅ Sin errores en console
- ✅ Funciona sin internet después de primer carga

---

## 11. ARCHIVO DE SALIDA

**Nombre**: `wedding-sync-dashboard.html`  
**Tamaño objetivo**: <250KB (incluyendo CSS + JS inline)  
**Compatibilidad**: Chrome/Firefox/Safari/Edge últimas versiones

---

## 12. PRIORIDAD DE FEATURES

### MVP (Versión 1.0) - CRÍTICO
- ✅ Dashboard dual con contadores
- ✅ Agregar/editar/eliminar decisiones
- ✅ Estados (Pendiente/Conflicto/Acordado)
- ✅ Prioridades con sliders
- ✅ localStorage funcionando
- ✅ Exportar JSON
- ✅ Responsivo básico

### v1.1 - IMPORTANTE
- ⏳ Pestaña Conflictos mejorada
- ⏳ Comparador visual
- ⏳ Exportar CSV
- ⏳ Nombres editables inline
- ⏳ Categorías custom

### v1.2+ - NICE TO HAVE
- 💡 Modo oscuro
- 💡 Undo/Redo
- 💡 Budget tracker
- 💡 Notas de voz
- 💡 PDF reporte

---

## 13. ESTILO DE CÓDIGO

- **Naming**: camelCase para variables/funciones, UPPERCASE para constantes
- **Estructura**: Separar "DATA" | "UI" | "LOGIC" con comentarios claros
- **Comentarios**: Líneas complejas explicadas, no código obvio
- **Funciones**: Máximo 50 líneas, nombres descriptivos
- **Error Handling**: Try-catch donde necesario, validación de inputs
- **Performance**: Minimizar reflows/repaints, evento delegado donde posible

---

## 14. NOTAS FINALES

Este prompt asume que vas a:
1. Crear la estructura HTML con todas las pestañas
2. Aplicar CSS responsive con CSS variables para temas
3. Implementar lógica de localStorage robusta
4. Hacer funciones de CRUD completas
5. Crear funciones de cálculo para acuerdo/estadísticas
6. Exportar/Importar datos
7. Testear en móvil, tablet y desktop

**Objetivo**: Producto profesional, elegante, completamente funcional en UN archivo HTML que pueda venderse en Etsy por $47-67.

---

¿Preguntas antes de comenzar? Adelante cuando estés listo.
