-- Deixa o evento de validação vivo até pedido manual de encerramento.
update public.mn_events
   set ends_at = now() + interval '400 days', status = 'active', updated_at = now()
 where public_code = 'foca';
select public_code, status,
  (public.mn_event_public('foca')->>'is_live') as is_live,
  ends_at
from public.mn_events where public_code='foca';
