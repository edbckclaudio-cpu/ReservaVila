create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shift text not null check (shift in ('lunch','dinner')),
  table_number int not null check (table_number >= 1 and table_number <= 40),
  client_name text not null,
  guest_count int not null check (guest_count >= 1),
  reservation_time time not null,
  phone text,
  notes text,
  inserted_at timestamptz default now()
);

create unique index if not exists reservations_unique_idx
  on public.reservations(date, shift, table_number);

alter table public.reservations
  add constraint reservations_unique_constraint unique (date, shift, table_number);

alter table if exists public.reservations
  add column if not exists phone text;

-- Enable Realtime on the table
-- In Supabase: Database -> Replication -> add table 'reservations' for inserts/updates/deletes
