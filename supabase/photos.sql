-- ============================================================
-- MATCH NIGHT · FOTOS MÚLTIPLAS (estilo Tinder) + REDES SOCIAIS
-- mn_users/mn_participants ganham photos[] e socials{}. mn_join_event,
-- mn_deck e mn_matches_list passam a lidar com galeria + handles.
-- Estrutura pronta p/ fase 2 (importar fotos via Instagram OAuth).
-- ============================================================

alter table public.mn_users add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.mn_users add column if not exists socials jsonb not null default '{}'::jsonb;
alter table public.mn_participants add column if not exists photos_snapshot jsonb not null default '[]'::jsonb;
alter table public.mn_participants add column if not exists socials_snapshot jsonb not null default '{}'::jsonb;

-- backfill: quem já tinha 1 fota vira galeria de 1; instagram entra em socials
update public.mn_users
  set photos = case when jsonb_array_length(photos)=0 and coalesce(primary_photo_url,'')<>''
                    then jsonb_build_array(primary_photo_url) else photos end,
      socials = case when (socials->>'instagram') is null and coalesce(instagram_handle,'')<>''
                     then jsonb_build_object('instagram', instagram_handle) else socials end;
update public.mn_participants p
  set photos_snapshot = case when jsonb_array_length(photos_snapshot)=0 and coalesce(primary_photo_url_snapshot,'')<>''
                             then jsonb_build_array(primary_photo_url_snapshot) else photos_snapshot end,
      socials_snapshot = coalesce(nullif(p.socials_snapshot,'{}'::jsonb),
                          (select u.socials from public.mn_users u where u.id=p.user_id), '{}'::jsonb);

-- ---------- JOIN com galeria + socials ----------
drop function if exists public.mn_join_event(uuid,uuid,text,date,text,text,text,text,text,text,text,boolean);
create or replace function public.mn_join_event(
  p_event_id uuid, p_user_id uuid, p_display_name text, p_birthdate date,
  p_gender text, p_interested_in text, p_photo_url text, p_bio text,
  p_prompt text, p_intention text, p_instagram text default null,
  p_consent boolean default false, p_photos jsonb default '[]'::jsonb, p_socials jsonb default '{}'::jsonb
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_age int; v_pid uuid; v_photos jsonb; v_primary text; v_socials jsonb;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;

  -- monta galeria: usa p_photos se vier, senão cai pra foto única (compat)
  v_photos := case when jsonb_array_length(coalesce(p_photos,'[]'::jsonb)) > 0 then p_photos
                   when coalesce(p_photo_url,'')<>'' then jsonb_build_array(p_photo_url)
                   else '[]'::jsonb end;
  v_primary := coalesce(v_photos->>0, '');
  v_socials := coalesce(p_socials,'{}'::jsonb);
  if coalesce(p_instagram,'')<>'' and (v_socials->>'instagram') is null then
    v_socials := v_socials || jsonb_build_object('instagram', p_instagram);
  end if;

  if coalesce(trim(p_display_name),'')='' or p_birthdate is null
     or coalesce(p_gender,'')='' or coalesce(p_interested_in,'')=''
     or v_primary='' or coalesce(p_intention,'')='' then
    raise exception 'missing_required_fields'; end if;
  if coalesce(trim(coalesce(p_bio,'')||coalesce(p_prompt,'')),'')='' then
    raise exception 'bio_or_prompt_required'; end if;
  v_age := public.mn_age(p_birthdate);
  if v_age < 18 then raise exception 'underage'; end if;

  insert into public.mn_users(id, display_name, birthdate, gender, interested_in,
      primary_photo_url, photos, bio, profile_prompt, night_intention,
      instagram_handle, socials, updated_at)
  values (p_user_id, p_display_name, p_birthdate, p_gender, p_interested_in,
      v_primary, v_photos, p_bio, p_prompt, p_intention,
      coalesce(v_socials->>'instagram', p_instagram), v_socials, now())
  on conflict (id) do update set display_name=excluded.display_name, birthdate=excluded.birthdate,
      gender=excluded.gender, interested_in=excluded.interested_in,
      primary_photo_url=excluded.primary_photo_url, photos=excluded.photos, bio=excluded.bio,
      profile_prompt=excluded.profile_prompt, night_intention=excluded.night_intention,
      instagram_handle=excluded.instagram_handle, socials=excluded.socials, updated_at=now();

  insert into public.mn_participants(event_id, user_id, display_name_snapshot, age_snapshot,
      gender_snapshot, interested_in_snapshot, primary_photo_url_snapshot, photos_snapshot,
      bio_snapshot, profile_prompt_snapshot, night_intention_snapshot, socials_snapshot,
      status, expires_at, last_seen_at)
  values (p_event_id, p_user_id, p_display_name, v_age, p_gender, p_interested_in, v_primary, v_photos,
      p_bio, p_prompt, p_intention, v_socials, 'active', e.ends_at, now())
  on conflict (event_id, user_id) do update set status='active',
      display_name_snapshot=excluded.display_name_snapshot, age_snapshot=excluded.age_snapshot,
      gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
      primary_photo_url_snapshot=excluded.primary_photo_url_snapshot, photos_snapshot=excluded.photos_snapshot,
      bio_snapshot=excluded.bio_snapshot, profile_prompt_snapshot=excluded.profile_prompt_snapshot,
      night_intention_snapshot=excluded.night_intention_snapshot, socials_snapshot=excluded.socials_snapshot,
      last_seen_at=now()
  returning id into v_pid;
  return json_build_object('participant_id', v_pid, 'age', v_age);
end $$;

-- ---------- DECK com galeria + socials ----------
drop function if exists public.mn_deck(uuid,uuid);
create or replace function public.mn_deck(p_event_id uuid, p_user_id uuid)
 returns table(participant_id uuid, display_name text, age int, gender text,
   bio text, profile_prompt text, night_intention text, photo_url text,
   photos jsonb, socials jsonb)
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
         p.primary_photo_url_snapshot, p.photos_snapshot, p.socials_snapshot
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

-- ---------- MATCHES com galeria + socials ----------
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
  select m.id, other.id, other.display_name_snapshot, other.age_snapshot,
    other.primary_photo_url_snapshot, other.photos_snapshot, other.night_intention_snapshot,
    coalesce(other.socials_snapshot->>'instagram', ou.instagram_handle), other.socials_snapshot
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

-- re-grant
do $$ declare f text;
begin
  foreach f in array array[
    'mn_join_event(uuid,uuid,text,date,text,text,text,text,text,text,text,boolean,jsonb,jsonb)',
    'mn_deck(uuid,uuid)','mn_matches_list(uuid,uuid)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select 'photos+socials ok' as status,
  (select count(*) from public.mn_participants where jsonb_array_length(photos_snapshot)>0) as parts_com_foto;
