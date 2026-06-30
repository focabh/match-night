'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import { themeOf } from '@/lib/studio';
import type { EventPublic, MatchRow } from '@/lib/types';
import { EventTabs } from '@/components/EventTabs';
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
      if (e && e.is_live && !e.ended) {
        setRows(await api.matches(e.event_id, uid).catch(() => []));
        api.track(e.event_id, uid, 'matches_viewed');
      }
    })();
  }, [code, uid]);

  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  if (!ev || rows === null) return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando…</main>;
  const t = themeOf(ev);

  return (
    <main className="min-h-[100dvh] pb-10">
      <EventTabs code={code} active="matches" theme={t} />
      <div className="px-5 pt-4">
      <h1 className="text-2xl font-black">Conexões da noite</h1>

      {rows.length === 0 ? (
        <div className="mt-24 text-center">
          <div className="text-5xl">💜</div>
          <p className="mt-4 text-muted">Sem matches ainda. Volta pro deck e curte quem te interessa.</p>
          <button onClick={() => router.push(`/event/${code}/deck`)} className="btn mt-6 bg-glow2 px-6 py-3 text-white">Ver quem está aqui</button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((m) => (
            <button key={m.match_id} onClick={() => { ev && api.track(ev.event_id, uid, 'conversation_started', undefined, { match: m.match_id }); router.push(`/event/${code}/chat/${m.match_id}`); }}
              className="flex w-full items-center gap-3 rounded-2xl bg-card border border-line p-3 text-left">
              {m.photo_url
                ? <img src={m.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                : <div className="grid h-16 w-16 place-items-center rounded-xl bg-ink2 text-2xl">{(m.display_name || '🙂').charAt(0)}</div>}
              <div className="min-w-0 flex-1">
                <div className="font-black">{m.display_name}{m.age ? `, ${m.age}` : ''}</div>
                <div className="truncate text-xs text-muted">{m.last_message ? m.last_message : (m.night_intention || 'Toque pra conversar e se encontrar')}</div>
              </div>
              <span className="shrink-0 text-lg" aria-hidden>💬</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-xs text-muted">As conexões somem quando o evento terminar.</p>
      </div>
    </main>
  );
}
