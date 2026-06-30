-- Remove o showcase Laicos por completo.
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='laicos' or slug='laicos-noite-parisiense';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_rewards where event_id=eid;
    delete from public.mn_likes where event_id=eid;
    delete from public.mn_matches where event_id=eid;
    delete from public.mn_blocks where event_id=eid;
    delete from public.mn_reports where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
  delete from public.mn_venues where slug='laicos';
end $$;
-- o trigger mn_showcase_autolike é genérico; só removê-lo se nenhum showcase restar
do $$ begin
  if not exists (select 1 from public.mn_events where theme->>'showcase'='1') then
    drop trigger if exists trg_mn_showcase_autolike on public.mn_likes;
    drop function if exists public.mn_showcase_autolike();
  end if;
end $$;
select 'teardown laicos ok' as status;
