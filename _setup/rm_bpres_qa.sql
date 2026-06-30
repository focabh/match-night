-- remove usuários de teste do B Presencial (quick-join sem nome) + zera funil de teste
do $$ declare r record; begin
  for r in select p.id, p.user_id, p.event_id from public.mn_participants p
    join public.mn_events e on e.id=p.event_id
    where e.public_code in ('laicos','matchteste') and p.display_name_snapshot is null loop
    delete from public.mn_likes   where event_id=r.event_id and (from_participant_id=r.id or to_participant_id=r.id);
    delete from public.mn_matches where event_id=r.event_id and (participant_a_id=r.id or participant_b_id=r.id);
    delete from public.mn_participants where id=r.id;
    delete from public.mn_users where id=r.user_id;
  end loop;
  delete from public.mn_funnel where event_id in (select id from public.mn_events where public_code in ('laicos','matchteste'));
end $$;
select (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='laicos') as laicos_bots,
       (select count(*) from public.mn_funnel) as funnel_rows;
