'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import { themeOf } from '@/lib/studio';
import type { DeckPerson, EventPublic } from '@/lib/types';
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

  const x = useMotionValue(0);
  const rot = useTransform(x, [-200, 200], [-14, 14]);
  const likeOp = useTransform(x, [40, 140], [0, 1]);
  const passOp = useTransform(x, [-40, -140], [0, 1]);

  const load = useCallback(async () => {
    const e = await api.eventByCode(code); setEv(e);
    if (e && e.is_live && !e.ended) setPeople(await api.deck(e.event_id, uid).catch(() => []));
  }, [code, uid]);
  useEffect(() => { load(); }, [load]);

  if (left) return <LeftEvent code={code} />;
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  if (!ev || people === null) return <Splash />;

  const person = people[i];
  const t = themeOf(ev);

  async function act(action: 'like' | 'pass', who: DeckPerson) {
    if (busy) return; setBusy(true);
    try {
      const r = await api.swipe(ev!.event_id, uid, who.participant_id, action);
      if (r.matched) setMatch(who);
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
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/event/${code}/matches`)} className="btn bg-card border border-line px-3 py-2 text-sm">💜 Matches</button>
          <button onClick={async () => { await api.leave(ev.event_id, uid).catch(() => {}); setLeft(true); }} className="btn px-2 py-2 text-sm text-muted">Sair</button>
        </div>
      </header>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden px-5 py-4">
        {!person ? <EmptyDeck onRefresh={() => { setI(0); load(); }} /> : (
          <div className="relative flex-1 min-h-0">
            {people[i + 1] && (
              <div className="absolute inset-0 scale-95 opacity-60"><ProfileCard p={people[i + 1]} /></div>
            )}
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
    </main>
  );
}

function Splash() { return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando a noite…</main>; }

function MatchModal({ p, onChat, onClose, accent = '#ff3d7f', primary = '#ff3d7f' }: { p: DeckPerson; onChat: () => void; onClose: () => void; accent?: string; primary?: string }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur flex items-center justify-center px-6">
      <div className="animate-pop text-center w-full max-w-xs">
        <div className="text-sm font-black uppercase tracking-widest" style={{ color: primary }}>Deu match na casa</div>
        <h2 className="mt-2 text-3xl font-black break-words">Você e {p.display_name} se curtiram 🔥</h2>
        <img src={p.photo_url} alt="" className="mx-auto mt-6 h-28 w-28 rounded-full object-cover border-4 shadow-neon" style={{ borderColor: accent }} />
        <button onClick={onChat} className="btn mt-8 w-full py-4 text-white text-lg shadow-neon" style={{ background: accent }}>Ver meus matches</button>
        <button onClick={onClose} className="btn mt-2 w-full py-3 text-muted">Continuar</button>
      </div>
    </div>
  );
}
