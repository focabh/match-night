-- dá 3 fotos a cada bot do Laicos (1ª = rosto; 2ª/3ª = lifestyle) p/ demonstrar o carrossel
do $$ declare eid uuid;
  life text[] := array[
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=70',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=70',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=70',
    'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=600&q=70',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=70'];
begin
  select id into eid from public.mn_events where public_code='laicos';
  update public.mn_participants p set photos_snapshot = jsonb_build_array(
      p.primary_photo_url_snapshot,
      life[1+(abs(hashtext(p.id::text)) % 5)],
      life[1+(abs(hashtext(p.id::text||'b')) % 5)])
  where p.event_id=eid;
  update public.mn_users u set photos = (
      select p.photos_snapshot from public.mn_participants p where p.user_id=u.id and p.event_id=eid limit 1)
  where u.id in (select user_id from public.mn_participants where event_id=eid);
end $$;
select count(*) as bots_com_galeria from public.mn_participants p
  join public.mn_events e on e.id=p.event_id
  where e.public_code='laicos' and jsonb_array_length(p.photos_snapshot)>=3;
