-- ============================================================
-- V6 · Notificações: mn_matches_list passa a dizer se a última mensagem
-- foi minha (last_from_me) — pro app calcular "não lidas" e avisar de msg nova.
-- ============================================================
drop function if exists public.mn_matches_list(uuid,uuid);
create or replace function public.mn_matches_list(p_event_id uuid, p_user_id uuid)
 returns table(match_id uuid, participant_id uuid, display_name text, age int,
   photo_url text, photos jsonb, night_intention text, instagram text, socials jsonb,
   bio text, profile_prompt text, last_message text, last_at timestamptz, last_from_me boolean)
 language plpgsql stable security definer set search_path to 'public' as $$
declare e public.mn_events; me uuid;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null or not public.mn_is_live(e) then return; end if;
  select mp.id into me from public.mn_participants mp where mp.event_id=p_event_id and mp.user_id=p_user_id and mp.status='active';
  if me is null then return; end if;
  return query
  select m.id, other.id, coalesce(other.display_name_snapshot,'Alguém'), other.age_snapshot,
    coalesce(other.primary_photo_url_snapshot,''), coalesce(other.photos_snapshot,'[]'::jsonb),
    coalesce(other.night_intention_snapshot,''),
    coalesce(other.socials_snapshot->>'instagram', ou.instagram_handle), coalesce(other.socials_snapshot,'{}'::jsonb),
    other.bio_snapshot, other.profile_prompt_snapshot,
    (select msg.body from public.mn_messages msg where msg.match_id=m.id order by msg.created_at desc limit 1),
    (select msg.created_at from public.mn_messages msg where msg.match_id=m.id order by msg.created_at desc limit 1),
    (select msg.from_participant_id=me from public.mn_messages msg where msg.match_id=m.id order by msg.created_at desc limit 1)
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
grant execute on function public.mn_matches_list(uuid,uuid) to anon, authenticated;
select 'v6 last_from_me ok' as status;
