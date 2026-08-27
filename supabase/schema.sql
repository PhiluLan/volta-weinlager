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
