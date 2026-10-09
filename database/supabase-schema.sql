-- Huamancaca Chico: shared patrimonial inventory
create sequence if not exists public.asset_code_seq start with 1;

create table if not exists public.assets (
	id uuid primary key default gen_random_uuid(),
	asset_code text not null unique default (
		'HC-' || lpad(nextval('public.asset_code_seq')::text, 4, '0')
	),
	barcode text unique,
	name text not null check (char_length(trim(name)) between 1 and 90),
	category text not null,
	quantity integer not null default 1 check (quantity > 0),
	location text not null,
	custodian text not null default '',
	condition text not null check (condition in ('Bueno', 'Regular', 'Malo')),
	acquired_on date,
	value numeric(12, 2) not null default 0 check (value >= 0),
	notes text not null default '',
	created_by uuid not null default auth.uid() references auth.users(id),
	updated_by uuid not null default auth.uid() references auth.users(id),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create or replace function public.set_asset_updated_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
	new.updated_at := now();
	new.updated_by := (select auth.uid());
	new.created_by := old.created_by;
	return new;
end;
$$;

drop trigger if exists assets_set_updated_fields on public.assets;
create trigger assets_set_updated_fields
before update on public.assets
for each row execute function public.set_asset_updated_fields();

alter table public.assets enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant usage, select on sequence public.asset_code_seq to authenticated;

drop policy if exists "Authenticated users can read assets" on public.assets;
create policy "Authenticated users can read assets"
	on public.assets for select to authenticated using (true);

drop policy if exists "Authenticated users can register assets" on public.assets;
create policy "Authenticated users can register assets"
	on public.assets for insert to authenticated
	with check (created_by = (select auth.uid()) and updated_by = (select auth.uid()));

drop policy if exists "Authenticated users can edit assets" on public.assets;
create policy "Authenticated users can edit assets"
	on public.assets for update to authenticated
	using (true)
	with check (updated_by = (select auth.uid()));

drop policy if exists "Authenticated users can delete assets" on public.assets;
create policy "Authenticated users can delete assets"
	on public.assets for delete to authenticated using (true);

create index if not exists assets_category_idx on public.assets (category);
create index if not exists assets_location_idx on public.assets (location);

-- Enable live updates across signed-in devices through Supabase Realtime.
do $$
begin
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'assets'
	) then
		execute 'alter publication supabase_realtime add table public.assets';
	end if;
end;
$$;
