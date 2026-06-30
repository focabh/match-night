-- ============================================================
-- EVENTO DE VALIDAÇÃO: "Validar Match - Evento do Foca"
-- code 'foca' · slug 'validar-match-evento-do-foca' · vivo 24h
-- 8 perfis-semente (showcase autolike) p/ testar match/chat antes dos amigos.
-- Reverter: _setup/teardown_foca.sql
-- ============================================================
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='foca' or slug='validar-match-evento-do-foca';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_rewards where event_id=eid;
    delete from public.mn_messages where event_id=eid;
    delete from public.mn_likes where event_id=eid;
    delete from public.mn_matches where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
  delete from public.mn_venues where slug='evento-do-foca';
end $$;

insert into public.mn_venues(name, slug, primary_color, secondary_color, button_color, about)
values ('Evento do Foca','evento-do-foca','#ff3d7f','#7b5cff','#ff3d7f','Evento de validação do Matchmaker com a galera.');

insert into public.mn_events(venue_id, venue_name, name, public_code, slug, event_type,
   description, starts_at, ends_at, status, is_demo, theme, matchmaker)
select v.id, 'Evento do Foca', 'Validar Match', 'foca', 'validar-match-evento-do-foca', 'Festa',
  'Bora validar o Matchmaker! Curte, dá match e se acha aqui. 🎉',
  now()-interval '1 hour', now()+interval '24 hours', 'active', false,
  jsonb_build_object('showcase','1','template','singles','emoji','🎉','headline','Validar Match — Evento do Foca',
    'subcopy','Bora testar tudo: curtir, super like, match, chat e "se achar no rolê". 🎉',
    'cta_label','✨ Entrar no Matchmaker',
    'cover_url','https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1000&q=70',
    'bg_url','https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1000&q=70','logo_url','',
    'primary','#ff3d7f','secondary','#7b5cff','button','#ff3d7f',
    'badges', jsonb_build_array('+18','Validação','Ao vivo'),
    'rules', jsonb_build_array('Respeito sempre','É teste — relaxa e diverte','O match vale só nesta noite')),
  jsonb_build_object('enabled',true,'super_like_quota',3,
    'happy_hour', jsonb_build_object('enabled',true,'from','20:00','to','22:00'),
    'match_da_hora',true,'destaques',true,'age_min',18,'age_max',60,
    'audience','Galera do teste','organizer_participates',true,'visibility','public')
from public.mn_venues v where v.slug='evento-do-foca';

-- 8 perfis-semente com galeria
do $$
declare eid uuid;
  names text[] := array['Bia','Marina','Lucas','Théo','Manu','Rafa','Alex','Sam'];
  gens  text[] := array['woman','woman','man','man','woman','man','nonbinary','nonbinary'];
  ages  int[]  := array[27,24,29,31,26,33,25,28];
  photos text[] := array[
    'https://randomuser.me/api/portraits/women/44.jpg','https://randomuser.me/api/portraits/women/68.jpg',
    'https://randomuser.me/api/portraits/men/32.jpg','https://randomuser.me/api/portraits/men/45.jpg',
    'https://randomuser.me/api/portraits/women/21.jpg','https://randomuser.me/api/portraits/men/11.jpg',
    'https://randomuser.me/api/portraits/men/52.jpg','https://randomuser.me/api/portraits/women/12.jpg'];
  life text[] := array[
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=70',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=70',
    'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=600&q=70'];
  prompts text[] := array['Vim validar e paquerar 😏','Topo um drink e papo bom','Curto rock e gente sem frescura',
    'DJ amador, me chama','Bora dançar','Cerveja gelada + bom papo','Café e vinil','Só vibe boa hoje'];
  uid uuid; i int;
begin
  select id into eid from public.mn_events where public_code='foca';
  for i in 1..array_length(names,1) loop
    uid := gen_random_uuid();
    perform public.mn_join_event(eid, uid, names[i], (current_date-(ages[i]||' years')::interval)::date,
      gens[i], array['all'],
      photos[i],
      null, prompts[i], 'Quero paquerar', '@'||lower(names[i])||'_foca', true,
      jsonb_build_array(photos[i], life[1+(i % 3)], life[1+((i+1) % 3)]),
      jsonb_build_object('instagram','@'||lower(names[i])||'_foca'));
  end loop;
end $$;

select e.slug, e.public_code, e.name, (public.mn_event_public('foca')->>'is_live') as live,
  (select count(*) from public.mn_participants p where p.event_id=e.id) as perfis
from public.mn_events e where e.public_code='foca';
