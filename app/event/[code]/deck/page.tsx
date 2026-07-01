'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { getUserId, loadOnboard, saveOnboard } from '@/lib/session';
import { themeOf } from '@/lib/studio';
import { GENDER_OPTS, PREF_OPTS, PREF_ALL, normalizePrefs, expandPrefs, type DeckPerson, type EventPublic } from '@/lib/types';
import { ProfileCard } from '@/components/ProfileCard';
import { EventTabs } from '@/components/EventTabs';
import { EventEnded, EmptyDeck, LeftEvent } from '@/components/States';

type Undo = { target: string; prevI: number; isSuper: boolean; label: string };
type MatchInfo = { who: DeckPerson; matchId?: string; isSuper?: boolean };

export default function Deck() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const uid = getUserId();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const [people, setPeople] = useState<DeckPerson[] | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [left, setLeft] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [state, setState] = useState<{ super_likes_left: number; has_photo: boolean; my_photo?: string; active: number } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [photoPrompt, setPhotoPrompt] = useState<null | { name: string }>(null);
  const [openProfile, setOpenProfile] = useState<DeckPerson | null>(null);
  const undoTimer = useRef<any>(null);
  const once = useRef<Record<string, boolean>>({});

  const x = useMotionValue(0);
  const rot = useTransform(x, [-200, 200], [-14, 14]);
  const likeOp = useTransform(x, [40, 140], [0, 1]);
  const passOp = useTransform(x, [-40, -140], [0, 1]);

  const load = useCallback(async () => {
    const e = await api.eventByCode(code); setEv(e);
    if (e && e.is_live && !e.ended) {
      setPeople(await api.deck(e.event_id, uid).catch(() => []));
      api.myState(e.event_id, uid).then(setState).catch(() => {});
    }
  }, [code, uid]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (ev?.event_id && people && people.length && !once.current.card) { once.current.card = true; api.track(ev.event_id, uid, 'first_card'); }
    // só sugere completar perfil pra quem ainda NÃO tem foto (perfil é reaproveitado entre eventos)
    if (typeof window !== 'undefined' && state) {
      setNudge(!state.has_photo && !localStorage.getItem(`mn_done_${code}`));
    }
  }, [ev, people, uid, code, state]);

  function track(step: string, meta?: Record<string, unknown>) { if (ev) api.track(ev.event_id, uid, step, undefined, meta); }

  if (left) return <LeftEvent code={code} />;
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  if (!ev || people === null) return <Splash />;

  const person = people[i];
  const t = themeOf(ev);
  const remaining = Math.max(0, people.length - i - 1);
  const sl = state?.super_likes_left ?? 0;

  async function act(action: 'like' | 'pass' | 'superlike', who: DeckPerson) {
    if (busy) return; setBusy(true);
    const prevI = i;
    if (action !== 'pass' && !once.current.like) { once.current.like = true; track('first_like'); }
    if (action === 'superlike') track('superlike_used');
    try {
      const r = await api.swipe(ev!.event_id, uid, who.participant_id, action);
      if (action === 'superlike') setState((s) => s ? { ...s, super_likes_left: Math.max(0, s.super_likes_left - 1) } : s);
      if (r.matched) {
        setMatch({ who, matchId: r.match_id, isSuper: r.super });
        if (!once.current.match) { once.current.match = true; track('first_match'); }
        setUndo(null);
      } else {
        // undo 5s (não some no match)
        clearTimeout(undoTimer.current);
        setUndo({ target: who.participant_id, prevI, isSuper: action === 'superlike', label: action === 'pass' ? `Passou ${who.display_name}` : `Curtiu ${who.display_name}` });
        undoTimer.current = setTimeout(() => setUndo(null), 5000);
      }
      // foto no 1º like (pulável) — não atrapalha a celebração de match
      if (action !== 'pass' && !r.matched && state && !state.has_photo && !once.current.photoAsk) {
        once.current.photoAsk = true; setPhotoPrompt({ name: who.display_name });
      }
    } catch (e: any) {
      if (String(e.message).includes('event_not_active')) { setEv({ ...ev!, ended: true, is_live: false }); return; }
    } finally { setI((v) => v + 1); x.set(0); setBusy(false); }
  }
  function fling(action: 'like' | 'pass') {
    if (!person) return;
    animate(x, action === 'like' ? 400 : -400, { duration: 0.25 });
    setTimeout(() => act(action, person), 120);
  }
  async function doUndo() {
    if (!undo) return;
    await api.unswipe(ev!.event_id, uid, undo.target).catch(() => {});
    track('undo_like');
    if (undo.isSuper) setState((s) => s ? { ...s, super_likes_left: s.super_likes_left + 1 } : s);
    setI(undo.prevI); x.set(0); setUndo(null); clearTimeout(undoTimer.current);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <EventTabs code={code} active="deck" theme={t}
        right={<button onClick={() => setShowPrefs(true)} aria-label="Alterar preferências" className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card border border-line text-sm">⚙️</button>} />
      <div className="px-5 pt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: t.primary }}>● {ev.name}</div>

      {nudge && (
        <button onClick={() => router.push(`/event/${code}/perfil`)}
          className="mx-5 mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm"
          style={{ borderColor: t.primary + '55', background: t.primary + '12' }}>
          <span>✨</span><span className="flex-1 font-semibold">Adicione foto e nome — você dá muito mais match</span>
          <span style={{ color: t.primary }} className="font-bold">Completar</span>
          <span onClick={(e) => { e.stopPropagation(); localStorage.setItem(`mn_done_${code}`, '1'); setNudge(false); }} className="px-1 text-muted">✕</span>
        </button>
      )}

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden px-5 py-4">
        {!person ? <EmptyDeck onRefresh={() => { setI(0); load(); }} /> : (
          <div className="relative flex-1 min-h-0">
            {people[i + 1] && (<div className="absolute inset-0 scale-95 opacity-60"><ProfileCard p={people[i + 1]} /></div>)}
            <motion.div className="absolute inset-0" style={{ x, rotate: rot }}
              drag="x" dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => { if (info.offset.x > 120) fling('like'); else if (info.offset.x < -120) fling('pass'); else animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 }); }}>
              <ProfileCard p={person} onOpen={() => { track('profile_open'); setOpenProfile(person); }}
                onReport={async () => { await api.report(ev.event_id, uid, person.participant_id, 'inapropriado').catch(() => {}); track('report'); setI((v) => v + 1); }}
                onBlock={async () => { await api.block(ev.event_id, uid, person.participant_id).catch(() => {}); track('block'); setI((v) => v + 1); }} />
              <motion.div style={{ opacity: likeOp }} className="pointer-events-none absolute top-8 left-6 rotate-[-12deg] rounded-xl border-4 border-glow px-3 py-1 text-2xl font-black text-glow">CURTI</motion.div>
              <motion.div style={{ opacity: passOp }} className="pointer-events-none absolute top-8 right-6 rotate-[12deg] rounded-xl border-4 border-white/70 px-3 py-1 text-2xl font-black text-white/80">PASSO</motion.div>
            </motion.div>
          </div>
        )}
      </section>

      {/* undo toast */}
      {undo && (
        <div className="mx-5 mb-1 flex items-center gap-3 rounded-full border border-line bg-ink2 px-4 py-2 text-sm">
          <span className="flex-1 text-muted">{undo.label}</span>
          <button onClick={doUndo} className="font-bold" style={{ color: t.primary }}>↩︎ Desfazer</button>
        </div>
      )}

      {person && (
        <footer className="flex items-center justify-center gap-5 px-5 pb-8">
          <button onClick={() => fling('pass')} disabled={busy} className="btn h-[58px] w-[58px] grid place-items-center bg-card border border-line text-2xl">✕</button>
          <button onClick={() => sl > 0 && act('superlike', person)} disabled={busy || sl <= 0}
            className="btn relative h-12 w-12 grid place-items-center rounded-full text-xl disabled:opacity-40"
            style={{ background: t.secondary + '26', color: t.secondary, border: `1px solid ${t.secondary}` }} aria-label="Super like">
            ⭐{sl > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: t.secondary }}>{sl}</span>}
          </button>
          <button onClick={() => fling('like')} disabled={busy} className="btn h-20 w-20 grid place-items-center text-3xl shadow-neon" style={{ background: t.button }}>❤</button>
        </footer>
      )}

      {match && <MatchModal info={match} me={state?.my_photo} ev={ev} theme={t} remaining={remaining} superLeft={sl}
        onChat={(find) => router.push(`/event/${code}/chat/${match.matchId}${find ? '?find=1' : ''}`)}
        onClose={() => setMatch(null)} />}
      {showPrefs && <PrefsSheet eventId={ev.event_id} theme={t} onClose={() => setShowPrefs(false)} onSaved={() => { setShowPrefs(false); setI(0); load(); track('prefs_changed'); }} />}
      {openProfile && <ProfileSheet p={openProfile} theme={t} onClose={() => setOpenProfile(null)}
        onAct={(a) => { const who = openProfile; setOpenProfile(null); act(a, who); }} />}
      {photoPrompt && <PhotoPrompt name={photoPrompt.name} theme={t} eventId={ev.event_id}
        onDone={() => { setState((s) => s ? { ...s, has_photo: true } : s); localStorage.setItem(`mn_hasphoto`, '1'); track('photo_added', { at: 'first_like' }); setPhotoPrompt(null); }}
        onSkip={() => setPhotoPrompt(null)} />}
    </main>
  );
}

function Splash() { return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando a noite…</main>; }

// Perfil ao tocar na pessoa (deck): fotos + nome/idade/intenção + ações.
// Revelação pós-match: bio/redes NÃO aparecem aqui (só depois do match).
function ProfileSheet({ p, theme, onClose, onAct }: { p: DeckPerson; theme: any; onClose: () => void; onAct: (a: 'like' | 'pass' | 'superlike') => void }) {
  const photos = ((p.photos && p.photos.length ? p.photos : [p.photo_url]).filter(Boolean)) as string[];
  const [i, setI] = useState(0);
  const cur = photos[Math.min(i, photos.length - 1)] || p.photo_url;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-ink2 border-t border-line" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/5] w-full bg-card">
          {cur ? <img src={cur} alt="" className="absolute inset-0 h-full w-full object-cover" />
               : <div className="absolute inset-0 grid place-items-center text-7xl text-white" style={{ background: 'radial-gradient(120% 90% at 50% 0%,#3a2e8c,#1b1326)' }}>{(p.display_name || '🙂').charAt(0).toUpperCase()}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-2 flex gap-1">{photos.map((_, k) => <div key={k} className="h-1 flex-1 rounded-full" style={{ background: k === i ? '#fff' : 'rgba(255,255,255,.35)' }} />)}</div>
              <button className="absolute left-0 top-0 h-full w-1/3" onClick={() => setI((v) => Math.max(0, v - 1))} aria-label="anterior" />
              <button className="absolute right-0 top-0 h-full w-1/3" onClick={() => setI((v) => Math.min(photos.length - 1, v + 1))} aria-label="próxima" />
            </>
          )}
          <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">✕</button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end gap-2"><h2 className="text-3xl font-black">{p.display_name}</h2>{p.age ? <span className="text-2xl font-bold text-white/80">{p.age}</span> : null}</div>
            {p.night_intention && <div className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: theme.primary + '33', color: '#fff' }}>{p.night_intention}</div>}
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-white/70">🔓 Bio, prompts e redes aparecem quando vocês derem match.</p>
          <div className="mt-4 flex items-center justify-center gap-5">
            <button onClick={() => onAct('pass')} className="btn h-14 w-14 grid place-items-center bg-card border border-line text-xl">✕</button>
            <button onClick={() => onAct('superlike')} className="btn h-12 w-12 grid place-items-center rounded-full text-lg" style={{ background: theme.secondary + '26', color: theme.secondary, border: `1px solid ${theme.secondary}` }}>⭐</button>
            <button onClick={() => onAct('like')} className="btn h-16 w-16 grid place-items-center text-2xl text-white shadow-neon" style={{ background: theme.button }}>❤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Foto no 1º like (pulável; o like já foi registrado) ----
function PhotoPrompt({ name, theme, eventId, onDone, onSkip }: { name: string; theme: any; eventId: string; onDone: () => void; onSkip: () => void }) {
  const [up, setUp] = useState(false); const [err, setErr] = useState('');
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (f.size > 8_388_608) { setErr('Foto até 8MB.'); return; }
    setUp(true); setErr('');
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${getUserId()}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('mn-photos').upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      const url = supabase.storage.from('mn-photos').getPublicUrl(path).data.publicUrl;
      await api.completeProfile(eventId, getUserId(), { photos: [url] });
      onDone();
    } catch { setErr('Não rolou enviar. Tenta de novo.'); } finally { setUp(false); }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-end" onClick={onSkip}>
      <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-ink2 border-t border-line p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl">📸</div>
        <h3 className="mt-2 text-xl font-black">Seu like já foi! 💛</h3>
        <p className="mt-1 text-sm text-muted">Adicione uma foto pra {name} te reconhecer no rolê.</p>
        <label className="btn mt-5 block w-full py-3.5 font-bold text-white cursor-pointer" style={{ background: theme.button }}>
          {up ? 'Enviando…' : '📷 Tirar / escolher foto'}
          <input type="file" accept="image/*" capture="user" onChange={pick} className="hidden" disabled={up} />
        </label>
        {err && <p className="mt-2 text-xs text-glow">{err}</p>}
        <button onClick={onSkip} className="btn mt-2 w-full py-3 text-muted">Agora não</button>
      </div>
    </div>
  );
}

// ---- Celebração de match + ações contextuais ----
function MatchModal({ info, me, ev, theme, remaining, superLeft, onChat, onClose }: { info: MatchInfo; me?: string; ev: EventPublic; theme: any; remaining: number; superLeft: number; onChat: (find?: boolean) => void; onClose: () => void }) {
  const p = info.who;
  const mm: any = (ev as any).matchmaker || {};
  const endsMs = new Date(ev.ends_at).getTime() - Date.now();
  const endingSoon = endsMs > 0 && endsMs < 60 * 60 * 1000;
  const hh = mm.happy_hour || {};
  const hhActive = hh.enabled && withinHH(hh.from, hh.to);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6" style={{ background: 'rgba(8,5,14,.88)' }}>
      <Confetti />
      <div className="animate-pop w-full max-w-xs text-center">
        <div className="text-sm font-black uppercase tracking-widest" style={{ color: theme.primary }}>🎉 Vocês deram match{info.isSuper ? ' ⭐' : ''}</div>
        <h2 className="mt-2 text-3xl font-black break-words">Você e {p.display_name} se curtiram</h2>
        <div className="mt-6 flex items-center justify-center">
          <Avatar src={me} ring={theme.secondary} />
          <div className="z-10 -mx-3 text-2xl">💞</div>
          <Avatar src={p.photo_url} ring={theme.button} name={p.display_name} />
        </div>

        {hhActive && <div className="mt-5 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: '#ff6b3522', color: '#ff8a5b' }}>🔥 Happy Hour rolando — aproveita agora</div>}
        {endingSoon && <div className="mt-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: '#ffb54722', color: '#ffb547' }}>⏳ A noite tá acabando — não perca o encontro</div>}

        <button onClick={() => onChat(false)} className="btn mt-6 w-full py-4 text-lg font-bold" style={{ background: theme.button, color: '#fff' }}>💬 Mandar mensagem</button>
        <button onClick={() => onChat(true)} className="btn mt-2 w-full py-3.5 font-bold" style={{ background: theme.secondary + '26', color: '#fff', border: `1px solid ${theme.secondary}` }}>📍 Encontrar no evento</button>
        {superLeft > 0 && <div className="mt-3 text-xs text-muted">⭐ Você ainda tem {superLeft} Super Like{superLeft > 1 ? 's' : ''}</div>}
        <button onClick={onClose} className="btn mt-2 w-full py-3 text-muted">{remaining > 0 ? `✨ Continuar — ainda há ${remaining} por descobrir` : 'Continuar'}</button>
      </div>
    </div>
  );
}
function Avatar({ src, ring, name }: { src?: string; ring: string; name?: string }) {
  return src
    ? <img src={src} alt="" className="h-24 w-24 rounded-full object-cover border-4 shadow-neon" style={{ borderColor: ring }} />
    : <div className="grid h-24 w-24 place-items-center rounded-full border-4 text-3xl shadow-neon" style={{ borderColor: ring, background: '#1b1326' }}>{(name || '🙂').charAt(0).toUpperCase()}</div>;
}
function withinHH(from?: string, to?: string) {
  if (!from || !to) return false;
  const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(':').map(Number); const [th, tm] = to.split(':').map(Number);
  const a = fh * 60 + fm, b = th * 60 + tm;
  return b >= a ? cur >= a && cur <= b : (cur >= a || cur <= b);
}
function Confetti() {
  const bits = ['🎉', '✨', '💞', '🎊', '⭐'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }).map((_, k) => (
        <span key={k} className="animate-pop absolute text-xl" style={{ left: `${(k * 53) % 100}%`, top: `${(k * 31) % 60}%`, animationDelay: `${(k % 5) * 0.08}s`, opacity: .9 }}>{bits[k % bits.length]}</span>
      ))}
    </div>
  );
}

function PrefsSheet({ eventId, theme, onClose, onSaved }: { eventId: string; theme: any; onClose: () => void; onSaved: () => void }) {
  const saved = loadOnboard();
  const [gender, setGender] = useState(saved?.gender || '');
  const [prefs, setPrefs] = useState<string[]>(expandPrefs(saved?.prefs));
  const [busy, setBusy] = useState(false);
  const allOn = PREF_ALL.every((v) => prefs.includes(v));
  const toggle = (v: string) => setPrefs((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  async function save() {
    if (!gender || prefs.length === 0) return; setBusy(true);
    try { await api.setPrefs(eventId, getUserId(), gender, normalizePrefs(prefs), undefined); saveOnboard({ gender, prefs }); onSaved(); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={onClose}>
      <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-ink2 border-t border-line p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black">Alterar preferências</h3>
        <p className="mt-1 text-xs text-muted">Quem você quer conhecer</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PREF_OPTS.map((o) => (<button key={o.v} onClick={() => toggle(o.v)} className="chip" style={{ borderColor: prefs.includes(o.v) ? theme.primary : 'var(--line)', background: prefs.includes(o.v) ? theme.primary + '22' : 'transparent', color: '#fff' }}>{o.l}</button>))}
          <button onClick={() => setPrefs(allOn ? [] : [...PREF_ALL])} className="chip" style={{ borderColor: allOn ? theme.primary : 'rgba(255,255,255,.25)', color: '#fff' }}>⚡ Todos</button>
        </div>
        <p className="mt-4 text-xs text-muted">Sobre você</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GENDER_OPTS.filter((o) => o.v !== 'other').map((o) => (<button key={o.v} onClick={() => setGender(o.v)} className="chip" style={{ borderColor: gender === o.v ? theme.secondary : 'rgba(255,255,255,.2)', background: gender === o.v ? theme.secondary + '22' : 'transparent', color: '#fff' }}>{o.l}</button>))}
        </div>
        <button onClick={save} disabled={busy} className="btn mt-5 w-full py-3.5 font-bold text-white" style={{ background: theme.button }}>{busy ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="btn mt-2 w-full py-3 text-muted">Cancelar</button>
      </div>
    </div>
  );
}
