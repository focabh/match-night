'use client';
import { supabase } from './supabaseClient';
import type { DeckPerson, EventPublic, MatchRow, ProfileInput } from './types';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  eventByCode: (code: string) => rpc<EventPublic | null>('mn_event_public', { p_code: code }),

  myParticipation: (eventId: string, userId: string) =>
    rpc<{ participant_id: string; status: string } | null>('mn_my_participation', {
      p_event_id: eventId, p_user_id: userId,
    }),

  // ENTRADA RÁPIDA (B Presencial): só gênero + preferência multi-seleção
  quickJoin: (eventId: string, userId: string, gender: string, interestedIn: string[], genderDetail?: string) =>
    rpc<{ participant_id: string }>('mn_quick_join', {
      p_event_id: eventId, p_user_id: userId, p_gender: gender,
      p_interested_in: interestedIn, p_gender_detail: genderDetail ?? null, p_consent: true,
    }),

  // alterar preferências durante o evento
  setPrefs: (eventId: string, userId: string, gender: string, interestedIn: string[], genderDetail?: string) =>
    rpc<void>('mn_set_prefs', {
      p_event_id: eventId, p_user_id: userId, p_gender: gender,
      p_interested_in: interestedIn, p_gender_detail: genderDetail ?? null,
    }),

  // completar perfil DEPOIS de entrar (opcional)
  completeProfile: (eventId: string, userId: string, p: Partial<ProfileInput>) =>
    rpc<{ ok: boolean }>('mn_complete_profile', {
      p_event_id: eventId, p_user_id: userId,
      p_display_name: p.display_name ?? null, p_birthdate: p.birthdate || null,
      p_photos: p.photos ?? [], p_bio: p.bio ?? null, p_prompt: p.prompt ?? null,
      p_intention: p.intention ?? null,
      p_socials: { instagram: p.instagram, ...(p.socials ?? {}) },
    }),

  // funil de analytics (fire-and-forget)
  track: (eventId: string, userId: string, step: string, variant?: string, meta?: Record<string, unknown>) =>
    rpc<void>('mn_track', { p_event_id: eventId, p_user_id: userId, p_step: step, p_variant: variant ?? null, p_meta: meta ?? {} }).catch(() => {}),

  deck: (eventId: string, userId: string) =>
    rpc<DeckPerson[]>('mn_deck', { p_event_id: eventId, p_user_id: userId }),

  swipe: (eventId: string, userId: string, target: string, action: 'like' | 'pass' | 'superlike') =>
    rpc<{ matched: boolean; match_id?: string; super?: boolean }>('mn_swipe', {
      p_event_id: eventId, p_user_id: userId, p_target: target, p_action: action,
    }),

  myState: (eventId: string, userId: string) =>
    rpc<{ super_likes_left: number; has_photo: boolean; active: number }>('mn_my_state', { p_event_id: eventId, p_user_id: userId }),

  matches: (eventId: string, userId: string) =>
    rpc<MatchRow[]>('mn_matches_list', { p_event_id: eventId, p_user_id: userId }),

  messages: (eventId: string, userId: string, matchId: string) =>
    rpc<any[]>('mn_messages_list', { p_event_id: eventId, p_user_id: userId, p_match_id: matchId }),
  sendMessage: (eventId: string, userId: string, matchId: string, kind: string, body: string) =>
    rpc<{ ok: boolean }>('mn_send_message', { p_event_id: eventId, p_user_id: userId, p_match_id: matchId, p_kind: kind, p_body: body }),
  unmatch: (eventId: string, userId: string, matchId: string) =>
    rpc<void>('mn_unmatch', { p_event_id: eventId, p_user_id: userId, p_match_id: matchId }),
  unswipe: (eventId: string, userId: string, target: string) =>
    rpc<void>('mn_unswipe', { p_event_id: eventId, p_user_id: userId, p_target: target }),

  block: (eventId: string, userId: string, target: string) =>
    rpc<void>('mn_block', { p_event_id: eventId, p_user_id: userId, p_target: target }),

  report: (eventId: string, userId: string, target: string, reason: string) =>
    rpc<void>('mn_report', { p_event_id: eventId, p_user_id: userId, p_target: target, p_reason: reason }),

  leave: (eventId: string, userId: string) =>
    rpc<void>('mn_leave_event', { p_event_id: eventId, p_user_id: userId }),
};

// ---- Studio (criador de evento personalizado; gated por admin key) ----
export const studioApi = {
  listVenues: (key: string) => rpc<any[]>('mn_studio_list_venues', { p_key: key }),
  upsertVenue: (key: string, venue: Record<string, any>) =>
    rpc<any>('mn_studio_upsert_venue', { p_key: key, p: venue }),
  createEvent: (key: string, payload: Record<string, any>) =>
    rpc<{ event_id: string; public_code: string; slug: string }>('mn_studio_create_event', { p_key: key, p: payload }),
  updateEvent: (key: string, eventId: string, payload: Record<string, any>) =>
    rpc<{ ok: boolean }>('mn_studio_update_event', { p_key: key, p_event_id: eventId, p: payload }),
  publicList: () => rpc<any[]>('mn_events_public_list', {}),
};

// ---- Admin (chave compartilhada no MVP) ----
export const adminApi = {
  list: (key: string) => rpc<any[]>('mn_admin_list_events', { p_key: key }),
  create: (key: string, name: string, venue: string, description: string, starts: string, ends: string) =>
    rpc<{ event_id: string; public_code: string }>('mn_admin_create_event', {
      p_key: key, p_name: name, p_venue: venue, p_description: description, p_starts: starts, p_ends: ends,
    }),
  end: (key: string, eventId: string) => rpc<void>('mn_admin_end_event', { p_key: key, p_event_id: eventId }),
  expire: (key: string) => rpc<{ ok: boolean; eventos_ativos: number }>('mn_admin_expire', { p_key: key }),
  stats: (key: string, eventId: string) => rpc<any>('mn_admin_stats', { p_key: key, p_event_id: eventId }),
};
