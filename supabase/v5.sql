-- ============================================================
-- V5 · Reaproveitar o perfil entre eventos.
-- Fotos/nome/bio/redes vivem em mn_users (persistente, por navegador).
-- Ao entrar num evento novo, mn_quick_join copia esse perfil pro snapshot
-- do participante -> a pessoa já entra COM foto/perfil em qualquer evento.
-- ============================================================
create or replace function public.mn_quick_join(
  p_event_id uuid, p_user_id uuid, p_gender text, p_interested_in text[],
  p_gender_detail text default null, p_consent boolean default false
) returns json language plpgsql security definer set search_path to 'public' as $$
declare e public.mn_events; v_pid uuid; v_sl int; u public.mn_users; v_age int;
begin
  select * into e from public.mn_events where id=p_event_id;
  if e.id is null then raise exception 'event_not_found'; end if;
  if not public.mn_is_live(e) then raise exception 'event_not_active'; end if;
  if not p_consent then raise exception 'consent_required'; end if;
  if coalesce(trim(p_gender),'')='' then raise exception 'gender_required'; end if;
  if p_interested_in is null or cardinality(p_interested_in)=0 then raise exception 'preference_required'; end if;
  v_sl := coalesce((e.matchmaker->>'super_like_quota')::int, 3);

  -- atualiza gênero/preferência SEM apagar foto/nome/bio já salvos
  insert into public.mn_users(id, gender, gender_detail, interested_in, updated_at)
  values (p_user_id, p_gender, p_gender_detail, p_interested_in, now())
  on conflict (id) do update set gender=excluded.gender, gender_detail=excluded.gender_detail,
    interested_in=excluded.interested_in, updated_at=now();

  select * into u from public.mn_users where id=p_user_id;   -- perfil persistente
  v_age := case when u.birthdate is null then null else public.mn_age(u.birthdate) end;

  -- snapshot do evento JÁ com o perfil reaproveitado
  insert into public.mn_participants(event_id, user_id, gender_snapshot, interested_in_snapshot,
     display_name_snapshot, age_snapshot, primary_photo_url_snapshot, photos_snapshot,
     bio_snapshot, profile_prompt_snapshot, night_intention_snapshot, socials_snapshot,
     status, expires_at, last_seen_at, super_likes_left)
  values (p_event_id, p_user_id, p_gender, p_interested_in,
     u.display_name, v_age, u.primary_photo_url, coalesce(u.photos,'[]'::jsonb),
     u.bio, u.profile_prompt, u.night_intention, coalesce(u.socials,'{}'::jsonb),
     'active', e.ends_at, now(), v_sl)
  on conflict (event_id, user_id) do update set status='active',
     gender_snapshot=excluded.gender_snapshot, interested_in_snapshot=excluded.interested_in_snapshot,
     -- reaproveita perfil só quando o snapshot deste evento ainda está vazio
     display_name_snapshot=coalesce(public.mn_participants.display_name_snapshot, excluded.display_name_snapshot),
     age_snapshot=coalesce(public.mn_participants.age_snapshot, excluded.age_snapshot),
     primary_photo_url_snapshot=coalesce(nullif(public.mn_participants.primary_photo_url_snapshot,''), excluded.primary_photo_url_snapshot),
     photos_snapshot=case when jsonb_array_length(coalesce(public.mn_participants.photos_snapshot,'[]'::jsonb))>0
                          then public.mn_participants.photos_snapshot else excluded.photos_snapshot end,
     bio_snapshot=coalesce(public.mn_participants.bio_snapshot, excluded.bio_snapshot),
     profile_prompt_snapshot=coalesce(public.mn_participants.profile_prompt_snapshot, excluded.profile_prompt_snapshot),
     night_intention_snapshot=coalesce(public.mn_participants.night_intention_snapshot, excluded.night_intention_snapshot),
     socials_snapshot=case when public.mn_participants.socials_snapshot <> '{}'::jsonb
                           then public.mn_participants.socials_snapshot else excluded.socials_snapshot end,
     super_likes_left=coalesce(public.mn_participants.super_likes_left, excluded.super_likes_left),
     last_seen_at=now()
  returning id into v_pid;
  return json_build_object('participant_id', v_pid, 'super_likes_left', v_sl);
end $$;
grant execute on function public.mn_quick_join(uuid,uuid,text,text[],text,boolean) to anon, authenticated;

-- mn_my_profile: se o snapshot do evento estiver vazio, cai pro perfil persistente
create or replace function public.mn_my_profile(p_event_id uuid, p_user_id uuid)
 returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce((select json_build_object(
      'photos', case when jsonb_array_length(coalesce(p.photos_snapshot,'[]'::jsonb))>0
                     then p.photos_snapshot else coalesce(u.photos,'[]'::jsonb) end,
      'display_name', coalesce(p.display_name_snapshot, u.display_name),
      'birthdate',    u.birthdate,
      'prompt',       coalesce(p.profile_prompt_snapshot, u.profile_prompt),
      'bio',          coalesce(p.bio_snapshot, u.bio),
      'intention',    coalesce(p.night_intention_snapshot, u.night_intention),
      'socials',      case when p.socials_snapshot <> '{}'::jsonb then p.socials_snapshot else coalesce(u.socials,'{}'::jsonb) end,
      'gender',       p.gender_snapshot, 'interested_in', p.interested_in_snapshot)
    from public.mn_participants p left join public.mn_users u on u.id=p.user_id
    where p.event_id=p_event_id and p.user_id=p_user_id limit 1),
    -- ainda não é participante deste evento: devolve o perfil persistente puro
    (select json_build_object('photos', coalesce(u.photos,'[]'::jsonb), 'display_name', u.display_name,
       'birthdate', u.birthdate, 'prompt', u.profile_prompt, 'bio', u.bio, 'intention', u.night_intention,
       'socials', coalesce(u.socials,'{}'::jsonb)) from public.mn_users u where u.id=p_user_id),
    '{}'::json);
$$;
grant execute on function public.mn_my_profile(uuid,uuid) to anon, authenticated;
select 'v5 reaproveitar perfil ok' as status;
