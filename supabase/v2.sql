-- ============================================================
-- MATCH NIGHT · V2 (pós-match): chat presencial, super likes, undo/unmatch,
-- revelação pós-match, estado do usuário. Host: UAT kbxhzzzicyeexdbqdfnl.
-- ============================================================

-- super likes por participante + flag no like
alter table public.mn_participants add column if not exists super_likes_left int;
alter table public.mn_likes add column if not exists is_super boolean not null default false;

-- mensagens (conversa por match) — ponte p/ encontro presencial
create table if not exists public.mn_messages (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.mn_events(id) on delete cascade,
  match_id uuid not null references public.mn_matches(id) on delete cascade,
  from_participant_id uuid not null references public.mn_participants(id) on delete cascade,
  kind text not null default 'text',  -- text | here | wave | meet
  body text,
  created_at timestamptz not null default now()
);
create index if not exists mn_messages_match_idx on public.mn_messages(match_id, created_at);
alter table public.mn_messages enable row level security;

-- quick_join passa a semear super_likes_left a partir da config do evento
create or replace function public.mn_quick_join(
  p_event_id uuid, p_user_id uuid, p_gender text, p_interested_in text[],
  p_gender_detail text default null, p_consent boolean default false
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_pid uuid; v_sl int;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;
  if coalesce(trim(p_gender),'')='' then raise exception 'gender_required'; end if;
  if p_interested_in is null or cardinality(p_interested_in)=0 then raise exception 'preference_required'; end if;
  v_sl := coalesce((e.matchmaker->>'super_like_quota')::int, 3);

  insert into public.mn_users(id, gender, gender_detail, interested_in, updated_at)
  values (p_user_id, p_gender, p_gender_detail, p_interested_in, now())
  on conflict (id) do update set gender=excluded.gender, gender_detail=excluded.gender_detail,
    interested_in=excluded.interested_in, updated_at=now();

  insert into public.mn_participants(event_id, user_id, gender_snapshot, interested_in_snapshot,
     status, expires_at, last_seen_at, super_likes_left)
  values (p_event_id, p_user_id, p_gender, p_interested_in, 'active', e.ends_at, now(), v_sl)
  on conflict (event_id, user_id) do update set status='active',
     gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
     last_seen_at=now(), super_likes_left=coalesce(public.mn_participants.super_likes_left, excluded.super_likes_left)
  returning id into v_pid;
  return json_build_object('participant_id', v_pid, 'super_likes_left', v_sl);
end $$;

-- estado do usuário no evento (super likes restantes, tem foto)
create or replace function public.mn_my_state(p_event_id uuid, p_user_id uuid)
 returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce((select json_build_object(
      'super_likes_left', coalesce(p.super_likes_left,0),
      'has_photo', (coalesce(p.primary_photo_url_snapshot,'')<>'' or jsonb_array_length(coalesce(p.photos_snapshot,'[]'::jsonb))>0),
      'active', (select count(*)::int from public.mn_participants q where q.event_id=p_event_id and q.status='active')
    ) from public.mn_participants p where p.event_id=p_event_id and p.user_id=p_user_id), '{}'::json);
$$;

-- SWIPE com superlike (like/pass/superlike) + flag is_super + decremento de cota
create or replace function public.mn_swipe(p_event_id uuid, p_user_id uuid, p_target uuid, p_action text)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; me uuid; v_match uuid; v_reciprocal boolean; a uuid; b uuid;
  v_super boolean; v_store text; v_left int;
begin
  if p_action not in ('like','pass','superlike') then raise exception 'invalid_action'; end if;
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  select id, super_likes_left into me, v_left from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then raise exception 'not_active_participant'; end if;
  if me = p_target then raise exception 'cannot_swipe_self'; end if;
  if not exists (select 1 from public.mn_participants where id=p_target and event_id=p_event_id and status='active') then
    raise exception 'target_not_active'; end if;
  v_super := (p_action='superlike');
  if v_super and coalesce(v_left,0) <= 0 then raise exception 'no_superlikes'; end if;
  v_store := case when p_action='pass' then 'pass' else 'like' end;
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action, is_super)
  values (p_event_id, me, p_target, v_store, v_super)
  on conflict (event_id, from_participant_id, to_participant_id)
    do update set action=excluded.action, is_super=(public.mn_likes.is_super or excluded.is_super), created_at=now();
  if v_super then update public.mn_participants set super_likes_left=greatest(0,coalesce(super_likes_left,0)-1) where id=me; end if;
  if v_store <> 'like' then return json_build_object('matched', false); end if;
  select exists(select 1 from public.mn_likes where event_id=p_event_id
      and from_participant_id=p_target and to_participant_id=me and action='like') into v_reciprocal;
  if not v_reciprocal then return json_build_object('matched', false, 'super', v_super); end if;
  a := least(me, p_target); b := greatest(me, p_target);
  insert into public.mn_matches(event_id, participant_a_id, participant_b_id, status, expires_at)
  values (p_event_id, a, b, 'active', e.ends_at) on conflict (event_id, participant_a_id, participant_b_id) do update set status='active';
  select id into v_match from public.mn_matches where event_id=p_event_id and participant_a_id=a and participant_b_id=b;
  return json_build_object('matched', true, 'match_id', v_match, 'super', v_super);
end $$;

-- matches_list agora revela bio/prompt (revelação pós-match)
drop function if exists public.mn_matches_list(uuid,uuid);
create or replace function public.mn_matches_list(p_event_id uuid, p_user_id uuid)
 returns table(match_id uuid, participant_id uuid, display_name text, age int,
   photo_url text, photos jsonb, night_intention text, instagram text, socials jsonb,
   bio text, profile_prompt text, last_message text, last_at timestamptz)
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
    coalesce(other.socials_snapshot->>'instagram', ou.instagram_handle), coalesce(other.socials_snapshot,'{}'::jsonb),
    other.bio_snapshot, other.profile_prompt_snapshot,
    (select msg.body from public.mn_messages msg where msg.match_id=m.id order by msg.created_at desc limit 1),
    (select msg.created_at from public.mn_messages msg where msg.match_id=m.id order by msg.created_at desc limit 1)
  from public.mn_matches m
  join public.mn_participants other on other.id = case when m.participant_a_id=me then m.participant_b_id else m.participant_a_id end
  left join public.mn_users ou on ou.id = other.user_id
  where m.event_id=p_event_id and m.status='active'
    and (m.participant_a_id=me or m.participant_b_id=me) and other.status='active'
    and not exists (select 1 from public.mn_blocks b where b.event_id=p_event_id
        and ((b.blocker_participant_id=me and b.blocked_participant_id=other.id)
          or (b.blocker_participant_id=other.id and b.blocked_participant_id=me)))
  order by coalesce((select max(created_at) from public.mn_messages msg where msg.match_id=m.id), m.created_at) desc;
end $$;

-- ---------- CONVERSA ----------
create or replace function public.mn_send_message(p_event_id uuid, p_user_id uuid, p_match_id uuid, p_kind text, p_body text)
 returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then raise exception 'not_active_participant'; end if;
  if not exists (select 1 from public.mn_matches m where m.id=p_match_id and m.event_id=p_event_id and m.status='active'
      and (m.participant_a_id=me or m.participant_b_id=me)) then raise exception 'not_in_match'; end if;
  insert into public.mn_messages(event_id, match_id, from_participant_id, kind, body)
  values (p_event_id, p_match_id, me, coalesce(nullif(p_kind,''),'text'), p_body);
  return json_build_object('ok', true);
end $$;

create or replace function public.mn_messages_list(p_event_id uuid, p_user_id uuid, p_match_id uuid)
 returns table(id bigint, mine boolean, kind text, body text, created_at timestamptz)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then return; end if;
  if not exists (select 1 from public.mn_matches m where m.id=p_match_id and (m.participant_a_id=me or m.participant_b_id=me)) then return; end if;
  return query select msg.id, (msg.from_participant_id=me), msg.kind, msg.body, msg.created_at
    from public.mn_messages msg where msg.match_id=p_match_id order by msg.created_at;
end $$;

-- desfazer match (escopo do evento): encerra, some das listas, evita rematch hoje
create or replace function public.mn_unmatch(p_event_id uuid, p_user_id uuid, p_match_id uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid; other uuid; m public.mn_matches;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id;
  if me is null then return; end if;
  select * into m from public.mn_matches where id=p_match_id and (participant_a_id=me or participant_b_id=me);
  if m.id is null then return; end if;
  other := case when m.participant_a_id=me then m.participant_b_id else m.participant_a_id end;
  update public.mn_matches set status='expired' where id=p_match_id;
  -- pass nos dois sentidos: impede reaparecer/rematch neste evento
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (p_event_id, me, other, 'pass') on conflict (event_id, from_participant_id, to_participant_id) do update set action='pass';
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (p_event_id, other, me, 'pass') on conflict (event_id, from_participant_id, to_participant_id) do update set action='pass';
end $$;

-- ---------- GRANTS ----------
do $$ declare f text;
begin
  foreach f in array array[
    'mn_quick_join(uuid,uuid,text,text[],text,boolean)','mn_my_state(uuid,uuid)',
    'mn_swipe(uuid,uuid,uuid,text)','mn_matches_list(uuid,uuid)',
    'mn_send_message(uuid,uuid,uuid,text,text)','mn_messages_list(uuid,uuid,uuid)',
    'mn_unmatch(uuid,uuid,uuid)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select 'v2 schema ok' as status,
  (select count(*) from information_schema.tables where table_name='mn_messages') as messages_tbl,
  (select count(*) from information_schema.columns where table_name='mn_participants' and column_name='super_likes_left') as sl_col;
