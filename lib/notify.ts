'use client';
// Notificações do sistema (opt-in de 1 toque; o browser exige permissão explícita).
export function notifSupported() { return typeof window !== 'undefined' && 'Notification' in window; }
export function notifOn() {
  return notifSupported() && localStorage.getItem('mn_notif') === 'on' && Notification.permission === 'granted';
}
export async function enableNotif(): Promise<boolean> {
  if (!notifSupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { return false; } }
  if (perm === 'granted') { localStorage.setItem('mn_notif', 'on'); return true; }
  localStorage.setItem('mn_notif', 'off'); return false;
}
export function disableNotif() { localStorage.setItem('mn_notif', 'off'); }
export function fireNotif(title: string, body: string) {
  try { if (notifOn()) new Notification(title, { body }); } catch {}
}
