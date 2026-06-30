-- ============================================================
-- MATCH NIGHT · ONBOARDING "B PRESENCIAL"
-- Tela única (gênero + preferência multi-seleção). Tudo o mais é deferido.
-- - interested_in vira text[] (multi-seleção)
-- - campos deferidos (nome/foto/idade/intenção) viram OPCIONAIS
-- - mn_quick_join (entra com 2 fatos), mn_set_prefs, mn_complete_profile
-- - mn_wants(array), mn_deck/matches/join recriados
-- - funil de analytics (mn_funnel + mn_track)
-- Host: UAT kbxhzzzicyeexdbqdfnl
-- ============================================================

-- identidade: detalhe livre de "Outro…"
alter table public.mn_users add column if not exists gender_detail text;

-- preferência multi-seleção (text -> text[])
alter table public.mn_users
  alter column interested_in type text[]
  using case when interested_in is null then null
             when interested_in='' then '{}'::text[]
             else array[interested_in] end;
alter table public.mn_participants
  alter column interested_in_snapshot type text[]
  using case when interested_in_snapshot is null then '{}'::text[]
             else array[interested_in_snapshot] end;
alter table public.mn_participants alter column interested_in_snapshot drop not null;

-- campos deferidos viram opcionais (entra sem nome/foto/idade/intenção)
alter table public.mn_participants alter column display_name_snapshot drop not null;
alter table public.mn_participants alter column age_snapshot drop not null;
alter table public.mn_participants alter column primary_photo_url_snapshot drop not null;
alter table public.mn_participants alter column night_intention_snapshot drop not null;

-- compatibilidade de gênero com preferência multi-seleção
drop function if exists public.mn_wants(text, text);
create or replace function public.mn_wants(prefs text[], g text) returns boolean
 language sql immutable as $$
  select prefs is null or cardinality(prefs)=0
      or 'all' = any(prefs) or 'todos' = any(prefs)
      or (g='woman' and 'women'=any(prefs))
      or (g='man'   and 'men'=any(prefs))
      or (g='nonbinary' and 'nonbinary'=any(prefs))
      or (g = any(prefs));   -- defensivo (prefs com valores de gênero)
$$;

-- ============================================================
-- ENTRADA RÁPIDA: 2 fatos (gênero + preferência)
-- ============================================================
create or replace function public.mn_quick_join(
  p_event_id uuid, p_user_id uuid, p_gender text, p_interested_in text[],
  p_gender_detail text default null, p_consent boolean default false
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_pid uuid;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;
  if coalesce(trim(p_gender),'')='' then raise exception 'gender_required'; end if;
  if p_interested_in is null or cardinality(p_interested_in)=0 then raise exception 'preference_required'; end if;

  insert into public.mn_users(id, gender, gender_detail, interested_in, updated_at)
  values (p_user_id, p_gender, p_gender_detail, p_interested_in, now())
  on conflict (id) do update set gender=excluded.gender, gender_detail=excluded.gender_detail,
    interested_in=excluded.interested_in, updated_at=now();

  insert into public.mn_participants(event_id, user_id, gender_snapshot, interested_in_snapshot,
     status, expires_at, last_seen_at)
  values (p_event_id, p_user_id, p_gender, p_interested_in, 'active', e.ends_at, now())
  on conflict (event_id, user_id) do update set status='active',
     gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
     last_seen_at=now()
  returning id into v_pid;
  return json_build_object('participant_id', v_pid);
end $$;

-- alterar preferências durante o evento (⚙️)
create or replace function public.mn_set_prefs(
  p_event_id uuid, p_user_id uuid, p_gender text, p_interested_in text[], p_gender_detail text default null
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.mn_users set gender=p_gender, gender_detail=p_gender_detail,
    interested_in=p_interested_in, updated_at=now() where id=p_user_id;
  update public.mn_participants set gender_snapshot=p_gender, interested_in_snapshot=p_interested_in
    where event_id=p_event_id and user_id=p_user_id;
end $$;

-- completar perfil DEPOIS de entrar (opcional): foto, nome, bio, intenção, redes, idade
create or replace function public.mn_complete_profile(
  p_event_id uuid, p_user_id uuid, p_display_name text default null, p_birthdate date default null,
  p_photos jsonb default '[]'::jsonb, p_bio text default null, p_prompt text default null,
  p_intention text default null, p_socials jsonb default '{}'::jsonb
) returns json language plpgsql security definer set search_path to 'public' as $$
declare v_age int; v_primary text;
begin
  v_age := case when p_birthdate is null then null else public.mn_age(p_birthdate) end;
  if v_age is not null and v_age < 18 then raise exception 'underage'; end if;
  v_primary := coalesce(p_photos->>0, '');

  update public.mn_users set
    display_name=coalesce(p_display_name,display_name),
    birthdate=coalesce(p_birthdate,birthdate),
    primary_photo_url=coalesce(nullif(v_primary,''),primary_photo_url),
    photos=case when jsonb_array_length(coalesce(p_photos,'[]'::jsonb))>0 then p_photos else photos end,
    bio=coalesce(p_bio,bio), profile_prompt=coalesce(p_prompt,profile_prompt),
    night_intention=coalesce(p_intention,night_intention),
    socials=case when p_socials <> '{}'::jsonb then p_socials else socials end,
    instagram_handle=coalesce(p_socials->>'instagram', instagram_handle), updated_at=now()
  where id=p_user_id;

  update public.mn_participants set
    display_name_snapshot=coalesce(p_display_name,display_name_snapshot),
    age_snapshot=coalesce(v_age,age_snapshot),
    primary_photo_url_snapshot=coalesce(nullif(v_primary,''),primary_photo_url_snapshot),
    photos_snapshot=case when jsonb_array_length(coalesce(p_photos,'[]'::jsonb))>0 then p_photos else photos_snapshot end,
    bio_snapshot=coalesce(p_bio,bio_snapshot), profile_prompt_snapshot=coalesce(p_prompt,profile_prompt_snapshot),
    night_intention_snapshot=coalesce(p_intention,night_intention_snapshot),
    socials_snapshot=case when p_socials <> '{}'::jsonb then p_socials else socials_snapshot end
  where event_id=p_event_id and user_id=p_user_id;
  return json_build_object('ok', true);
end $$;

-- ============================================================
-- DECK e MATCHES (array + tolerância a campos nulos)
-- ============================================================
drop function if exists public.mn_deck(uuid,uuid);
create or replace function public.mn_deck(p_event_id uuid, p_user_id uuid)
 returns table(participant_id uuid, display_name text, age int, gender text,
   bio text, profile_prompt text, night_intention text, photo_url text, photos jsonb, socials jsonb)
 language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; me public.mn_participants;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then return; end if;
  select * into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me.id is null or me.status<>'active' then return; end if;
  update public.mn_participants set last_seen_at=now() where id=me.id;
  return query
  select p.id, coalesce(p.display_name_snapshot,'Alguém'), p.age_snapshot, p.gender_snapshot,
         p.bio_snapshot, p.profile_prompt_snapshot, coalesce(p.night_intention_snapshot,''),
         coalesce(p.primary_photo_url_snapshot,''), coalesce(p.photos_snapshot,'[]'::jsonb),
         coalesce(p.socials_snapshot,'{}'::jsonb)
  from public.mn_participants p
  where p.event_id=p_event_id and p.id<>me.id and p.status='active'
    and public.mn_wants(me.interested_in_snapshot, p.gender_snapshot)
    and public.mn_wants(p.interested_in_snapshot, me.gender_snapshot)
    and not exists (select 1 from public.mn_likes l where l.event_id=p_event_id
        and l.from_participant_id=me.id and l.to_participant_id=p.id)
    and not exists (select 1 from public.mn_blocks b where b.event_id=p_event_id
        and ((b.blocker_participant_id=me.id and b.blocked_participant_id=p.id)
          or (b.blocker_participant_id=p.id and b.blocked_participant_id=me.id)))
    and not exists (select 1 from public.mn_reports r where r.event_id=p_event_id
        and r.reporter_participant_id=me.id and r.reported_participant_id=p.id)
  order by p.last_seen_at desc;
end $$;

drop function if exists public.mn_matches_list(uuid,uuid);
create or replace function public.mn_matches_list(p_event_id uuid, p_user_id uuid)
 returns table(match_id uuid, participant_id uuid, display_name text, age int,
   photo_url text, photos jsonb, night_intention text, instagram text, socials jsonb)
 language plpgsql stable security definer set search_path to 'public' as $$
declare e public.mn_events; me uuid;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then return; end if;
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then return; end if;
  return query
  select m.id, other.id, coalesce(other.display_name_snapshot,'Alguém'), other.age_snapshot,
    coalesce(other.primary_photo_url_snapshot,''), coalesce(other.photos_snapshot,'[]'::jsonb),
    coalesce(other.night_intention_snapshot,''),
    coalesce(other.socials_snapshot->>'instagram', ou.instagram_handle), coalesce(other.socials_snapshot,'{}'::jsonb)
  from public.mn_matches m
  join public.mn_participants other on other.id = case when m.participant_a_id=me then m.participant_b_id else m.participant_a_id end
  left join public.mn_users ou on ou.id = other.user_id
  where m.event_id=p_event_id and m.status='active'
    and (m.participant_a_id=me or m.participant_b_id=me) and other.status='active'
    and not exists (select 1 from public.mn_blocks b where b.event_id=p_event_id
        and ((b.blocker_participant_id=me and b.blocked_participant_id=other.id)
          or (b.blocker_participant_id=other.id and b.blocked_participant_id=me)))
  order by m.created_at desc;
end $$;

-- mn_join_event (bots): interested_in agora é text[]
drop function if exists public.mn_join_event(uuid,uuid,text,date,text,text,text,text,text,text,text,boolean,jsonb,jsonb);
create or replace function public.mn_join_event(
  p_event_id uuid, p_user_id uuid, p_display_name text, p_birthdate date,
  p_gender text, p_interested_in text[], p_photo_url text, p_bio text,
  p_prompt text, p_intention text, p_instagram text default null,
  p_consent boolean default false, p_photos jsonb default '[]'::jsonb, p_socials jsonb default '{}'::jsonb
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_age int; v_pid uuid; v_photos jsonb; v_primary text; v_socials jsonb;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;
  v_photos := case when jsonb_array_length(coalesce(p_photos,'[]'::jsonb))>0 then p_photos
                   when coalesce(p_photo_url,'')<>'' then jsonb_build_array(p_photo_url) else '[]'::jsonb end;
  v_primary := coalesce(v_photos->>0,'');
  v_socials := coalesce(p_socials,'{}'::jsonb);
  if coalesce(p_instagram,'')<>'' and (v_socials->>'instagram') is null then
    v_socials := v_socials || jsonb_build_object('instagram', p_instagram); end if;
  v_age := public.mn_age(p_birthdate);
  insert into public.mn_users(id, display_name, birthdate, gender, interested_in,
      primary_photo_url, photos, bio, profile_prompt, night_intention, instagram_handle, socials, updated_at)
  values (p_user_id, p_display_name, p_birthdate, p_gender, p_interested_in, v_primary, v_photos,
      p_bio, p_prompt, p_intention, coalesce(v_socials->>'instagram',p_instagram), v_socials, now())
  on conflict (id) do update set display_name=excluded.display_name, birthdate=excluded.birthdate,
      gender=excluded.gender, interested_in=excluded.interested_in, primary_photo_url=excluded.primary_photo_url,
      photos=excluded.photos, bio=excluded.bio, profile_prompt=excluded.profile_prompt,
      night_intention=excluded.night_intention, instagram_handle=excluded.instagram_handle, socials=excluded.socials, updated_at=now();
  insert into public.mn_participants(event_id, user_id, display_name_snapshot, age_snapshot, gender_snapshot,
      interested_in_snapshot, primary_photo_url_snapshot, photos_snapshot, bio_snapshot, profile_prompt_snapshot,
      night_intention_snapshot, socials_snapshot, status, expires_at, last_seen_at)
  values (p_event_id, p_user_id, p_display_name, v_age, p_gender, p_interested_in, v_primary, v_photos,
      p_bio, p_prompt, p_intention, v_socials, 'active', e.ends_at, now())
  on conflict (event_id, user_id) do update set status='active',
      display_name_snapshot=excluded.display_name_snapshot, age_snapshot=excluded.age_snapshot,
      gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
      primary_photo_url_snapshot=excluded.primary_photo_url_snapshot, photos_snapshot=excluded.photos_snapshot,
      bio_snapshot=excluded.bio_snapshot, profile_prompt_snapshot=excluded.profile_prompt_snapshot,
      night_intention_snapshot=excluded.night_intention_snapshot, socials_snapshot=excluded.socials_snapshot, last_seen_at=now()
  returning id into v_pid;
  return json_build_object('participant_id', v_pid, 'age', v_age);
end $$;

-- ============================================================
-- FUNIL DE ANALYTICS
-- ============================================================
create table if not exists public.mn_funnel (
  id bigint generated always as identity primary key,
  event_id uuid, user_id uuid, step text not null, variant text, meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists mn_funnel_event_idx on public.mn_funnel(event_id, step);
alter table public.mn_funnel enable row level security;

create or replace function public.mn_track(p_event_id uuid, p_user_id uuid, p_step text,
   p_variant text default null, p_meta jsonb default '{}'::jsonb)
 returns void language sql security definer set search_path to 'public' as $$
  insert into public.mn_funnel(event_id, user_id, step, variant, meta)
  values (p_event_id, p_user_id, p_step, p_variant, coalesce(p_meta,'{}'::jsonb));
$$;

-- relatório de funil p/ admin (contagem por passo)
create or replace function public.mn_admin_funnel(p_key text, p_event_id uuid)
 returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  return coalesce((select json_object_agg(step, n) from (
    select step, count(*)::int n from public.mn_funnel where event_id=p_event_id group by step) s), '{}'::json);
end $$;

-- ---------- GRANTS ----------
do $$ declare f text;
begin
  foreach f in array array[
    'mn_quick_join(uuid,uuid,text,text[],text,boolean)',
    'mn_set_prefs(uuid,uuid,text,text[],text)',
    'mn_complete_profile(uuid,uuid,text,date,jsonb,text,text,text,jsonb)',
    'mn_deck(uuid,uuid)','mn_matches_list(uuid,uuid)','mn_track(uuid,uuid,text,text,jsonb)',
    'mn_admin_funnel(text,uuid)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select 'onboarding schema ok' as status,
  (select count(*) from public.mn_participants where interested_in_snapshot is not null) as parts,
  (select count(*) from information_schema.tables where table_name='mn_funnel') as funnel;
