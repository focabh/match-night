delete from public.mn_events where public_code='qa1';
insert into public.mn_events(venue_name, name, public_code, description, starts_at, ends_at, status, is_demo)
values ('Bar QA','Evento QA Real','qa1','teste real', now()-interval '30 min', now()+interval '6 hours', 'active', false);
select public_code, status, (public.mn_event_public('qa1')->>'is_live') as live from public.mn_events where public_code='qa1';
