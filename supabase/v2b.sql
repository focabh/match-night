-- desfazer último like/pass (se não virou match) + refund de super like
create or replace function public.mn_unswipe(p_event_id uuid, p_user_id uuid, p_target uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid; v_super boolean; a uuid; b uuid;
begin
  select id into me from public.mn_participants where event_id=p_event_id and user_id=p_user_id and status='active';
  if me is null then return; end if;
  a := least(me, p_target); b := greatest(me, p_target);
  if exists (select 1 from public.mn_matches where event_id=p_event_id and participant_a_id=a and participant_b_id=b and status='active') then
    return; -- já virou match: não desfaz por engano
  end if;
  select is_super into v_super from public.mn_likes where event_id=p_event_id and from_participant_id=me and to_participant_id=p_target;
  delete from public.mn_likes where event_id=p_event_id and from_participant_id=me and to_participant_id=p_target;
  if coalesce(v_super,false) then update public.mn_participants set super_likes_left=coalesce(super_likes_left,0)+1 where id=me; end if;
end $$;

-- estado do usuário inclui a própria foto (p/ tela de match)
create or replace function public.mn_my_state(p_event_id uuid, p_user_id uuid)
 returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce((select json_build_object(
      'super_likes_left', coalesce(p.super_likes_left,0),
      'has_photo', (coalesce(p.primary_photo_url_snapshot,'')<>'' or jsonb_array_length(coalesce(p.photos_snapshot,'[]'::jsonb))>0),
      'my_photo', coalesce(p.primary_photo_url_snapshot,''),
      'active', (select count(*)::int from public.mn_participants q where q.event_id=p_event_id and q.status='active')
    ) from public.mn_participants p where p.event_id=p_event_id and p.user_id=p_user_id), '{}'::json);
$$;

do $$ begin
  execute 'grant execute on function public.mn_unswipe(uuid,uuid,uuid) to anon, authenticated';
  execute 'grant execute on function public.mn_my_state(uuid,uuid) to anon, authenticated';
end $$;
select 'v2b ok' as status;
