'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import type { EventPublic, MatchRow } from '@/lib/types';
import { EventEnded } from '@/components/States';

export default function Matches() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const uid = getUserId();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const [rows, setRows] = useState<MatchRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const e = await api.eventByCode(code); setEv(e);
      if (e && e.is_live && !e.ended) setRows(await api.matches(e.event_id, uid).catch(() => []));
    })();
  }, [code, uid]);

  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  if (!ev || rows === null) return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando…</main>;

  return (
    <main className="min-h-[100dvh] px-5 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <button onClick={() => router.push(`/event/${code}/deck`)} className="btn h-10 w-10 grid place-items-center bg-card border border-line">←</button>
        <h1 className="text-2xl font-black">Conexões da noite</h1>
      </header>

      {rows.length === 0 ? (
        <div className="mt-24 text-center">
          <div className="text-5xl">💜</div>
          <p className="mt-4 text-muted">Sem matches ainda. Volta pro deck e curte quem te interessa.</p>
          <button onClick={() => router.push(`/event/${code}/deck`)} className="btn mt-6 bg-glow2 px-6 py-3 text-white">Ver quem está aqui</button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((m) => (
            <div key={m.match_id} className="flex items-center gap-3 rounded-2xl bg-card border border-line p-3">
              <img src={m.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="font-black">{m.display_name}, {m.age}</div>
                <div className="text-xs text-muted">{m.night_intention}</div>
                {m.instagram ? (
                  <a href={`https://instagram.com/${m.instagram.replace('@', '')}`} target="_blank"
                     className="mt-1 inline-block text-sm font-bold text-glow">📸 {m.instagram}</a>
                ) : <div className="mt-1 text-xs text-muted">Sem Instagram — se achem por aí 😉</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-xs text-muted">As conexões somem quando o evento terminar.</p>
    </main>
  );
}
