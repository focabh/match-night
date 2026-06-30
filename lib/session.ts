'use client';
// Identidade anônima do MVP: um uuid por navegador (localStorage). Sem login.
const KEY = 'mn_user_id';

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// guarda os dados do perfil base pra reusar em outro evento (confirmar/ajustar)
const PKEY = 'mn_profile';
export function saveProfile(p: unknown) {
  try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {}
}
export function loadProfile<T>(): T | null {
  try { const v = localStorage.getItem(PKEY); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}

// Híbrido: lembra a última escolha do onboarding (gênero + preferência) p/ pré-preencher.
const OKEY = 'mn_onboard';
export type Onboard = { gender: string; gender_detail?: string; prefs: string[] };
export function saveOnboard(o: Onboard) { try { localStorage.setItem(OKEY, JSON.stringify(o)); } catch {} }
export function loadOnboard(): Onboard | null {
  try { const v = localStorage.getItem(OKEY); return v ? (JSON.parse(v) as Onboard) : null; } catch { return null; }
}
