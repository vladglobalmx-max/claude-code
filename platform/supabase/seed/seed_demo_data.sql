-- GAIOS Platform — Datos de demostración (Instrucción Maestra §23)
-- Ejecutar SOLO en ambientes locales/de prueba: `supabase db reset` lo aplica
-- automáticamente después de las migraciones. Diseñado para poder eliminarse
-- por completo antes de producción con un simple `delete from companies;`
-- (el resto de las tablas tiene ON DELETE CASCADE hacia companies).
--
-- Contraseña compartida de los 5 usuarios demo: GaiosDemo2026!
-- (cámbiala inmediatamente si este seed llegara a correr fuera de local/dev).

-- ============================================================
-- 1. Empresa y unidades de negocio
-- ============================================================
insert into companies (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Global Supplier MTY', 'global-supplier-mty');

insert into business_units (company_id, name, slug, description, icon) values
  ('00000000-0000-0000-0000-000000000001', 'Thunder Safety Solutions', 'thunder-safety-solutions', 'Seguridad industrial y equipo de protección.', 'shield'),
  ('00000000-0000-0000-0000-000000000001', 'GTX Systems', 'gtx-systems', 'Redes, CCTV y proyectos de conectividad.', 'network'),
  ('00000000-0000-0000-0000-000000000001', 'Got Fresh Breath', 'got-fresh-breath', 'Dispensadores y consumibles de higiene.', 'wind'),
  ('00000000-0000-0000-0000-000000000001', 'Juno Promotional', 'juno-promotional', 'Productos promocionales y campañas.', 'gift'),
  ('00000000-0000-0000-0000-000000000001', 'The Fire Spot', 'the-fire-spot', 'Distribución mayorista y exhibición.', 'flame');

-- ============================================================
-- 2. Roles de sistema (compartidos, company_id NULL)
-- ============================================================
insert into roles (company_id, key, name, description, is_system) values
  (null, 'superadmin', 'Superadministrador', 'Configura toda la aplicación.', true),
  (null, 'director_general', 'Director General', 'Consulta todas las unidades y aprueba propuestas.', true),
  (null, 'director_comercial', 'Director Comercial', 'Administra clientes, oportunidades y vendedores.', true),
  (null, 'vendedor', 'Vendedor', 'Gestiona su cartera de clientes y oportunidades.', true),
  (null, 'marketing', 'Marketing', 'Herramientas de contenido y campañas.', true),
  (null, 'operaciones', 'Operaciones', 'Documentos técnicos y agentes operativos.', true),
  (null, 'admin_ia', 'Administrador de IA', 'Crea y versiona agentes, herramientas y prompts.', true);

-- ============================================================
-- 3. Usuarios demo (auth.users + public.users)
-- ============================================================
do $$
declare
  v_company_id uuid := '00000000-0000-0000-0000-000000000001';
  v_password text := crypt('GaiosDemo2026!', gen_salt('bf'));
  v_user record;
  v_new_id uuid;
begin
  for v_user in
    select * from (values
      ('ana.torres@globalsuppliermty.com', 'Ana Torres', 'superadmin'),
      ('carlos.medina@globalsuppliermty.com', 'Carlos Medina', 'director_general'),
      ('laura.gonzalez@globalsuppliermty.com', 'Laura González', 'director_comercial'),
      ('diego.ramirez@globalsuppliermty.com', 'Diego Ramírez', 'vendedor'),
      ('sofia.hernandez@globalsuppliermty.com', 'Sofía Hernández', 'marketing')
    ) as t(email, full_name, role_key)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      v_user.email, v_password, now(), now(), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_user.full_name)
    )
    returning id into v_new_id;

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', v_user.email),
      'email', v_new_id::text, now(), now(), now()
    );

    insert into public.users (id, company_id, role_id, full_name, email, status)
    values (
      v_new_id, v_company_id,
      (select id from roles where key = v_user.role_key and company_id is null),
      v_user.full_name, v_user.email, 'active'
    );

    insert into user_business_units (user_id, business_unit_id)
    select v_new_id, id from business_units where company_id = v_company_id;
  end loop;
end $$;

-- ============================================================
-- 4. Clientes (2 por unidad de negocio = 10) y contactos
-- ============================================================
insert into clients (company_id, business_unit_id, legal_name, trade_name, industry, size, city, state, country, status, source, owner_id, notes)
select
  '00000000-0000-0000-0000-000000000001',
  bu.id,
  c.legal_name, c.trade_name, c.industry, c.size, c.city, 'Nuevo León', 'México', c.status, c.source,
  (select id from users where email = 'diego.ramirez@globalsuppliermty.com'),
  c.notes
from (values
  ('thunder-safety-solutions', 'Acería Regiomontana S.A. de C.V.', 'Acería Regiomontana', 'Manufactura', 'Corporativo', 'Monterrey', 'active', 'referido', 'Cliente recurrente de EPP.'),
  ('thunder-safety-solutions', 'Constructora del Norte', 'Constructora del Norte', 'Construcción', 'PyME', 'San Nicolás', 'prospect', 'feria', 'Evaluando cambio de proveedor de seguridad.'),
  ('gtx-systems', 'Hospital San Rafael', 'Hospital San Rafael', 'Salud', 'Corporativo', 'Monterrey', 'active', 'licitación', 'Proyecto de CCTV en expansión.'),
  ('gtx-systems', 'Grupo Educativo Sierra', 'Grupo Educativo Sierra', 'Educación', 'Corporativo', 'San Pedro', 'prospect', 'web', 'Interesados en Wi-Fi de campus.'),
  ('got-fresh-breath', 'Hotel Real del Valle', 'Hotel Real del Valle', 'Hospitalidad', 'PyME', 'Monterrey', 'active', 'referido', 'Prueba piloto de dispensadores en curso.'),
  ('got-fresh-breath', 'Universidad Tecnológica MTY', 'UTM', 'Educación', 'Corporativo', 'Monterrey', 'prospect', 'evento', null),
  ('juno-promotional', 'Banco Industrial Regio', 'BIR', 'Financiero', 'Corporativo', 'Monterrey', 'active', 'referido', 'Campaña de fin de año recurrente.'),
  ('juno-promotional', 'Distribuidora Cinco Estrellas', 'Cinco Estrellas', 'Retail', 'PyME', 'Guadalupe', 'prospect', 'web', null),
  ('the-fire-spot', 'Súper Abarrotes del Norte', 'Abarrotes del Norte', 'Retail', 'PyME', 'Apodaca', 'active', 'referido', 'Distribuidor mayorista activo.'),
  ('the-fire-spot', 'Cadena Comercial Fénix', 'Comercial Fénix', 'Retail', 'Corporativo', 'Monterrey', 'prospect', 'feria', 'Evaluando volumen para exhibidores.')
) as c(bu_slug, legal_name, trade_name, industry, size, city, status, source, notes)
join business_units bu on bu.slug = c.bu_slug and bu.company_id = '00000000-0000-0000-0000-000000000001';

insert into contacts (company_id, client_id, name, position, email, phone, decision_level)
select '00000000-0000-0000-0000-000000000001', cl.id, ct.name, ct.position, ct.email, ct.phone, ct.decision_level
from (values
  ('Acería Regiomontana', 'Roberto Salinas', 'Gerente de Seguridad', 'r.salinas@aceriaregio.mx', '8181234501', 'decisor'),
  ('Hospital San Rafael', 'Marina Cepeda', 'Directora de TI', 'm.cepeda@sanrafael.mx', '8181234502', 'decisor'),
  ('Hotel Real del Valle', 'Jorge Villanueva', 'Gerente General', 'j.villanueva@realdelvalle.mx', '8181234503', 'decisor'),
  ('Banco Industrial Regio', 'Patricia Leal', 'Marketing Corporativo', 'p.leal@bir.mx', '8181234504', 'influenciador'),
  ('Súper Abarrotes del Norte', 'Hector Garza', 'Comprador', 'h.garza@abarrotesnorte.mx', '8181234505', 'decisor')
) as ct(client_trade_name, name, position, email, phone, decision_level)
join clients cl on cl.trade_name = ct.client_trade_name and cl.company_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 5. Oportunidades (15, distribuidas en varias etapas)
-- ============================================================
insert into opportunities (company_id, business_unit_id, client_id, name, owner_id, estimated_value, estimated_margin, stage, probability, expected_close_date, last_activity_at)
select
  '00000000-0000-0000-0000-000000000001',
  cl.business_unit_id, cl.id, o.name,
  (select id from users where email = 'diego.ramirez@globalsuppliermty.com'),
  o.value, o.margin, o.stage, o.probability, current_date + (o.days_out || ' days')::interval, now() - (o.days_ago || ' days')::interval
from (values
  ('Acería Regiomontana', 'Renovación EPP anual', 450000, 22, 'negociacion', 70, 20, 2),
  ('Constructora del Norte', 'Equipo de seguridad para 3 obras', 180000, 18, 'diagnostico', 30, 45, 5),
  ('Hospital San Rafael', 'Expansión CCTV ala oeste', 620000, 25, 'propuesta', 55, 30, 3),
  ('Grupo Educativo Sierra', 'Wi-Fi campus principal', 340000, 20, 'calificado', 25, 60, 8),
  ('Hotel Real del Valle', 'Dispensadores todas las habitaciones', 95000, 30, 'prueba_piloto', 65, 15, 1),
  ('Universidad Tecnológica MTY', 'Plan de suministro semestral', 210000, 22, 'contactado', 15, 90, 10),
  ('Banco Industrial Regio', 'Kit promocional fin de año', 140000, 28, 'cierre_ganado', 100, -5, 0),
  ('Distribuidora Cinco Estrellas', 'Merchandising primer pedido', 60000, 24, 'prospecto', 10, 75, 12),
  ('Súper Abarrotes del Norte', 'Combo mayorista trimestral', 88000, 20, 'negociacion', 60, 10, 2),
  ('Cadena Comercial Fénix', 'Exhibidores 12 sucursales', 260000, 26, 'propuesta', 45, 25, 4),
  ('Acería Regiomontana', 'Capacitación de seguridad Q3', 45000, 35, 'seguimiento_futuro', 20, 120, 20),
  ('Hospital San Rafael', 'Mantenimiento anual CCTV', 90000, 30, 'cierre_perdido', 0, -10, 15),
  ('Hotel Real del Valle', 'Ampliación a 2 sucursales más', 130000, 28, 'diagnostico', 35, 50, 6),
  ('Grupo Educativo Sierra', 'Cámaras en accesos', 175000, 24, 'calificado', 28, 55, 9),
  ('Constructora del Norte', 'Señalización de obra', 52000, 20, 'contactado', 15, 40, 7)
) as o(client_trade_name, name, value, margin, stage, probability, days_out, days_ago)
join clients cl on cl.trade_name = o.client_trade_name and cl.company_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 6. Seguimientos (20)
-- ============================================================
insert into followups (company_id, business_unit_id, client_id, user_id, type, scheduled_at, priority, status, description)
select
  '00000000-0000-0000-0000-000000000001', cl.business_unit_id, cl.id,
  (select id from users where email = 'diego.ramirez@globalsuppliermty.com'),
  f.type, now() + (f.offset_hours || ' hours')::interval, f.priority, f.status, f.description
from (values
  ('Acería Regiomontana', 'llamada', -48, 'alta', 'pendiente', 'Confirmar condiciones de pago antes de firmar.'),
  ('Constructora del Norte', 'correo', -24, 'media', 'pendiente', 'Enviar catálogo actualizado.'),
  ('Hospital San Rafael', 'reunion', 4, 'alta', 'pendiente', 'Presentación de propuesta técnica.'),
  ('Grupo Educativo Sierra', 'llamada', 6, 'media', 'pendiente', 'Levantamiento de requerimientos de red.'),
  ('Hotel Real del Valle', 'visita', -72, 'alta', 'pendiente', 'Revisar resultados de la prueba piloto.'),
  ('Universidad Tecnológica MTY', 'whatsapp', 26, 'baja', 'pendiente', 'Recordatorio de reunión de la próxima semana.'),
  ('Banco Industrial Regio', 'correo', -1, 'media', 'completado', 'Envío de factura y agradecimiento.'),
  ('Distribuidora Cinco Estrellas', 'llamada', 30, 'media', 'pendiente', 'Primer contacto post-feria.'),
  ('Súper Abarrotes del Norte', 'visita', 3, 'alta', 'pendiente', 'Cierre de negociación en sitio.'),
  ('Cadena Comercial Fénix', 'reunion', 48, 'media', 'pendiente', 'Presentación a comité de compras.'),
  ('Acería Regiomontana', 'cotizacion', -96, 'baja', 'completado', 'Cotización de capacitación enviada.'),
  ('Hospital San Rafael', 'revision_tecnica', -120, 'media', 'completado', 'Diagnóstico de infraestructura de red.'),
  ('Hotel Real del Valle', 'llamada', 10, 'media', 'pendiente', 'Explorar ampliación a otras sucursales.'),
  ('Grupo Educativo Sierra', 'correo', -12, 'baja', 'pendiente', 'Enviar comparativo de cámaras.'),
  ('Constructora del Norte', 'whatsapp', -6, 'alta', 'pendiente', 'Confirmar visita a obra el viernes.'),
  ('Distribuidora Cinco Estrellas', 'reunion', 72, 'baja', 'pendiente', 'Reunión de seguimiento de merchandising.'),
  ('Banco Industrial Regio', 'llamada', 200, 'baja', 'pendiente', 'Explorar campaña de aniversario 2027.'),
  ('Súper Abarrotes del Norte', 'correo', -200, 'media', 'completado', 'Envío de condiciones comerciales.'),
  ('Cadena Comercial Fénix', 'visita', -50, 'media', 'pendiente', 'Visitar 3 sucursales piloto.'),
  ('Universidad Tecnológica MTY', 'reunion', -30, 'alta', 'pendiente', 'Reunión con comité de compras (vencida).')
) as f(client_trade_name, type, offset_hours, priority, status, description)
join clients cl on cl.trade_name = f.client_trade_name and cl.company_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 7. Prompts + Agentes + las 5 Herramientas funcionales (Instrucción Maestra §22)
--    Los output_schema replican (en JSON Schema) los Zod schemas de
--    src/lib/ai/schemas/index.ts — deben mantenerse sincronizados.
-- ============================================================
insert into prompts (id, company_id, name, code, objective, system_prompt, user_prompt_template, variables, output_schema, model, temperature, status, created_by)
values
(
  'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'Investigación de prospectos', 'TOOL_PROSPECT_RESEARCH',
  'Investigar una empresa prospecto antes del primer contacto comercial.',
  'Eres un analista de inteligencia comercial B2B para Global Supplier MTY, una empresa que vende seguridad industrial, redes/CCTV, higiene, promocionales y productos de distribución mayorista en México. Analiza al prospecto con base en la información proporcionada. No inventes datos que no puedas inferir razonablemente; si falta información, indícalo dentro del campo correspondiente en vez de omitirlo.',
  'Investiga a este prospecto:\nEmpresa: {{company}}\nIndustria: {{industry}}\nCiudad: {{city}}\nSitio web: {{website}}\nComentarios adicionales: {{comments}}',
  '[{"name":"company","type":"string","required":true},{"name":"industry","type":"string"},{"name":"city","type":"string"},{"name":"website","type":"string"},{"name":"comments","type":"string"}]',
  '{"type":"object","required":["summary","industry","pain_points","recommended_solutions"],"properties":{"summary":{"type":"string"},"industry":{"type":"string"},"company_size_estimate":{"type":"string"},"pain_points":{"type":"array","items":{"type":"string"}},"recommended_solutions":{"type":"array","items":{"type":"string"}},"discovery_questions":{"type":"array","items":{"type":"string"}},"risk_level":{"enum":["bajo","medio","alto"]},"next_action":{"type":"string"}}}',
  'claude-sonnet-5', 0.40, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
  'Preparación de visita comercial', 'TOOL_VISIT_PREP',
  'Preparar a un vendedor antes de una visita o reunión comercial.',
  'Eres un coach de ventas B2B senior para Global Supplier MTY. A partir de los datos de la cuenta, prepara al vendedor con un plan de reunión accionable, honesto sobre riesgos reales, sin inflar la probabilidad de cierre sin evidencia.',
  'Prepara la visita:\nEmpresa: {{company}}\nIndustria: {{industry}}\nCiudad: {{city}}\nContacto: {{contact_name}} ({{contact_position}})\nMotivo de la visita: {{visit_reason}}\nSolución de interés: {{solution_interest}}\nHistorial previo: {{history}}\nComentarios: {{comments}}',
  '[{"name":"company","type":"string","required":true},{"name":"industry","type":"string"},{"name":"city","type":"string"},{"name":"contact_name","type":"string"},{"name":"contact_position","type":"string"},{"name":"visit_reason","type":"string","required":true},{"name":"solution_interest","type":"string"},{"name":"history","type":"string"},{"name":"comments","type":"string"}]',
  '{"type":"object","required":["summary","recommended_solutions","closing_strategy"],"properties":{"summary":{"type":"string"},"industry":{"type":"string"},"pain_points":{"type":"array","items":{"type":"string"}},"recommended_solutions":{"type":"array","items":{"type":"string"}},"discovery_questions":{"type":"array","items":{"type":"string"}},"objections":{"type":"array","items":{"type":"string"}},"roi_arguments":{"type":"array","items":{"type":"string"}},"closing_strategy":{"type":"string"},"next_action":{"type":"string"},"risk_level":{"enum":["bajo","medio","alto"]},"closing_probability":{"type":"number"}}}',
  'claude-sonnet-5', 0.45, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
  'Seguimiento comercial', 'TOOL_FOLLOW_UP',
  'Redactar el siguiente contacto con un prospecto u oportunidad estancada.',
  'Eres un asistente de ventas B2B para Global Supplier MTY. Redacta mensajes de seguimiento persuasivos pero no agresivos, con un llamado a la acción claro.',
  'Genera el seguimiento:\nEmpresa: {{company}}\nÚltimo contacto: {{last_contact}}\nEstado actual: {{status}}\nObjetivo del seguimiento: {{goal}}\nComentarios: {{comments}}',
  '[{"name":"company","type":"string","required":true},{"name":"last_contact","type":"string"},{"name":"status","type":"string"},{"name":"goal","type":"string","required":true},{"name":"comments","type":"string"}]',
  '{"type":"object","required":["message_draft","recommended_channel"],"properties":{"summary":{"type":"string"},"recommended_channel":{"enum":["llamada","correo","whatsapp","visita"]},"message_draft":{"type":"string"},"objections_to_anticipate":{"type":"array","items":{"type":"string"}},"next_action":{"type":"string"},"suggested_follow_up_date":{"type":"string"}}}',
  'claude-sonnet-5', 0.5, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
  'Generación de propuesta', 'TOOL_PROPOSAL_GEN',
  'Generar el borrador de una propuesta comercial formal.',
  'Eres un redactor de propuestas comerciales B2B para Global Supplier MTY. Estructura propuestas claras, orientadas a resultados, sin inventar precios ni condiciones que no se proporcionen.',
  'Genera la propuesta:\nEmpresa: {{company}}\nSolución: {{solution}}\nNecesidades del cliente: {{needs}}\nPresupuesto estimado: {{budget}}\nCondiciones especiales: {{terms}}',
  '[{"name":"company","type":"string","required":true},{"name":"solution","type":"string","required":true},{"name":"needs","type":"string"},{"name":"budget","type":"string"},{"name":"terms","type":"string"}]',
  '{"type":"object","required":["title","executive_summary","proposed_solution"],"properties":{"title":{"type":"string"},"executive_summary":{"type":"string"},"client_needs":{"type":"array","items":{"type":"string"}},"proposed_solution":{"type":"array","items":{"type":"string"}},"roi_arguments":{"type":"array","items":{"type":"string"}},"investment_summary":{"type":"string"},"terms_and_conditions":{"type":"array","items":{"type":"string"}},"next_action":{"type":"string"}}}',
  'claude-sonnet-5', 0.4, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
  'Análisis de oportunidad', 'TOOL_OPPORTUNITY_ANALYSIS',
  'Evaluar la salud y probabilidad de cierre de una oportunidad activa.',
  'Eres un director comercial B2B analizando el pipeline de Global Supplier MTY. Evalúa la oportunidad de forma realista, señalando riesgos aunque no sean cómodos de leer.',
  'Analiza la oportunidad:\nNombre: {{opportunity_name}}\nEtapa actual: {{stage}}\nValor estimado: {{value}}\nÚltima actividad: {{last_activity}}\nCompetidores conocidos: {{competitors}}\nObjeciones registradas: {{objections}}',
  '[{"name":"opportunity_name","type":"string","required":true},{"name":"stage","type":"string"},{"name":"value","type":"string"},{"name":"last_activity","type":"string"},{"name":"competitors","type":"string"},{"name":"objections","type":"string"}]',
  '{"type":"object","required":["summary","closing_probability"],"properties":{"summary":{"type":"string"},"strengths":{"type":"array","items":{"type":"string"}},"risks":{"type":"array","items":{"type":"string"}},"competitors_detected":{"type":"array","items":{"type":"string"}},"recommended_stage":{"type":"string"},"closing_probability":{"type":"number"},"next_action":{"type":"string"}}}',
  'claude-sonnet-5', 0.35, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
-- System prompts de los 5 agentes conversacionales de demo
(
  'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'System prompt — GAIOS Assistant', 'AGENT_GAIOS_ASSISTANT', 'Asistente general de la plataforma.',
  'Eres GAIOS Assistant, el asistente general de Global Supplier MTY. Ayudas a navegar la plataforma, resumir información comercial y sugerir qué herramienta usar para cada necesidad. Si el usuario pide algo que requiere una herramienta específica (investigar un prospecto, preparar una visita, generar una propuesta, dar seguimiento o analizar una oportunidad), indícale cuál usar en vez de intentar reemplazarla.',
  'N/A — conversacional', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.6, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
  'System prompt — Sales AI', 'AGENT_SALES_AI', 'Agente especializado en ventas.',
  'Eres Sales AI de Global Supplier MTY, un copiloto conversacional para el equipo comercial. Ayudas a preparar llamadas, redactar correos y pensar en voz alta sobre estrategia de cuentas. Eres directo y basado en evidencia, no motivacional vacío.',
  'N/A — conversacional', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.55, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
  'System prompt — Marketing AI', 'AGENT_MARKETING_AI', 'Agente especializado en marketing.',
  'Eres Marketing AI de Global Supplier MTY. Ayudas a generar ideas de contenido y campañas para las 5 unidades de negocio, siempre anclado a casos de uso reales del catálogo de la empresa.',
  'N/A — conversacional', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.6, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
  'System prompt — Technical AI', 'AGENT_TECHNICAL_AI', 'Agente especializado en soporte técnico/operativo.',
  'Eres Technical AI de Global Supplier MTY, enfocado en las unidades técnicas (GTX Systems, Thunder Safety Solutions). Ayudas con levantamientos, comparativas técnicas y documentación de proyectos.',
  'N/A — conversacional', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.4, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
),
(
  'b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
  'System prompt — Follow-up AI', 'AGENT_FOLLOWUP_AI', 'Agente especializado en seguimiento comercial.',
  'Eres Follow-up AI de Global Supplier MTY. Ayudas a los vendedores a decidir cómo y cuándo dar seguimiento a una cuenta, priorizando por riesgo de pérdida y valor.',
  'N/A — conversacional', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.5, 'active', (select id from users where email = 'ana.torres@globalsuppliermty.com')
);

insert into agents (company_id, name, slug, description, icon, objective, system_prompt_id, model, temperature, allowed_roles, status)
values
('00000000-0000-0000-0000-000000000001', 'GAIOS Assistant', 'gaios-assistant', 'Asistente general de la plataforma.', 'sparkles', 'Orientar y resumir', 'b0000000-0000-0000-0000-000000000001', 'claude-sonnet-5', 0.6, '{}', 'active'),
('00000000-0000-0000-0000-000000000001', 'Sales AI', 'sales-ai', 'Copiloto conversacional de ventas.', 'trending-up', 'Apoyar al equipo comercial', 'b0000000-0000-0000-0000-000000000002', 'claude-sonnet-5', 0.55, '{director_comercial,vendedor,director_general,superadmin}', 'active'),
('00000000-0000-0000-0000-000000000001', 'Marketing AI', 'marketing-ai', 'Ideas de contenido y campañas.', 'megaphone', 'Apoyar a marketing', 'b0000000-0000-0000-0000-000000000003', 'claude-sonnet-5', 0.6, '{marketing,director_general,superadmin}', 'active'),
('00000000-0000-0000-0000-000000000001', 'Technical AI', 'technical-ai', 'Soporte técnico y de proyectos.', 'cpu', 'Apoyar a operaciones', 'b0000000-0000-0000-0000-000000000004', 'claude-sonnet-5', 0.4, '{operaciones,director_general,superadmin}', 'active'),
('00000000-0000-0000-0000-000000000001', 'Follow-up AI', 'followup-ai', 'Prioriza y redacta seguimientos.', 'calendar-clock', 'Apoyar el seguimiento comercial', 'b0000000-0000-0000-0000-000000000005', 'claude-sonnet-5', 0.5, '{director_comercial,vendedor,director_general,superadmin}', 'active');

insert into tools (company_id, name, slug, description, category, input_schema, output_schema, prompt_id, allowed_roles, status)
values
(
  '00000000-0000-0000-0000-000000000001', 'Investigación de prospectos', 'investigacion-prospectos',
  'Analiza una empresa antes del primer contacto.', 'Comercial',
  '{"fields":[{"name":"company","label":"Empresa","type":"text","required":true},{"name":"industry","label":"Industria","type":"text"},{"name":"city","label":"Ciudad","type":"text"},{"name":"website","label":"Sitio web","type":"text"},{"name":"comments","label":"Comentarios adicionales","type":"textarea"}]}',
  '{"type":"object"}', 'a0000000-0000-0000-0000-000000000001', '{director_comercial,vendedor,director_general,superadmin}', 'active'
),
(
  '00000000-0000-0000-0000-000000000001', 'Preparación de visita', 'preparacion-visita',
  'Prepara la reunión con contexto, preguntas y estrategia de cierre.', 'Comercial',
  '{"fields":[{"name":"company","label":"Empresa","type":"text","required":true},{"name":"industry","label":"Industria","type":"text"},{"name":"city","label":"Ciudad","type":"text"},{"name":"contact_name","label":"Nombre del contacto","type":"text"},{"name":"contact_position","label":"Puesto","type":"text"},{"name":"visit_reason","label":"Motivo de la visita","type":"textarea","required":true},{"name":"solution_interest","label":"Solución de interés","type":"text"},{"name":"history","label":"Historial previo","type":"textarea"},{"name":"comments","label":"Comentarios adicionales","type":"textarea"}]}',
  '{"type":"object"}', 'a0000000-0000-0000-0000-000000000002', '{director_comercial,vendedor,director_general,superadmin}', 'active'
),
(
  '00000000-0000-0000-0000-000000000001', 'Seguimiento comercial', 'seguimiento-comercial',
  'Redacta el siguiente mensaje de seguimiento.', 'Comercial',
  '{"fields":[{"name":"company","label":"Empresa","type":"text","required":true},{"name":"last_contact","label":"Último contacto","type":"text"},{"name":"status","label":"Estado actual","type":"text"},{"name":"goal","label":"Objetivo del seguimiento","type":"textarea","required":true},{"name":"comments","label":"Comentarios","type":"textarea"}]}',
  '{"type":"object"}', 'a0000000-0000-0000-0000-000000000003', '{director_comercial,vendedor,director_general,superadmin}', 'active'
),
(
  '00000000-0000-0000-0000-000000000001', 'Generación de propuesta', 'generacion-propuesta',
  'Genera el borrador de una propuesta comercial.', 'Comercial',
  '{"fields":[{"name":"company","label":"Empresa","type":"text","required":true},{"name":"solution","label":"Solución","type":"text","required":true},{"name":"needs","label":"Necesidades del cliente","type":"textarea"},{"name":"budget","label":"Presupuesto estimado","type":"text"},{"name":"terms","label":"Condiciones especiales","type":"textarea"}]}',
  '{"type":"object"}', 'a0000000-0000-0000-0000-000000000004', '{director_comercial,vendedor,director_general,superadmin}', 'active'
),
(
  '00000000-0000-0000-0000-000000000001', 'Análisis de oportunidad', 'analisis-oportunidad',
  'Evalúa la salud y probabilidad de cierre de una oportunidad.', 'Comercial',
  '{"fields":[{"name":"opportunity_name","label":"Nombre de la oportunidad","type":"text","required":true},{"name":"stage","label":"Etapa actual","type":"text"},{"name":"value","label":"Valor estimado","type":"text"},{"name":"last_activity","label":"Última actividad","type":"text"},{"name":"competitors","label":"Competidores conocidos","type":"text"},{"name":"objections","label":"Objeciones registradas","type":"textarea"}]}',
  '{"type":"object"}', 'a0000000-0000-0000-0000-000000000005', '{director_comercial,vendedor,director_general,superadmin}', 'active'
);

-- ============================================================
-- 8. Resto del catálogo de herramientas (§9) como borrador
--    Pendientes de que el Administrador de IA defina su prompt real —
--    no se marcan "active" para no simular una funcionalidad que no existe.
-- ============================================================
insert into prompts (id, company_id, name, code, objective, system_prompt, user_prompt_template, variables, output_schema, model, temperature, status, created_by)
values (
  'a0000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001',
  'Borrador pendiente de definición', 'DRAFT_PLACEHOLDER', 'Placeholder — pendiente de autoría por el Administrador de IA.',
  'PENDIENTE: este prompt aún no ha sido redactado.', 'PENDIENTE', '[]', '{"type":"object"}', 'claude-sonnet-5', 0.5, 'draft',
  (select id from users where email = 'ana.torres@globalsuppliermty.com')
);

insert into tools (company_id, name, slug, description, category, input_schema, output_schema, prompt_id, allowed_roles, status)
select '00000000-0000-0000-0000-000000000001', t.name, t.slug, 'Pendiente de definición por el Administrador de IA.', t.category,
  '{"fields":[]}', '{"type":"object"}', 'a0000000-0000-0000-0000-000000000099', '{}', 'inactive'
from (values
  ('Análisis de necesidades', 'analisis-necesidades', 'Comercial'),
  ('Recomendación de solución', 'recomendacion-solucion', 'Comercial'),
  ('Cálculo de ROI', 'calculo-roi', 'Comercial'),
  ('Generación de correo inicial', 'correo-inicial', 'Comercial'),
  ('Generación de WhatsApp', 'whatsapp-inicial', 'Comercial'),
  ('Manejo de objeciones', 'manejo-objeciones', 'Comercial'),
  ('Recuperación de cotización', 'recuperacion-cotizacion', 'Comercial'),
  ('Venta cruzada', 'venta-cruzada', 'Comercial'),
  ('Comparación de productos', 'comparacion-productos', 'Comercial'),
  ('Análisis de competencia', 'analisis-competencia', 'Comercial'),
  ('Resumen de reunión', 'resumen-reunion', 'Comercial'),
  ('Generación de próxima acción', 'proxima-accion', 'Comercial'),
  ('Evaluación de probabilidad de cierre', 'evaluacion-cierre', 'Comercial'),
  ('Reporte del vendedor', 'reporte-vendedor', 'Reporting'),
  ('Reporte ejecutivo', 'reporte-ejecutivo', 'Reporting')
) as t(name, slug, category);
