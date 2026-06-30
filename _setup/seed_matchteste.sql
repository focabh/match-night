-- ============================================================
-- SEED: evento de teste "matchteste" (UAT host kbxhzzzicyeexdbqdfnl)
-- Realista (is_demo=false -> sem banner de QA), deck cheio com fotos,
-- e auto-like SCOPED só neste evento (~65% das curtidas viram match).
-- Reverter: rodar _setup/teardown_matchteste.sql
-- ============================================================

-- limpa execuções anteriores deste mesmo seed (idempotente)
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='matchteste';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_likes where event_id=eid;
    delete from public.mn_matches where event_id=eid;
    delete from public.mn_blocks where event_id=eid;
    delete from public.mn_reports where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
end $$;

-- gatilho de reciprocidade SÓ deste evento (realista: ~65% retribui).
-- não mexe em outros eventos. fácil de dropar no teardown.
create or replace function public.mn_matchteste_autolike() returns trigger
 language plpgsql security definer set search_path to 'public' as $$
begin
  if NEW.action <> 'like' then return null; end if;
  if not exists (select 1 from public.mn_events e
       where e.id=NEW.event_id and e.public_code='matchteste') then return null; end if;
  if random() > 0.65 then return null; end if;  -- ~1/3 das curtidas NÃO retribui
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (NEW.event_id, NEW.to_participant_id, NEW.from_participant_id, 'like')
  on conflict (event_id, from_participant_id, to_participant_id) do nothing;
  return null;
end $$;
drop trigger if exists trg_mn_matchteste_autolike on public.mn_likes;
create trigger trg_mn_matchteste_autolike after insert on public.mn_likes
  for each row execute function public.mn_matchteste_autolike();

-- cria o evento (real, sem flag de demo)
insert into public.mn_events(venue_name, name, public_code, description, starts_at, ends_at, status, is_demo)
values ('Bar do Gomez','Quinta da Vitrola','matchteste',
        'Música boa, drink autoral e quem tá afim de companhia hoje 🍸',
        now()-interval '1 hour', now()+interval '12 hours', 'active', false);

-- 12 bots com fotos reais, gêneros variados, interested_in='all'
-- (deck enche pra qualquer preferência que você escolher).
do $$
declare
  eid uuid;
  names   text[] := array['Bia','Marina','Júlia','Camila','Sofia','Lucas','Théo','Rafa','Bruno','Diego','Alex','Sam'];
  gens    text[] := array['woman','woman','woman','woman','woman','man','man','man','man','man','nonbinary','nonbinary'];
  ages    int[]  := array[27,24,31,22,29,28,26,33,23,30,25,27];
  photos  text[] := array[
    'https://randomuser.me/api/portraits/women/44.jpg',
    'https://randomuser.me/api/portraits/women/68.jpg',
    'https://randomuser.me/api/portraits/women/21.jpg',
    'https://randomuser.me/api/portraits/women/33.jpg',
    'https://randomuser.me/api/portraits/women/79.jpg',
    'https://randomuser.me/api/portraits/men/32.jpg',
    'https://randomuser.me/api/portraits/men/45.jpg',
    'https://randomuser.me/api/portraits/men/11.jpg',
    'https://randomuser.me/api/portraits/men/67.jpg',
    'https://randomuser.me/api/portraits/men/83.jpg',
    'https://randomuser.me/api/portraits/men/52.jpg',
    'https://randomuser.me/api/portraits/women/12.jpg'];
  prompts text[] := array[
    'Hoje eu vim pra dançar até o bar fechar 💃',
    'Me paga um chopp e eu te conto a melhor história da noite',
    'Procurando alguém pra dividir a porção de batata 🍟',
    'Se curte rock e nada de papo furado, chega junto 🤘',
    'Vim de boa, mas se rolar química eu não fujo',
    'Topo karaokê, sinuca e conversa que presta',
    'Engenheiro de dia, DJ amador de madrugada 🎧',
    'Cerveja gelada + bom papo = noite perfeita',
    'Sou competitivo no pebolim, já te aviso',
    'Viajo o ano todo, hoje a parada é aqui mesmo ✈️',
    'Café, vinil e gente sem frescura',
    'Aqui só pra rir alto e conhecer gente nova'];
  intents text[] := array[
    'Quero paquerar','Conhecer gente nova','Ver no que dá','Quero paquerar',
    'Conversar sem pressão','Conhecer gente nova','Ver no que dá','Quero paquerar',
    'Conhecer gente nova','Ver no que dá','Conversar sem pressão','Conhecer gente nova'];
  uid uuid; i int;
begin
  select id into eid from public.mn_events where public_code='matchteste';
  for i in 1..array_length(names,1) loop
    uid := gen_random_uuid();
    perform public.mn_join_event(
      eid, uid,
      names[i],
      (current_date - (ages[i]||' years')::interval)::date,
      gens[i],
      'all',
      photos[i],
      null,
      prompts[i],
      intents[i],
      '@'||translate(lower(names[i]),'áéíóúâêãõç','aeiouaeaoc')||'_bh',
      true
    );
  end loop;
end $$;

-- relatório
select e.public_code, e.name, e.status,
  (public.mn_event_public('matchteste')->>'is_live') as is_live,
  (select count(*) from public.mn_participants p where p.event_id=e.id) as bots,
  (select string_agg(gender_snapshot||':'||count, ', ') from (
     select gender_snapshot, count(*)::text as count
     from public.mn_participants p where p.event_id=e.id
     group by gender_snapshot) g) as por_genero
from public.mn_events e where e.public_code='matchteste';
