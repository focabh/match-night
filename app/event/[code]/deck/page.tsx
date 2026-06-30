'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { api } from '@/lib/api';
import { getUserId, loadOnboard, saveOnboard } from '@/lib/session';
import { themeOf } from '@/lib/studio';
import { GENDER_OPTS, PREF_OPTS, PREF_ALL, normalizePrefs, expandPrefs, type DeckPerson, type EventPublic } from '@/lib/types';
import { ProfileCard } from '@/components/ProfileCard';
import { EventEnded, EmptyDeck, LeftEvent } from '@/components/States';

export default function Deck() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const uid = getUserId();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const [people, setPeople] = useState<DeckPerson[] | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<DeckPerson | null>(null);
  const [left, setLeft] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [nudge, setNudge] = useState(false);
  const once = useRef<Record<string, boolean>>({});

  const x = useMotionValue(0);
  const rot = useTransform(x, [-200, 200], [-14, 14]);
  const likeOp = useTransform(x, [40, 140], [0, 1]);
  const passOp = useTransform(x, [-40, -140], [0, 1]);

  const load = useCallback(async () => {
    const e = await api.eventByCode(code); setEv(e);
    if (e && e.is_live && !e.ended) setPeople(await api.deck(e.event_id, uid).catch(() => []));
  }, [code, uid]);
  useEffect(() => { load(); }, [load]);

  // funil: primeiro card visível + nudge de completar perfil
  useEffect(() => {
    if (ev?.event_id && people && people.length && !once.current.card) {
      once.current.card = true;
      api.track(ev.event_id, uid, 'first_card');
    }
    if (typeof window !== 'undefined' && !localStorage.getItem(`mn_done_${code}`)) setNudge(true);
  }, [ev, people, uid, code]);

  function track(step: string, meta?: Record<string, unknown>) { if (ev) api.track(ev.event_id, uid, step, undefined, meta); }

  if (left) return <LeftEvent code={code} />;
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  if (!ev || people === null) return <Splash />;

  const person = people[i];
  const t = themeOf(ev);

  async function act(action: 'like' | 'pass', who: DeckPerson) {
    if (busy) return; setBusy(true);
    if (action === 'like' && !once.current.like) { once.current.like = true; track('first_like'); }
    try {
      const r = await api.swipe(ev!.event_id, uid, who.participant_id, action);
      if (r.matched) { setMatch(who); if (!once.current.match) { once.current.match = true; track('first_match'); } }
    } catch (e: any) {
      if (String(e.message).includes('event_not_active')) { setEv({ ...ev!, ended: true, is_live: false }); return; }
    } finally {
      setI((v) => v + 1); x.set(0); setBusy(false);
    }
  }
  function fling(action: 'like' | 'pass') {
    if (!person) return;
    animate(x, action === 'like' ? 400 : -400, { duration: 0.25 });
    setTimeout(() => act(action, person), 120);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-5 pt-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.primary }}>Ao vivo neste evento</div>
          <div className="truncate font-black">{ev.name}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowPrefs(true)} aria-label="Alterar preferências" className="btn h-9 w-9 grid place-items-center bg-card border border-line text-sm">⚙️</button>
          <button onClick={() => router.push(`/event/${code}/matches`)} className="btn bg-card border border-line px-3 py-2 text-sm">💜 Matches</button>
          <button onClick={async () => { await api.leave(ev.event_id, uid).catch(() => {}); setLeft(true); }} className="btn px-2 py-2 text-sm text-muted">Sair</button>
        </div>
      </header>

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
              onDragEnd={(_, info) => {
                if (info.offset.x > 120) fling('like');
                else if (info.offset.x < -120) fling('pass');
                else animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 });
              }}>
              <ProfileCard p={person}
                onReport={async () => { await api.report(ev.event_id, uid, person.participant_id, 'inapropriado').catch(() => {}); setI((v) => v + 1); }}
                onBlock={async () => { await api.block(ev.event_id, uid, person.participant_id).catch(() => {}); setI((v) => v + 1); }} />
              <motion.div style={{ opacity: likeOp }} className="pointer-events-none absolute top-8 left-6 rotate-[-12deg] rounded-xl border-4 border-glow px-3 py-1 text-2xl font-black text-glow">CURTI</motion.div>
              <motion.div style={{ opacity: passOp }} className="pointer-events-none absolute top-8 right-6 rotate-[12deg] rounded-xl border-4 border-white/70 px-3 py-1 text-2xl font-black text-white/80">PASSO</motion.div>
            </motion.div>
          </div>
        )}
      </section>

      {person && (
        <footer className="flex items-center justify-center gap-6 px-5 pb-8">
          <button onClick={() => fling('pass')} disabled={busy} className="btn h-16 w-16 grid place-items-center bg-card border border-line text-2xl">✕</button>
          <button onClick={() => fling('like')} disabled={busy} className="btn h-20 w-20 grid place-items-center text-3xl shadow-neon" style={{ background: t.button }}>❤</button>
        </footer>
      )}

      {match && <MatchModal p={match} accent={t.button} primary={t.primary} onChat={() => router.push(`/event/${code}/matches`)} onClose={() => setMatch(null)} />}
      {showPrefs && <PrefsSheet code={code} eventId={ev.event_id} theme={t} onClose={() => setShowPrefs(false)} onSaved={() => { setShowPrefs(false); setI(0); load(); track('prefs_changed'); }} />}
    </main>
  );
}

function Splash() { return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando a noite…</main>; }

// ⚙️ Alterar preferências (durante o evento)
function PrefsSheet({ code, eventId, theme, onClose, onSaved }: { code: string; eventId: string; theme: any; onClose: () => void; onSaved: () => void }) {
  const saved = loadOnboard();
  const [gender, setGender] = useState(saved?.gender || '');
  const [prefs, setPrefs] = useState<string[]>(expandPrefs(saved?.prefs));
  const [busy, setBusy] = useState(false);
  const allOn = PREF_ALL.every((v) => prefs.includes(v));
  const toggle = (v: string) => setPrefs((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  async function save() {
    if (!gender || prefs.length === 0) return;
    setBusy(true);
    try {
      await api.setPrefs(eventId, getUserId(), gender, normalizePrefs(prefs), undefined);
      saveOnboard({ gender, prefs });
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={onClose}>
      <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-ink2 border-t border-line p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black">Alterar preferências</h3>
        <p className="mt-1 text-xs text-muted">Quem você quer conhecer</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PREF_OPTS.map((o) => (
            <button key={o.v} onClick={() => toggle(o.v)} className="chip" style={{ borderColor: prefs.includes(o.v) ? theme.primary : 'var(--line)', background: prefs.includes(o.v) ? theme.primary + '22' : 'transparent', color: '#fff' }}>{o.l}</button>
          ))}
          <button onClick={() => setPrefs(allOn ? [] : [...PREF_ALL])} className="chip" style={{ borderColor: allOn ? theme.primary : 'rgba(255,255,255,.25)', color: '#fff' }}>⚡ Todos</button>
        </div>
        <p className="mt-4 text-xs text-muted">Sobre você</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GENDER_OPTS.filter((o) => o.v !== 'other').map((o) => (
            <button key={o.v} onClick={() => setGender(o.v)} className="chip" style={{ borderColor: gender === o.v ? theme.secondary : 'rgba(255,255,255,.2)', background: gender === o.v ? theme.secondary + '22' : 'transparent', color: '#fff' }}>{o.l}</button>
          ))}
        </div>
        <button onClick={save} disabled={busy} className="btn mt-5 w-full py-3.5 font-bold text-white" style={{ background: theme.button }}>{busy ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="btn mt-2 w-full py-3 text-muted">Cancelar</button>
      </div>
    </div>
  );
}

function MatchModal({ p, onChat, onClose, accent = '#ff3d7f', primary = '#ff3d7f' }: { p: DeckPerson; onChat: () => void; onClose: () => void; accent?: string; primary?: string }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur flex items-center justify-center px-6">
      <div className="animate-pop text-center w-full max-w-xs">
        <div className="text-sm font-black uppercase tracking-widest" style={{ color: primary }}>Deu match na casa</div>
        <h2 className="mt-2 text-3xl font-black break-words">Você e {p.display_name} se curtiram 🔥</h2>
        {p.photo_url
          ? <img src={p.photo_url} alt="" className="mx-auto mt-6 h-28 w-28 rounded-full object-cover border-4 shadow-neon" style={{ borderColor: accent }} />
          : <div className="mx-auto mt-6 grid h-28 w-28 place-items-center rounded-full border-4 text-4xl shadow-neon" style={{ borderColor: accent, background: '#1b1326' }}>{(p.display_name || '🙂').charAt(0).toUpperCase()}</div>}
        <button onClick={onChat} className="btn mt-8 w-full py-4 text-white text-lg shadow-neon" style={{ background: accent }}>Ver meus matches</button>
        <button onClick={onClose} className="btn mt-2 w-full py-3 text-muted">Continuar</button>
      </div>
    </div>
  );
}
