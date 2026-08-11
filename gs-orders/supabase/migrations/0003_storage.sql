-- GS Orders — Migración 0003: Storage
-- Dos buckets privados: order-media (imagen de producto, imagen a proyectar,
-- fotografías del área) y order-files (archivos adjuntos). El acceso real se
-- resuelve siempre desde el servidor (service role) para mantener el MVP
-- simple; estas policies solo cubren lectura/escritura directa desde el
-- cliente autenticado por si se usa en el futuro.

insert into storage.buckets (id, name, public)
values
  ('order-media', 'order-media', false),
  ('order-files', 'order-files', false)
on conflict (id) do nothing;

create policy "order_media_authenticated_all"
  on storage.objects for all
  using (bucket_id = 'order-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'order-media' and auth.role() = 'authenticated');

create policy "order_files_authenticated_all"
  on storage.objects for all
  using (bucket_id = 'order-files' and auth.role() = 'authenticated')
  with check (bucket_id = 'order-files' and auth.role() = 'authenticated');
