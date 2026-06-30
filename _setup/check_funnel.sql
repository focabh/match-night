select step, count(*) n
from public.mn_funnel
where event_id = (select id from public.mn_events where public_code='laicos')
group by step order by n desc;
