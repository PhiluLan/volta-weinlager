create extension if not exists "pgcrypto";

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'betrieb' check (kind in ('zentrallager', 'betrieb')),
  created_at timestamptz not null default now()
);

create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  producer text,
  vintage text,
  bottle_size_l numeric(4,2),
  cartons_per_case integer,
  purchase_price numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, producer, vintage)
);

create table if not exists public.stock_balances (
  wine_id uuid not null references public.wines(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  cartons integer not null default 0 check (cartons >= 0),
  updated_at timestamptz not null default now(),
  primary key (wine_id, location_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references public.wines(id),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  cartons integer not null check (cartons > 0),
  movement_type text not null check (movement_type in ('wareneingang', 'ausgabe', 'inventur', 'korrektur')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

insert into public.locations (name, kind) values
  ('Zentrallager', 'zentrallager'), ('VB', 'betrieb'), ('Consum', 'betrieb'),
  ('Nomad', 'betrieb'), ('Krafft', 'betrieb'), ('Silo', 'betrieb')
on conflict (name) do nothing;

alter table public.locations enable row level security;
alter table public.wines enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

create policy "authenticated users can read locations" on public.locations for select to authenticated using (true);
create policy "authenticated users can read wines" on public.wines for select to authenticated using (true);
create policy "authenticated users can read balances" on public.stock_balances for select to authenticated using (true);
create policy "authenticated users can read movements" on public.stock_movements for select to authenticated using (true);
create policy "authenticated users can write movements" on public.stock_movements for insert to authenticated with check (auth.uid() = created_by);

revoke all on table public.locations, public.wines, public.stock_balances, public.stock_movements from anon;
grant select on table public.locations, public.wines, public.stock_balances, public.stock_movements to authenticated;
grant insert, update on table public.stock_balances to authenticated;
grant insert on table public.stock_movements to authenticated;

create index if not exists idx_stock_balances_location_id on public.stock_balances(location_id);
create index if not exists idx_stock_movements_created_by on public.stock_movements(created_by);
create index if not exists idx_stock_movements_from_location_id on public.stock_movements(from_location_id);
create index if not exists idx_stock_movements_to_location_id on public.stock_movements(to_location_id);
create index if not exists idx_stock_movements_wine_id on public.stock_movements(wine_id);

drop policy if exists "authenticated users can write movements" on public.stock_movements;
create policy "authenticated users can write movements" on public.stock_movements
  for insert to authenticated with check ((select auth.uid()) = created_by);

drop policy if exists "authenticated users can update balances" on public.stock_balances;
create policy "authenticated users can update balances" on public.stock_balances
  for update to authenticated using (true) with check (true);
create policy "authenticated users can insert balances" on public.stock_balances
  for insert to authenticated with check (true);

create or replace function public.record_stock_movement(
  p_wine_id uuid, p_from_location_id uuid, p_to_location_id uuid,
  p_cartons integer, p_movement_type text, p_note text default null
) returns public.stock_movements
language plpgsql security invoker set search_path = public
as $$
declare v_movement public.stock_movements;
begin
  if p_cartons <= 0 then raise exception 'Die Anzahl Kartons muss grösser als 0 sein'; end if;
  if p_from_location_id is not null then
    update public.stock_balances set cartons = cartons - p_cartons, updated_at = now()
    where wine_id = p_wine_id and location_id = p_from_location_id and cartons >= p_cartons;
    if not found then raise exception 'Nicht genügend Bestand vorhanden'; end if;
  end if;
  if p_to_location_id is not null then
    insert into public.stock_balances (wine_id, location_id, cartons) values (p_wine_id, p_to_location_id, p_cartons)
    on conflict (wine_id, location_id) do update set cartons = public.stock_balances.cartons + excluded.cartons, updated_at = now();
  end if;
  insert into public.stock_movements (wine_id, from_location_id, to_location_id, cartons, movement_type, note, created_by)
  values (p_wine_id, p_from_location_id, p_to_location_id, p_cartons, p_movement_type, p_note, (select auth.uid()))
  returning * into v_movement;
  return v_movement;
end;
$$;

grant execute on function public.record_stock_movement(uuid, uuid, uuid, integer, text, text) to authenticated;
