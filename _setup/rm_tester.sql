do $$ declare eid uuid; tid uuid; begin
  select id into eid from public.mn_events where public_code='matchteste';
  select id into tid from public.mn_participants where event_id=eid and display_name_snapshot='Tester';
  if tid is not null then
    delete from public.mn_likes   where event_id=eid and (from_participant_id=tid or to_participant_id=tid);
    delete from public.mn_matches where event_id=eid and (participant_a_id=tid or participant_b_id=tid);
    delete from public.mn_users   where id=(select user_id from public.mn_participants where id=tid);
    delete from public.mn_participants where id=tid;
  end if;
end $$;
select count(*) as bots_restantes
from public.mn_participants p join public.mn_events e on e.id=p.event_id
where e.public_code='matchteste';
