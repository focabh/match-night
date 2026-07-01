create or replace function public.mn_qa_reuse() returns json language plpgsql as $$
declare v uuid:=gen_random_uuid(); e1 uuid; e2 uuid; prof2 json;
begin
  delete from public.mn_users where id=v;
  delete from public.mn_events where public_code in ('qae1','qae2');
  insert into public.mn_events(venue_name,name,public_code,slug,starts_at,ends_at,status,theme,matchmaker)
   values ('QA','E1','qae1','qa-e1',now()-interval '1h',now()+interval '2h','active','{}'::jsonb,'{}'::jsonb),
          ('QA','E2','qae2','qa-e2',now()-interval '1h',now()+interval '2h','active','{}'::jsonb,'{}'::jsonb);
  select id into e1 from public.mn_events where public_code='qae1';
  select id into e2 from public.mn_events where public_code='qae2';

  perform public.mn_quick_join(e1, v, 'man', array['all'], null, true);
  perform public.mn_complete_profile(e1, v, 'Foca', null,
     '["https://x/1.jpg","https://x/2.jpg"]'::jsonb, 'bio teste', null, 'Quero paquerar',
     '{"instagram":"foca"}'::jsonb);

  -- ENTRA NUM EVENTO NOVO -> deve reaproveitar as fotos/perfil
  perform public.mn_quick_join(e2, v, 'man', array['all'], null, true);
  prof2 := public.mn_my_profile(e2, v);

  delete from public.mn_users where id=v;
  delete from public.mn_events where public_code in ('qae1','qae2');
  return json_build_object('perfil_no_evento2', prof2);
end $$;
select public.mn_qa_reuse() as resultado;
drop function public.mn_qa_reuse();
