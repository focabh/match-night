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

  join: (eventId: string, userId: string, p: ProfileInput) =>
    rpc<{ participant_id: string; age: number }>('mn_join_event', {
      p_event_id: eventId, p_user_id: userId,
      p_display_name: p.display_name, p_birthdate: p.birthdate, p_gender: p.gender,
      p_interested_in: p.interested_in, p_photo_url: p.photo_url, p_bio: p.bio,
      p_prompt: p.prompt, p_intention: p.intention, p_instagram: p.instagram ?? null,
      p_consent: true,
      p_photos: (p.photos && p.photos.length ? p.photos : (p.photo_url ? [p.photo_url] : [])),
      p_socials: p.socials ?? {},
    }),

  deck: (eventId: string, userId: string) =>
    rpc<DeckPerson[]>('mn_deck', { p_event_id: eventId, p_user_id: userId }),

  swipe: (eventId: string, userId: string, target: string, action: 'like' | 'pass') =>
    rpc<{ matched: boolean; match_id?: string }>('mn_swipe', {
      p_event_id: eventId, p_user_id: userId, p_target: target, p_action: action,
    }),

  matches: (eventId: string, userId: string) =>
    rpc<MatchRow[]>('mn_matches_list', { p_event_id: eventId, p_user_id: userId }),

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
