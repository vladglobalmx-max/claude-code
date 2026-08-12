-- GS Orders — datos de arranque SOLO para desarrollo: vendedores de ejemplo
-- (Thunder). Sin información sensible ni real de clientes/proveedores.
insert into salespeople (business_unit, name, prefix, sequence_current, active)
values
  ('thunder', 'Vladimir Peña', 'VPT', 0, true),
  ('thunder', 'Karla Saucedo', 'KST', 0, true)
on conflict do nothing;
