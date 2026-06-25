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
grant execute on function public.mn_event_public(text) to anon, authenticated;
select public.mn_event_public('demo')->>'is_demo' as demo_flag;
