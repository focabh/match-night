-- ============================================================
-- MATCH NIGHT — schema standalone (prefixo mn_*, isolado do Bora).
-- Independente: nenhuma FK/regra/tabela do Bora. Tudo escopado por event_id.
-- Auth do MVP = uuid anônimo do browser (sem Supabase Auth). Toda mutação/leitura
-- passa por RPC security-definer que valida evento ATIVO + isolamento + 18+.
-- RLS ligada SEM policies nas tabelas (acesso só via RPC). RPCs grant -> anon.
-- ============================================================

-- ---------- TABELAS ----------
create table if not exists public.mn_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.mn_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.mn_venues(id) on delete set null,
  venue_name text not null,            -- denormalizado (app standalone simples)
  name text not null,
  public_code text not null unique,    -- código curto do QR/link
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','active','ended','cancelled')),
  is_demo boolean not null default false,   -- sandbox de QA (não aparece no admin/bar)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mn_events_code_idx on public.mn_events(public_code);

-- identidade base (reutilizável entre eventos)
create table if not exists public.mn_users (
  id uuid primary key,                 -- uuid gerado no browser
  display_name text,
  birthdate date,
  gender text,
  interested_in text,
  primary_photo_url text,
  bio text,
  profile_prompt text,
  night_intention text,
  instagram_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- participação TEMPORÁRIA num evento (snapshots; isolada por event_id)
create table if not exists public.mn_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  user_id uuid not null references public.mn_users(id) on delete cascade,
  display_name_snapshot text not null,
  age_snapshot int not null,
  gender_snapshot text not null,
  interested_in_snapshot text not null,
  primary_photo_url_snapshot text not null,
  bio_snapshot text,
  profile_prompt_snapshot text,
  night_intention_snapshot text not null,
  status text not null default 'active' check (status in ('active','left','blocked','removed','expired')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (event_id, user_id)
);
create index if not exists mn_part_event_idx on public.mn_participants(event_id, status);

create table if not exists public.mn_likes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  from_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  to_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  action text not null check (action in ('like','pass')),
  created_at timestamptz not null default now(),
  unique (event_id, from_participant_id, to_participant_id)
);

create table if not exists public.mn_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  participant_a_id uuid not null references public.mn_participants(id) on delete cascade,
  participant_b_id uuid not null references public.mn_participants(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired','blocked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (event_id, participant_a_id, participant_b_id)
);

create table if not exists public.mn_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  reporter_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  reported_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.mn_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.mn_events(id) on delete cascade,
  blocker_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  blocked_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, blocker_participant_id, blocked_participant_id)
);

-- config simples (chave do admin pro MVP)
create table if not exists public.mn_config (k text primary key, v text);

-- RLS: liga em todas, SEM policies → acesso só via RPC security-definer
do $$ declare t text;
begin
  foreach t in array array['mn_venues','mn_events','mn_users','mn_participants','mn_likes','mn_matches','mn_reports','mn_blocks','mn_config'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- HELPERS ----------
create or replace function public.mn_age(p_birth date) returns int
 language sql immutable as $$ select extract(year from age(p_birth))::int $$;

-- evento "vivo" = status active E dentro da janela (now() > ends_at = encerrado)
create or replace function public.mn_is_live(p_event public.mn_events) returns boolean
 language sql stable as $$
  select p_event.status='active' and now() >= p_event.starts_at and now() < p_event.ends_at
$$;

-- ---------- LANDING (público por código) ----------
create or replace function public.mn_event_public(p_code text)
 returns json language sql stable security definer set search_path to 'public' as $$
  select case when e.id is null then null else json_build_object(
    'event_id', e.id, 'name', e.name, 'venue_name', e.venue_name,
    'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'status', e.status, 'is_live', public.mn_is_live(e), 'is_demo', e.is_demo,
    'ended', (e.status in ('ended','cancelled') or now() >= e.ends_at)
  ) end
  from (select * from public.mn_events where public_code = p_code limit 1) e
$$;

-- ---------- JOIN (cria/atualiza identidade + participação) ----------
create or replace function public.mn_join_event(
  p_event_id uuid, p_user_id uuid, p_display_name text, p_birthdate date,
  p_gender text, p_interested_in text, p_photo_url text, p_bio text,
  p_prompt text, p_intention text, p_instagram text default null,
  p_consent boolean default false
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_age int; v_pid uuid;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;
  if coalesce(trim(p_display_name),'')='' or p_birthdate is null
     or coalesce(p_gender,'')='' or coalesce(p_interested_in,'')=''
     or coalesce(p_photo_url,'')='' or coalesce(p_intention,'')='' then
    raise exception 'missing_required_fields'; end if;
  if coalesce(trim(coalesce(p_bio,'')||coalesce(p_prompt,'')),'')='' then
    raise exception 'bio_or_prompt_required'; end if;
  v_age := public.mn_age(p_birthdate);
  if v_age < 18 then raise exception 'underage'; end if;

  insert into public.mn_users(id, display_name, birthdate, gender, interested_in,
      primary_photo_url, bio, profile_prompt, night_intention, instagram_handle, updated_at)
  values (p_user_id, p_display_name, p_birthdate, p_gender, p_interested_in,
      p_photo_url, p_bio, p_prompt, p_intention, p_instagram, now())
  on conflict (id) do update set display_name=excluded.display_name, birthdate=excluded.birthdate,
      gender=excluded.gender, interested_in=excluded.interested_in,
      primary_photo_url=excluded.primary_photo_url, bio=excluded.bio,
      profile_prompt=excluded.profile_prompt, night_intention=excluded.night_intention,
      instagram_handle=excluded.instagram_handle, updated_at=now();

  insert into public.mn_participants(event_id, user_id, display_name_snapshot, age_snapshot,
      gender_snapshot, interested_in_snapshot, primary_photo_url_snapshot, bio_snapshot,
      profile_prompt_snapshot, night_intention_snapshot, status, expires_at, last_seen_at)
  values (p_event_id, p_user_id, p_display_name, v_age, p_gender, p_interested_in, p_photo_url,
      p_bio, p_prompt, p_intention, 'active', e.ends_at, now())
  on conflict (event_id, user_id) do update set status='active',
      display_name_snapshot=excluded.display_name_snapshot, age_snapshot=excluded.age_snapshot,
      gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
      primary_photo_url_snapshot=excluded.primary_photo_url_snapshot, bio_snapshot=excluded.bio_snapshot,
      profile_prompt_snapshot=excluded.profile_prompt_snapshot,
      night_intention_snapshot=excluded.night_intention_snapshot, last_seen_at=now()
  returning id into v_pid;
  return json_build_object('participant_id', v_pid, 'age', v_age);
end $$;

-- participação ativa do user no evento (pra roteamento "voltar ao deck")
create or replace function public.mn_my_participation(p_event_id uuid, p_user_id uuid)
 returns json language sql stable security definer set search_path to 'public' as $$
  select case when p.id is null then null else json_build_object(
    'participant_id', p.id, 'status', p.status) end
  from public.mn_participants p where p.event_id=p_event_id and p.user_id=p_user_id limit 1
$$;

-- compat de gênero ↔ interesse (simples, espelha o Matchmaker)
create or replace function public.mn_wants(p_pref text, p_gender text) returns boolean
 language sql immutable as $$
  select p_pref is null or p_pref in ('all','todos')
      or (p_pref='women' and p_gender='woman') or (p_pref='men' and p_gender='man')
      or (p_pref='nonbinary' and p_gender='nonbinary')
$$;

-- ---------- DECK ----------
create or replace function public.mn_deck(p_event_id uuid, p_user_id uuid)
 returns table(participant_id uuid, display_name text, age int, gender text,
   bio text, profile_prompt text, night_intention text, photo_url text)
 language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; me public.mn_participants;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then return; end if;
  select * into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me.id is null or me.status<>'active' then return; end if;
  update public.mn_participants set last_seen_at=now() where id=me.id;
  return query
  select p.id, p.display_name_snapshot, p.age_snapshot, p.gender_snapshot,
         p.bio_snapshot, p.profile_prompt_snapshot, p.night_intention_snapshot,
         p.primary_photo_url_snapshot
  from public.mn_participants p
  where p.event_id=p_event_id and p.id<>me.id and p.status='active'
    -- compat bidirecional
    and public.mn_wants(me.interested_in_snapshot, p.gender_snapshot)
    and public.mn_wants(p.interested_in_snapshot, me.gender_snapshot)
    -- já não vi (like/pass)
    and not exists (select 1 from public.mn_likes l where l.event_id=p_event_id
        and l.from_participant_id=me.id and l.to_participant_id=p.id)
    -- bloqueios (qualquer direção) e denúncias minhas
    and not exists (select 1 from public.mn_blocks b where b.event_id=p_event_id
        and ((b.blocker_participant_id=me.id and b.blocked_participant_id=p.id)
          or (b.blocker_participant_id=p.id and b.blocked_participant_id=me.id)))
    and not exists (select 1 from public.mn_reports r where r.event_id=p_event_id
        and r.reporter_participant_id=me.id and r.reported_participant_id=p.id)
  order by p.last_seen_at desc;
end $$;

-- ---------- SWIPE (like/pass) + MATCH ----------
create or replace function public.mn_swipe(p_event_id uuid, p_user_id uuid, p_target uuid, p_action text)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; me uuid; v_match uuid; v_reciprocal boolean; a uuid; b uuid;
begin
  if p_action not in ('like','pass') then raise exception 'invalid_action'; end if;
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then raise exception 'not_active_participant'; end if;
  if me = p_target then raise exception 'cannot_swipe_self'; end if;
  if not exists (select 1 from public.mn_participants where id=p_target and event_id=p_event_id and status='active') then
    raise exception 'target_not_active'; end if;
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (p_event_id, me, p_target, p_action)
  on conflict (event_id, from_participant_id, to_participant_id) do update set action=excluded.action, created_at=now();
  if p_action <> 'like' then return json_build_object('matched', false); end if;
  select exists(select 1 from public.mn_likes where event_id=p_event_id
      and from_participant_id=p_target and to_participant_id=me and action='like') into v_reciprocal;
  if not v_reciprocal then return json_build_object('matched', false); end if;
  a := least(me, p_target); b := greatest(me, p_target);
  insert into public.mn_matches(event_id, participant_a_id, participant_b_id, status, expires_at)
  values (p_event_id, a, b, 'active', e.ends_at)
  on conflict (event_id, participant_a_id, participant_b_id) do nothing;
  select id into v_match from public.mn_matches where event_id=p_event_id and participant_a_id=a and participant_b_id=b;
  return json_build_object('matched', true, 'match_id', v_match);
end $$;

-- ---------- MATCHES ATIVOS ----------
create or replace function public.mn_matches_list(p_event_id uuid, p_user_id uuid)
 returns table(match_id uuid, participant_id uuid, display_name text, age int,
   photo_url text, night_intention text, instagram text)
 language plpgsql stable security definer set search_path to 'public' as $$
declare e public.mn_events; me uuid;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then return; end if;
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then return; end if;
  return query
  select m.id,
    other.id, other.display_name_snapshot, other.age_snapshot,
    other.primary_photo_url_snapshot, other.night_intention_snapshot,
    ou.instagram_handle
  from public.mn_matches m
  join public.mn_participants other on other.id = case when m.participant_a_id=me then m.participant_b_id else m.participant_a_id end
  left join public.mn_users ou on ou.id = other.user_id
  where m.event_id=p_event_id and m.status='active'
    and (m.participant_a_id=me or m.participant_b_id=me)
    and other.status='active'
    and not exists (select 1 from public.mn_blocks b where b.event_id=p_event_id
        and ((b.blocker_participant_id=me and b.blocked_participant_id=other.id)
          or (b.blocker_participant_id=other.id and b.blocked_participant_id=me)))
  order by m.created_at desc;
end $$;

-- ---------- MODERAÇÃO ----------
create or replace function public.mn_block(p_event_id uuid, p_user_id uuid, p_target uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me is null then raise exception 'not_a_participant'; end if;
  insert into public.mn_blocks(event_id, blocker_participant_id, blocked_participant_id)
  values (p_event_id, me, p_target) on conflict do nothing;
  update public.mn_matches set status='blocked'
   where event_id=p_event_id and (
     (participant_a_id=me and participant_b_id=p_target) or
     (participant_a_id=p_target and participant_b_id=me));
end $$;

create or replace function public.mn_report(p_event_id uuid, p_user_id uuid, p_target uuid, p_reason text)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me is null then raise exception 'not_a_participant'; end if;
  insert into public.mn_reports(event_id, reporter_participant_id, reported_participant_id, reason)
  values (p_event_id, me, p_target, p_reason);
end $$;

create or replace function public.mn_leave_event(p_event_id uuid, p_user_id uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me is null then return; end if;
  update public.mn_participants set status='left' where id=me;
  update public.mn_matches set status='expired'
   where event_id=p_event_id and (participant_a_id=me or participant_b_id=me) and status='active';
end $$;

-- ---------- EXPIRAÇÃO (cron) ----------
create or replace function public.mn_expire_events() returns void
 language plpgsql security definer set search_path to 'public' as $$
begin
  update public.mn_events set status='ended', updated_at=now()
   where status='active' and now() >= ends_at;
  update public.mn_participants p set status='expired'
   from public.mn_events e where p.event_id=e.id and e.status in ('ended','cancelled') and p.status='active';
  update public.mn_matches m set status='expired'
   from public.mn_events e where m.event_id=e.id and e.status in ('ended','cancelled') and m.status='active';
end $$;

-- ---------- ADMIN (MVP: chave compartilhada em mn_config) ----------
create or replace function public._mn_admin_ok(p_key text) returns boolean
 language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.mn_config where k='admin_key' and v=p_key)
$$;

create or replace function public.mn_admin_create_event(p_key text, p_name text, p_venue text,
   p_description text, p_starts timestamptz, p_ends timestamptz)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare v_code text; v_id uuid;
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  v_code := lower(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.mn_events(venue_name, name, public_code, description, starts_at, ends_at, status)
  values (p_venue, p_name, v_code, p_description, p_starts, p_ends, 'active')
  returning id into v_id;
  return json_build_object('event_id', v_id, 'public_code', v_code);
end $$;

create or replace function public.mn_admin_list_events(p_key text)
 returns table(id uuid, name text, venue_name text, public_code text, status text,
   starts_at timestamptz, ends_at timestamptz, participants int, matches int)
 language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  return query
  select e.id, e.name, e.venue_name, e.public_code, e.status, e.starts_at, e.ends_at,
    (select count(*)::int from public.mn_participants p where p.event_id=e.id),
    (select count(*)::int from public.mn_matches m where m.event_id=e.id and m.status='active')
  from public.mn_events e
  where not coalesce(e.is_demo, false)   -- sandboxes de QA fora do painel do bar
  order by e.created_at desc;
end $$;

create or replace function public.mn_admin_end_event(p_key text, p_event_id uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  update public.mn_events set status='ended', updated_at=now() where id=p_event_id;
  perform public.mn_expire_events();
end $$;

-- ação manual: expira eventos vencidos (limpa status/participantes/matches).
-- No UAT compartilhado roda sob demanda (sem pg_cron); no projeto dedicado,
-- agendar mn_expire_events() via pg_cron.
create or replace function public.mn_admin_expire(p_key text)
 returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  perform public.mn_expire_events();
  return json_build_object('ok', true,
    'eventos_ativos', (select count(*) from public.mn_events where status='active'));
end $$;

create or replace function public.mn_admin_stats(p_key text, p_event_id uuid)
 returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  return (select json_build_object(
    'participants', (select count(*) from public.mn_participants where event_id=p_event_id),
    'active', (select count(*) from public.mn_participants where event_id=p_event_id and status='active'),
    'likes', (select count(*) from public.mn_likes where event_id=p_event_id and action='like'),
    'passes', (select count(*) from public.mn_likes where event_id=p_event_id and action='pass'),
    'matches', (select count(*) from public.mn_matches where event_id=p_event_id),
    'reports', (select count(*) from public.mn_reports where event_id=p_event_id),
    'blocks', (select count(*) from public.mn_blocks where event_id=p_event_id)
  ));
end $$;

-- ---------- GRANTS (anon só executa as RPCs públicas) ----------
do $$ declare f text;
begin
  foreach f in array array[
    'mn_event_public(text)','mn_join_event(uuid,uuid,text,date,text,text,text,text,text,text,text,boolean)',
    'mn_my_participation(uuid,uuid)','mn_deck(uuid,uuid)','mn_swipe(uuid,uuid,uuid,text)',
    'mn_matches_list(uuid,uuid)','mn_block(uuid,uuid,uuid)','mn_report(uuid,uuid,uuid,text)',
    'mn_leave_event(uuid,uuid)',
    'mn_admin_create_event(text,text,text,text,timestamptz,timestamptz)','mn_admin_list_events(text)',
    'mn_admin_end_event(text,uuid)','mn_admin_stats(text,uuid)','mn_admin_expire(text)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- chave admin inicial (TROCAR depois). MVP.
insert into public.mn_config(k,v) values ('admin_key','mn-admin-2026')
  on conflict (k) do nothing;

select 'match_night schema ok' as status;
