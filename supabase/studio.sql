-- ============================================================
-- MATCH NIGHT · STUDIO — criador de evento personalizado p/ casas/bares.
-- Estende mn_venues (identidade visual), mn_events (slug/tipo/theme/matchmaker)
-- e adiciona mn_rewards (gamificação). Tudo idempotente.
-- Host: UAT kbxhzzzicyeexdbqdfnl. Acesso só via RPC (RLS sem policies).
-- ============================================================

-- ---------- IDENTIDADE DO LOCAL ----------
alter table public.mn_venues add column if not exists logo_url text;
alter table public.mn_venues add column if not exists cover_url text;
alter table public.mn_venues add column if not exists bg_url text;
alter table public.mn_venues add column if not exists primary_color text;
alter table public.mn_venues add column if not exists secondary_color text;
alter table public.mn_venues add column if not exists button_color text;
alter table public.mn_venues add column if not exists address text;
alter table public.mn_venues add column if not exists map_url text;
alter table public.mn_venues add column if not exists instagram text;
alter table public.mn_venues add column if not exists about text;
alter table public.mn_venues add column if not exists ambient_photos jsonb not null default '[]'::jsonb;
alter table public.mn_venues add column if not exists default_rewards jsonb not null default '[]'::jsonb;
alter table public.mn_venues add column if not exists updated_at timestamptz not null default now();

-- ---------- EVENTO: slug, tipo, tema, config do matchmaker ----------
alter table public.mn_events add column if not exists slug text unique;
alter table public.mn_events add column if not exists event_type text;
alter table public.mn_events add column if not exists theme jsonb not null default '{}'::jsonb;
alter table public.mn_events add column if not exists matchmaker jsonb not null default '{}'::jsonb;
create index if not exists mn_events_slug_idx on public.mn_events(slug);

-- ---------- GAMIFICAÇÃO / RECOMPENSAS ----------
create table if not exists public.mn_rewards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  name text not null,
  kind text not null default 'drink',     -- drink/vip/porcao/brinde/desconto/combo/consumacao
  emoji text,
  qty_total int,                          -- null = ilimitado
  qty_claimed int not null default 0,
  points_required int not null default 0,
  redeem_rule text,
  valid_from text,                        -- "21:00"
  valid_to text,                          -- "23:00"
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mn_rewards_event_idx on public.mn_rewards(event_id);
alter table public.mn_rewards enable row level security;

-- ---------- SLUG helper ----------
create or replace function public.mn_slugify(p text) returns text
 language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p,''),
      'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+','-','g'))
$$;

-- garante slug único (acrescenta -2, -3, ...)
create or replace function public._mn_unique_slug(p_base text, p_event uuid default null) returns text
 language plpgsql stable security definer set search_path to 'public' as $$
declare s text; n int := 1; cand text;
begin
  s := nullif(public.mn_slugify(p_base),'');
  if s is null then s := 'evento'; end if;
  cand := s;
  while exists(select 1 from public.mn_events e where e.slug=cand and (p_event is null or e.id<>p_event)) loop
    n := n+1; cand := s||'-'||n;
  end loop;
  return cand;
end $$;

-- ============================================================
-- STUDIO RPCs (gated por admin key)
-- ============================================================

-- lista locais com identidade visual
create or replace function public.mn_studio_list_venues(p_key text)
 returns setof public.mn_venues language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  return query select * from public.mn_venues order by name;
end $$;

-- cria/atualiza identidade do local
create or replace function public.mn_studio_upsert_venue(p_key text, p jsonb)
 returns public.mn_venues language plpgsql security definer set search_path to 'public' as $$
declare v public.mn_venues; vid uuid;
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  vid := nullif(p->>'id','')::uuid;
  if vid is null then
    insert into public.mn_venues(name, slug, logo_url, cover_url, bg_url,
      primary_color, secondary_color, button_color, address, map_url, instagram, about,
      ambient_photos, default_rewards)
    values (p->>'name', public._mn_unique_venue_slug(coalesce(p->>'slug',p->>'name')),
      p->>'logo_url', p->>'cover_url', p->>'bg_url',
      p->>'primary_color', p->>'secondary_color', p->>'button_color',
      p->>'address', p->>'map_url', p->>'instagram', p->>'about',
      coalesce(p->'ambient_photos','[]'::jsonb), coalesce(p->'default_rewards','[]'::jsonb))
    returning * into v;
  else
    update public.mn_venues set
      name=coalesce(p->>'name',name), logo_url=p->>'logo_url', cover_url=p->>'cover_url',
      bg_url=p->>'bg_url', primary_color=p->>'primary_color', secondary_color=p->>'secondary_color',
      button_color=p->>'button_color', address=p->>'address', map_url=p->>'map_url',
      instagram=p->>'instagram', about=p->>'about',
      ambient_photos=coalesce(p->'ambient_photos',ambient_photos),
      default_rewards=coalesce(p->'default_rewards',default_rewards), updated_at=now()
    where id=vid returning * into v;
  end if;
  return v;
end $$;

create or replace function public._mn_unique_venue_slug(p_base text) returns text
 language plpgsql stable security definer set search_path to 'public' as $$
declare s text; n int := 1; cand text;
begin
  s := nullif(public.mn_slugify(p_base),''); if s is null then s := 'local'; end if;
  cand := s;
  while exists(select 1 from public.mn_venues v where v.slug=cand) loop n:=n+1; cand:=s||'-'||n; end loop;
  return cand;
end $$;

-- cria evento completo (venue + theme + matchmaker + rewards) numa tacada
create or replace function public.mn_studio_create_event(p_key text, p jsonb)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare
  ev jsonb := p->'event';
  vn jsonb := p->'venue';
  rws jsonb := coalesce(p->'rewards','[]'::jsonb);
  vid uuid; vname text; v_code text; v_slug text; v_id uuid; r jsonb; i int := 0;
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;

  -- resolve/realiza o local
  vid := nullif(vn->>'id','')::uuid;
  if vid is null and coalesce(vn->>'name','')<>'' then
    insert into public.mn_venues(name, slug, logo_url, cover_url, bg_url,
      primary_color, secondary_color, button_color, address, map_url, instagram, about,
      ambient_photos, default_rewards)
    values (vn->>'name', public._mn_unique_venue_slug(coalesce(vn->>'slug',vn->>'name')),
      vn->>'logo_url', vn->>'cover_url', vn->>'bg_url',
      vn->>'primary_color', vn->>'secondary_color', vn->>'button_color',
      vn->>'address', vn->>'map_url', vn->>'instagram', vn->>'about',
      coalesce(vn->'ambient_photos','[]'::jsonb), coalesce(vn->'default_rewards','[]'::jsonb))
    returning id into vid;
  end if;
  select coalesce((select name from public.mn_venues where id=vid), ev->>'venue_name', 'Evento') into vname;

  v_code := lower(substr(replace(gen_random_uuid()::text,'-',''),1,7));
  v_slug := public._mn_unique_slug(coalesce(ev->>'slug', (vname||'-'||(ev->>'name'))));

  insert into public.mn_events(venue_id, venue_name, name, public_code, slug, event_type,
     description, starts_at, ends_at, status, theme, matchmaker)
  values (vid, vname, ev->>'name', v_code, v_slug, ev->>'type',
     ev->>'description', (ev->>'starts_at')::timestamptz, (ev->>'ends_at')::timestamptz,
     coalesce(ev->>'status','active'),
     coalesce(ev->'theme','{}'::jsonb), coalesce(ev->'matchmaker','{}'::jsonb))
  returning id into v_id;

  for r in select * from jsonb_array_elements(rws) loop
    insert into public.mn_rewards(event_id, name, kind, emoji, qty_total, points_required,
       redeem_rule, valid_from, valid_to, sort)
    values (v_id, r->>'name', coalesce(r->>'kind','drink'), r->>'emoji',
       nullif(r->>'qty_total','')::int, coalesce((r->>'points_required')::int,0),
       r->>'redeem_rule', r->>'valid_from', r->>'valid_to', i);
    i := i+1;
  end loop;

  return json_build_object('event_id', v_id, 'public_code', v_code, 'slug', v_slug);
end $$;

-- atualiza evento existente (theme/matchmaker/datas/rewards)
create or replace function public.mn_studio_update_event(p_key text, p_event_id uuid, p jsonb)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare ev jsonb := p->'event'; rws jsonb := p->'rewards'; r jsonb; i int := 0;
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  update public.mn_events set
    name=coalesce(ev->>'name',name), event_type=coalesce(ev->>'type',event_type),
    description=coalesce(ev->>'description',description),
    starts_at=coalesce((ev->>'starts_at')::timestamptz,starts_at),
    ends_at=coalesce((ev->>'ends_at')::timestamptz,ends_at),
    theme=coalesce(ev->'theme',theme), matchmaker=coalesce(ev->'matchmaker',matchmaker),
    slug=case when ev->>'slug' is not null then public._mn_unique_slug(ev->>'slug',id) else slug end,
    updated_at=now()
  where id=p_event_id;
  if rws is not null then
    delete from public.mn_rewards where event_id=p_event_id;
    for r in select * from jsonb_array_elements(rws) loop
      insert into public.mn_rewards(event_id, name, kind, emoji, qty_total, points_required,
         redeem_rule, valid_from, valid_to, sort)
      values (p_event_id, r->>'name', coalesce(r->>'kind','drink'), r->>'emoji',
         nullif(r->>'qty_total','')::int, coalesce((r->>'points_required')::int,0),
         r->>'redeem_rule', r->>'valid_from', r->>'valid_to', i);
      i := i+1;
    end loop;
  end if;
  return json_build_object('ok', true);
end $$;

-- ============================================================
-- LEITURA PÚBLICA (themed) — por código OU slug
-- ============================================================
create or replace function public.mn_event_public(p_code text)
 returns json language plpgsql stable security definer set search_path to 'public' as $$
declare e public.mn_events; vn public.mn_venues;
begin
  select * into e from public.mn_events where public_code=p_code or slug=p_code limit 1;
  if e.id is null then return null; end if;
  select * into vn from public.mn_venues where id=e.venue_id;
  return json_build_object(
    'event_id', e.id, 'name', e.name, 'venue_name', e.venue_name,
    'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'status', e.status, 'is_live', public.mn_is_live(e), 'is_demo', e.is_demo,
    'ended', (e.status in ('ended','cancelled') or now() >= e.ends_at),
    'public_code', e.public_code, 'slug', e.slug, 'type', e.event_type,
    'theme', e.theme, 'matchmaker', e.matchmaker,
    'venue', case when vn.id is null then null else json_build_object(
      'name', vn.name, 'logo_url', vn.logo_url, 'cover_url', vn.cover_url, 'bg_url', vn.bg_url,
      'primary_color', vn.primary_color, 'secondary_color', vn.secondary_color,
      'button_color', vn.button_color, 'address', vn.address, 'map_url', vn.map_url,
      'instagram', vn.instagram, 'about', vn.about, 'ambient_photos', vn.ambient_photos) end,
    'rewards', coalesce((select json_agg(json_build_object(
        'name', r.name, 'kind', r.kind, 'emoji', r.emoji, 'qty_total', r.qty_total,
        'points_required', r.points_required, 'redeem_rule', r.redeem_rule,
        'valid_from', r.valid_from, 'valid_to', r.valid_to) order by r.sort)
      from public.mn_rewards r where r.event_id=e.id), '[]'::json)
  );
end $$;

-- discover p/ Home: eventos públicos ao vivo (sem sandbox), com tema p/ cards
create or replace function public.mn_events_public_list()
 returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(json_build_object(
    'name', e.name, 'venue_name', e.venue_name, 'slug', e.slug, 'public_code', e.public_code,
    'type', e.event_type, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'theme', e.theme,
    'participants', (select count(*) from public.mn_participants p where p.event_id=e.id and p.status='active')
  ) order by e.starts_at), '[]'::json)
  from public.mn_events e
  where e.status='active' and now() < e.ends_at and not coalesce(e.is_demo,false)
    and coalesce(e.matchmaker->>'visibility','public') <> 'private'
$$;

-- ---------- GRANTS ----------
do $$ declare f text;
begin
  foreach f in array array[
    'mn_studio_list_venues(text)','mn_studio_upsert_venue(text,jsonb)',
    'mn_studio_create_event(text,jsonb)','mn_studio_update_event(text,uuid,jsonb)',
    'mn_event_public(text)','mn_events_public_list()'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select 'studio schema ok' as status,
  (select count(*) from information_schema.columns where table_name='mn_events' and column_name in ('slug','theme','matchmaker','event_type')) as ev_cols,
  (select count(*) from information_schema.tables where table_name='mn_rewards') as rewards_tbl;
