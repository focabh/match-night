-- ============================================================
-- SHOWCASE: Laicos · "Noite Parisiense" (UAT kbxhzzzicyeexdbqdfnl)
-- Evento premium com identidade do local + prêmios + deck cheio + matches.
-- theme.showcase='1' liga o auto-like (~65%) p/ testar sozinho.
-- Reverter: _setup/teardown_laicos.sql
-- ============================================================

-- limpeza idempotente
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='laicos' or slug='laicos-noite-parisiense';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_rewards where event_id=eid;
    delete from public.mn_likes where event_id=eid;
    delete from public.mn_matches where event_id=eid;
    delete from public.mn_blocks where event_id=eid;
    delete from public.mn_reports where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
  delete from public.mn_venues where slug='laicos';
end $$;

-- auto-like reutilizável p/ eventos showcase (theme.showcase='1')
create or replace function public.mn_showcase_autolike() returns trigger
 language plpgsql security definer set search_path to 'public' as $$
begin
  if NEW.action <> 'like' then return null; end if;
  if not exists (select 1 from public.mn_events e where e.id=NEW.event_id and e.theme->>'showcase'='1') then return null; end if;
  if random() > 0.65 then return null; end if;
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (NEW.event_id, NEW.to_participant_id, NEW.from_participant_id, 'like')
  on conflict (event_id, from_participant_id, to_participant_id) do nothing;
  return null;
end $$;
drop trigger if exists trg_mn_showcase_autolike on public.mn_likes;
create trigger trg_mn_showcase_autolike after insert on public.mn_likes
  for each row execute function public.mn_showcase_autolike();

-- LOCAL: Laicos (identidade Paris/noite)
insert into public.mn_venues(name, slug, logo_url, cover_url, bg_url,
  primary_color, secondary_color, button_color, address, map_url, instagram, about, ambient_photos)
values ('Laicos', 'laicos',
  null,
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1000&q=70',
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1000&q=70',
  '#E8B339', '#232a6b', '#d6336c',
  'R. da Bahia, 1100 — Centro, BH',
  'https://maps.google.com/?q=Laicos+BH', '@laicos.bh',
  'Bistrô e bar com clima parisiense no coração de BH. Champagne, jazz e boa companhia.',
  '["https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=70","https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=70","https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=70"]'::jsonb);

-- EVENTO
insert into public.mn_events(venue_id, venue_name, name, public_code, slug, event_type,
   description, starts_at, ends_at, status, is_demo, theme, matchmaker)
select v.id, 'Laicos', 'Noite Parisiense', 'laicos', 'laicos-noite-parisiense', 'Festa Temática',
  'Champagne, jazz ao vivo e quem tá afim de companhia. Encontre seu par hoje. 🥂',
  now()-interval '1 hour', now()+interval '12 hours', 'active', false,
  jsonb_build_object(
    'showcase','1','template','tematica','emoji','🥂','headline','Noite Parisiense',
    'subcopy','Champagne, jazz ao vivo e o clima de Paris. Dê match e brinde a noite. ✨',
    'cta_label','Entrar na noite ✨',
    'cover_url','https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1000&q=70',
    'bg_url','https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1000&q=70',
    'logo_url','',
    'primary','#E8B339','secondary','#232a6b','button','#d6336c',
    'badges', jsonb_build_array('+18','Noite Parisiense','Open Espumante'),
    'rules', jsonb_build_array('Respeito sempre','Capriche no charme','O match vale só nesta noite')
  ),
  jsonb_build_object('enabled',true,'super_like_quota',3,
    'happy_hour', jsonb_build_object('enabled',true,'from','21:00','to','22:00'),
    'match_da_hora',true,'destaques',true,'age_min',18,'age_max',55,
    'audience','Solteiros(as) charmosos(as)','organizer_participates',false,'visibility','public')
from public.mn_venues v where v.slug='laicos';

-- PRÊMIOS
insert into public.mn_rewards(event_id, name, kind, emoji, qty_total, points_required, redeem_rule, valid_from, valid_to, sort)
select e.id, x.name, x.kind, x.emoji, x.qty, x.pts, x.rule, x.vf, x.vt, x.s
from public.mn_events e,
 (values
   ('Taça de espumante do match','drink','🥂',50,1,'Mostre seu 1º match no balcão','21:00','23:30',0),
   ('Combo Paris (2 drinks autorais)','combo','🍸',40,2,'Com 2 matches, no caixa','21:00','23:59',1),
   ('Mesa VIP da noite','vip','🎟️',3,5,'5 matches = mesa reservada','22:00','23:59',2)
 ) as x(name,kind,emoji,qty,pts,rule,vf,vt,s)
where e.public_code='laicos';

-- DECK: 12 bots com fotos, interested_in='all'
do $$
declare eid uuid;
  names text[] := array['Hélène','Camille','Bruna','Letícia','Manu','Théo','Henrique','Vince','Caio','Renan','Alex','Sam'];
  gens  text[] := array['woman','woman','woman','woman','woman','man','man','man','man','man','nonbinary','nonbinary'];
  ages  int[]  := array[28,25,31,23,29,30,27,34,24,32,26,28];
  photos text[] := array[
    'https://randomuser.me/api/portraits/women/65.jpg','https://randomuser.me/api/portraits/women/43.jpg',
    'https://randomuser.me/api/portraits/women/24.jpg','https://randomuser.me/api/portraits/women/76.jpg',
    'https://randomuser.me/api/portraits/women/9.jpg','https://randomuser.me/api/portraits/men/36.jpg',
    'https://randomuser.me/api/portraits/men/15.jpg','https://randomuser.me/api/portraits/men/41.jpg',
    'https://randomuser.me/api/portraits/men/22.jpg','https://randomuser.me/api/portraits/men/55.jpg',
    'https://randomuser.me/api/portraits/men/77.jpg','https://randomuser.me/api/portraits/women/18.jpg'];
  prompts text[] := array[
    'Bonsoir! Vim pelo champagne e pela boa conversa 🥂','Me ensina a dançar e eu te pago um drink',
    'Topo dividir uma taça e ver no que dá','Jazz + vinho tinto = minha noite perfeita',
    'Vim de boa, mas com charme francês','Procurando minha parceira de brinde da noite',
    'Engenheiro romântico (juro que existe)','Falo mais francês depois do segundo drink 😅',
    'Curto bistrô, vinil e gente sem pressa','Aqui pra rir e brindar a vida',
    'Café, arte e papo que presta','Só vibe boa e um bom espumante'];
  intents text[] := array[
    'Quero paquerar','Conhecer gente nova','Ver no que dá','Conversar sem pressão','Quero paquerar',
    'Quero paquerar','Conhecer gente nova','Ver no que dá','Conhecer gente nova','Ver no que dá',
    'Conversar sem pressão','Conhecer gente nova'];
  uid uuid; i int;
begin
  select id into eid from public.mn_events where public_code='laicos';
  for i in 1..array_length(names,1) loop
    uid := gen_random_uuid();
    perform public.mn_join_event(eid, uid, names[i],
      (current_date - (ages[i]||' years')::interval)::date, gens[i], 'all', photos[i],
      null, prompts[i], intents[i], '@'||translate(lower(names[i]),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')||'_paris', true);
  end loop;
end $$;

select e.slug, e.public_code, e.name,
  (public.mn_event_public('laicos')->>'is_live') as is_live,
  (select count(*) from public.mn_participants p where p.event_id=e.id) as bots,
  (select count(*) from public.mn_rewards r where r.event_id=e.id) as premios
from public.mn_events e where e.public_code='laicos';
