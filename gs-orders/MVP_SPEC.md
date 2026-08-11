# GS Orders — MVP Spec (Thunder)

Aplicación interna de Global Supplier MTY para generar, guardar, consultar,
editar, duplicar e imprimir pedidos internos que se envían a proveedores y
fábricas. Primera unidad de negocio: **Thunder Safety Solutions / Thunder LED
Lights**. No es un ERP: sin inventario, facturación, costos, CRM, ni reportes
avanzados.

## Stack
Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres,
Auth, Storage) + Vercel. Interfaz en español. Desktop-first, responsive.

## Módulos
1. **Vendedores** — catálogo simple: nombre, prefijo (único), consecutivo
   actual, activo/inactivo.
2. **Folios** — `[PREFIJO]-[AAAADDMM]-[CONSECUTIVO]`, ej. `VPT-20261108-001`.
   AAAADDMM = año + día + mes (NO AAAAMMDD). El consecutivo es propio de cada
   vendedor, nunca se reinicia, se genera de forma atómica en la base de
   datos (row lock) y es inmutable una vez creado. El usuario nunca lo
   escribe ni lo edita.
3. **Pedidos** — datos generales (fecha, vendedor, cliente, proveedor, tipo de
   producto, estado, observaciones), uno o varios productos (imagen, modelo,
   descripción, cantidad, observaciones), imágenes y archivos adjuntos,
   observaciones para proveedor/fábrica. Estados: Borrador, Pedido, Cerrado,
   Cancelado.
4. **Proyector / GOBO** — sección adicional cuando el tipo de producto es
   Proyector/GOBO: equipo (modelo, cantidad, potencia, lente), imagen a
   proyectar (jpg/png/pdf/svg + preview), medidas de proyección, instalación
   (altura, distancia, orientación, uso), superficie, fotografías del área.
   Antes de marcar como "Pedido" se valida que existan los campos críticos;
   si falta algo se lista pero SÍ se permite guardar como Borrador.
5. **Listado** — tabla (Folio, Fecha, Vendedor, Cliente, Tipo, Estado,
   Acciones: Ver/Editar/Duplicar/PDF), buscador (folio/cliente/vendedor),
   filtros (vendedor/estado/tipo).
6. **Duplicar** — copia todo el contenido del pedido pero genera folio, fecha
   y consecutivo nuevos. Nunca reutiliza el folio original.
7. **PDF** — vista imprimible profesional y limpia (impresión del navegador),
   con folio muy visible, datos generales, especificaciones técnicas,
   imagen a proyectar, galería de fotografías y observaciones.

## Base de datos
`salespeople`, `orders`, `order_items`, `order_images`, `order_files`, todas
con `created_at`/`updated_at`. `business_unit` en `salespeople` y `orders`
(default `thunder`) para soportar a futuro Juno Promotional, Got Fresh
Breath y The Fire Spot — sin construir todavía sus formularios.

## Seguridad
Supabase Auth, usuarios autenticados pueden usar la app (sin roles por
ahora). RLS activo en todas las tablas, preparado para agregar roles
después.

## Fuera de alcance (MVP)
CRM, inventarios, facturación, contabilidad, costos, márgenes, pagos,
cobranza, compras avanzadas, logística, autorizaciones, reportes avanzados,
dashboard ejecutivo, notificaciones, emails/WhatsApp automáticos, IA,
integraciones externas.
