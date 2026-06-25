create or replace function public.mn_admin_expire(p_key text)
 returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._mn_admin_ok(p_key) then raise exception 'admin_unauthorized'; end if;
  perform public.mn_expire_events();
  return json_build_object('ok', true,
    'eventos_ativos', (select count(*) from public.mn_events where status='active'));
end $$;
grant execute on function public.mn_admin_expire(text) to anon, authenticated;
select 'mn_admin_expire ok' as status;
