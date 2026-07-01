-- ============================================================
-- V4 · FIX perfil "some fotos": faltava carregar o perfil já salvo.
-- mn_my_profile devolve o snapshot atual do participante p/ hidratar a tela.
-- ============================================================
create or replace function public.mn_my_profile(p_event_id uuid, p_user_id uuid)
 returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce((select json_build_object(
      'photos',        coalesce(p.photos_snapshot, '[]'::jsonb),
      'display_name',  p.display_name_snapshot,
      'birthdate',     u.birthdate,
      'prompt',        p.profile_prompt_snapshot,
      'bio',           p.bio_snapshot,
      'intention',     p.night_intention_snapshot,
      'socials',       coalesce(p.socials_snapshot, '{}'::jsonb),
      'gender',        p.gender_snapshot,
      'interested_in', p.interested_in_snapshot
    )
    from public.mn_participants p
    left join public.mn_users u on u.id = p.user_id
    where p.event_id = p_event_id and p.user_id = p_user_id
    limit 1), '{}'::json);
$$;
grant execute on function public.mn_my_profile(uuid,uuid) to anon, authenticated;
select 'v4 mn_my_profile ok' as status;
