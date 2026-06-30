-- remove o participante de teste "Sofia QA" do Laicos
do $$ declare eid uuid; tid uuid; begin
  select id into eid from public.mn_events where public_code='laicos';
  select id into tid from public.mn_participants where event_id=eid and display_name_snapshot='Sofia QA';
  if tid is not null then
    delete from public.mn_likes where event_id=eid and (from_participant_id=tid or to_participant_id=tid);
    delete from public.mn_matches where event_id=eid and (participant_a_id=tid or participant_b_id=tid);
    delete from public.mn_users where id=(select user_id from public.mn_participants where id=tid);
    delete from public.mn_participants where id=tid;
  end if;
end $$;
-- remove o evento de teste criado pelo Studio na verificação
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where slug like 'bar-qa-studio%';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_rewards where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
  delete from public.mn_venues where slug like 'bar-qa-studio%';
end $$;
select (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='laicos') as laicos_bots,
       (select count(*) from public.mn_events where slug like 'bar-qa-studio%') as qa_events_restantes;
