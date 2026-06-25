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
