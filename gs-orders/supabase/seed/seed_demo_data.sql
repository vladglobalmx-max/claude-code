-- GS Orders — datos de arranque: vendedores de ejemplo (Thunder).
insert into salespeople (business_unit, name, prefix, sequence_current, active)
values
  ('thunder', 'Vladimir Peña', 'VPT', 0, true),
  ('thunder', 'Karla Solís', 'KST', 0, true)
on conflict do nothing;
