# GAIOS Platform

Aplicación web empresarial para Global Supplier MTY — agentes de IA, herramientas comerciales, CRM y base de conocimiento sobre Next.js + Supabase + Claude API.

**Estado actual:** Fase de arquitectura (sin scaffold de código todavía). Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para la propuesta completa: stack, estructura de carpetas, esquema de base de datos, rutas, componentes, dependencias y riesgos.

Las migraciones SQL de la Fase 1 están en [`supabase/migrations/`](supabase/migrations/), numeradas en orden de aplicación:

1. `0001_core_company_users.sql` — empresas, unidades de negocio, roles, usuarios
2. `0002_crm.sql` — clientes, contactos, oportunidades, seguimientos
3. `0003_ai_agents_tools_prompts.sql` — prompts versionados, agentes, herramientas
4. `0004_conversations_executions.sql` — conversaciones e historial de ejecución
5. `0005_knowledge_documents.sql` — base de conocimiento (preparado para búsqueda semántica)
6. `0006_audit.sql` — auditoría
7. `0007_rls_policies.sql` — políticas de aislamiento por empresa (Row Level Security)

El scaffold de la aplicación (Next.js + design system + integración con Claude) se genera después de validar esta arquitectura.
