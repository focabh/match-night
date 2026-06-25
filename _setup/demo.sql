-- DEMO/teste do Match Night: evento com deck cheio + auto-match (só em is_demo).
alter table public.mn_events add column if not exists is_demo boolean not null default false;

-- gatilho demo-only: em evento is_demo, todo 'like' é reciprocado -> facilita
-- testar match sozinho. Em eventos reais (is_demo=false) é no-op. Loop-safe.
create or replace function public.mn_demo_autolike() returns trigger
 language plpgsql security definer set search_path to 'public' as $$
begin
  if NEW.action <> 'like' then return null; end if;
  if not exists (select 1 from public.mn_events e where e.id=NEW.event_id and e.is_demo) then return null; end if;
  insert into public.mn_likes(event_id, from_participant_id, to_participant_id, action)
  values (NEW.event_id, NEW.to_participant_id, NEW.from_participant_id, 'like')
  on conflict (event_id, from_participant_id, to_participant_id) do nothing;
  return null;
end $$;
drop trigger if exists trg_mn_demo_autolike on public.mn_likes;
create trigger trg_mn_demo_autolike after insert on public.mn_likes
  for each row execute function public.mn_demo_autolike();

-- (re)cria o evento demo
delete from public.mn_events where public_code='demo';
insert into public.mn_events(venue_name, name, public_code, description, starts_at, ends_at, status, is_demo)
values ('Bar do Teste','Sexta Solteira (DEMO)','demo','Vem ver quem ta na casa hoje 🍸',
        now()-interval '1 hour', now()+interval '12 hours', 'active', true);

-- seed de 8 participantes (bots) com fotos
do $$
declare eid uuid; names text[] := array['Bia','Marina','Júlia','Camila','Rafa','Lucas','Theo','Alex'];
  gens text[] := array['woman','woman','woman','woman','man','man','man','nonbinary'];
  prompts text[] := array['Vim dançar e rir','Topo um drink e papo bom','Me leva pro karaokê',
    'Cerveja gelada e boa conversa','Curto rock e gente sem frescura','Tô de boa, chega junto',
    'Bora ver no que dá','Só vibe boa hoje'];
  uid uuid; i int;
begin
  select id into eid from public.mn_events where public_code='demo';
  for i in 1..8 loop
    uid := gen_random_uuid();
    perform public.mn_join_event(eid, uid, names[i], (current_date - ((22 + i)||' years')::interval)::date,
      gens[i], 'all',
      'https://randomuser.me/api/portraits/'||(case when gens[i]='man' then 'men' else 'women' end)||'/'||(i*9)||'.jpg',
      null, prompts[i], 'Quero paquerar', '@'||lower(names[i])||i, true);
  end loop;
end $$;
select public_code, (select count(*) from public.mn_participants p where p.event_id=e.id) as gente
from public.mn_events e where public_code='demo';
