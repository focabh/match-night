-- remove usuários de teste (sem nome) do evento do Foca + zera funil de teste do evento
do $$ declare eid uuid; r record; begin
  select id into eid from public.mn_events where public_code='foca';
  if eid is null then return; end if;
  for r in select p.id, p.user_id from public.mn_participants p where p.event_id=eid and p.display_name_snapshot is null loop
    delete from public.mn_messages where event_id=eid and from_participant_id=r.id;
    delete from public.mn_likes where event_id=eid and (from_participant_id=r.id or to_participant_id=r.id);
    delete from public.mn_matches where event_id=eid and (participant_a_id=r.id or participant_b_id=r.id);
    delete from public.mn_participants where id=r.id;
    delete from public.mn_users where id=r.user_id;
  end loop;
  delete from public.mn_funnel where event_id=eid;
end $$;
select (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='foca') as perfis_foca;
