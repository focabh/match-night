-- remove eventos/venues de teste de QA (venue com 'QA' no nome)
do $$ declare r record; begin
  for r in select id, venue_id from public.mn_events
           where venue_name ilike '%qa%' or slug like 'bar-do-quick%' or slug like 'bar-qa-studio%' loop
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=r.id);
    delete from public.mn_rewards where event_id=r.id;
    delete from public.mn_likes where event_id=r.id;
    delete from public.mn_matches where event_id=r.id;
    delete from public.mn_participants where event_id=r.id;
    delete from public.mn_events where id=r.id;
    if r.venue_id is not null then delete from public.mn_venues where id=r.venue_id; end if;
  end loop;
  delete from public.mn_venues where name ilike '%qa%' or slug like 'bar-do-quick%' or slug like 'bar-qa-studio%';
end $$;
select (select count(*) from public.mn_events where venue_name ilike '%qa%') as qa_events,
       (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='laicos') as laicos_bots;
