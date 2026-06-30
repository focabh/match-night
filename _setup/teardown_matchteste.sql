-- ============================================================
-- TEARDOWN: remove TUDO do evento de teste "matchteste".
-- Deixa o banco exatamente como estava antes do seed.
-- ============================================================
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='matchteste';
  if eid is not null then
    -- usuários (bots + quem testou) ligados a este evento
    delete from public.mn_users where id in (
      select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_likes       where event_id=eid;
    delete from public.mn_matches     where event_id=eid;
    delete from public.mn_blocks      where event_id=eid;
    delete from public.mn_reports     where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events      where id=eid;
  end if;
end $$;

-- remove o gatilho/função exclusivos deste teste
drop trigger if exists trg_mn_matchteste_autolike on public.mn_likes;
drop function if exists public.mn_matchteste_autolike();

select 'teardown matchteste ok' as status,
  (select count(*) from public.mn_events where public_code='matchteste') as eventos_restantes;
