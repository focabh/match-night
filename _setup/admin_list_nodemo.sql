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
  where not coalesce(e.is_demo, false)
  order by e.created_at desc;
end $$;
grant execute on function public.mn_admin_list_events(text) to anon, authenticated;
select 'admin list exclui demos' as status, count(*) as reais_no_painel
from public.mn_events where not coalesce(is_demo,false);
