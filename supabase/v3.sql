-- ============================================================
-- V3 · FIX P0
-- BUG2: mn_messages_list quebrava por "id" ambíguo (OUT param id x coluna id).
--       -> qualificar a tabela de participantes (mp.id).
-- BUG1: evento de validação 'foca' tinha theme.showcase='1' (auto-like) -> match
--       sem reciprocidade. Remover p/ exigir like recíproco real.
-- ============================================================

create or replace function public.mn_messages_list(p_event_id uuid, p_user_id uuid, p_match_id uuid)
 returns table(id bigint, mine boolean, kind text, body text, created_at timestamptz)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid;
begin
  select mp.id into me from public.mn_participants mp
    where mp.event_id=p_event_id and mp.user_id=p_user_id and mp.status='active';
  if me is null then return; end if;
  if not exists (select 1 from public.mn_matches m where m.id=p_match_id and (m.participant_a_id=me or m.participant_b_id=me)) then return; end if;
  return query select msg.id, (msg.from_participant_id=me), msg.kind, msg.body, msg.created_at
    from public.mn_messages msg where msg.match_id=p_match_id order by msg.created_at;
end $$;
grant execute on function public.mn_messages_list(uuid,uuid,uuid) to anon, authenticated;

-- BUG1: tira o auto-like do evento de validação (match só com reciprocidade real)
update public.mn_events set theme = theme - 'showcase' where public_code='foca';

select 'v3 fix ok' as status,
  (select theme->>'showcase' from public.mn_events where public_code='foca') as foca_showcase_deve_ser_null;
