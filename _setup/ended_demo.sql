delete from public.mn_events where public_code='ended';
insert into public.mn_events(venue_name, name, public_code, description, starts_at, ends_at, status, is_demo)
values ('Bar do Teste','Quinta que já passou (DEMO)','ended','-', now()-interval '6 hours', now()-interval '1 hour', 'ended', true);
select public_code, status, (public.mn_event_public('ended')->>'ended') as ended from public.mn_events where public_code='ended';
