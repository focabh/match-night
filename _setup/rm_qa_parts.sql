-- remove participantes de teste (nome contém 'QA') de qualquer evento
do $$ declare r record; begin
  for r in select p.id, p.user_id, p.event_id from public.mn_participants p
           where p.display_name_snapshot ilike '%QA%' loop
    delete from public.mn_likes where event_id=r.event_id and (from_participant_id=r.id or to_participant_id=r.id);
    delete from public.mn_matches where event_id=r.event_id and (participant_a_id=r.id or participant_b_id=r.id);
    delete from public.mn_participants where id=r.id;
    delete from public.mn_users where id=r.user_id;
  end loop;
end $$;
select (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='laicos') as laicos_bots;
