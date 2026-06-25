'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import type { EventPublic } from '@/lib/types';
import { EventEnded } from '@/components/States';

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.eventByCode(code).then(setEv).catch(() => setEv(null));
  }, [code]);

  if (ev === undefined) return <Splash />;
  if (ev === null) return <NotFound />;
  if (ev.ended || !ev.is_live) return <EventEnded name={ev.name} />;

  async function enter() {
    setBusy(true);
    try {
      const part = await api.myParticipation(ev!.event_id, getUserId());
      if (part && part.status === 'active') router.push(`/event/${code}/deck`);
      else router.push(`/event/${code}/register`);
    } finally { setBusy(false); }
  }

  return (
    <main className="px-6 pt-16 pb-10 flex flex-col min-h-[100dvh]">
      <div className="flex-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-glow/15 border border-glow/40 px-3 py-1 text-xs font-bold text-glow">
          <span className="h-2 w-2 rounded-full bg-glow animate-pulse" /> AO VIVO NESTE EVENTO
        </div>
        <h1 className="mt-4 text-3xl font-black">{ev.name}</h1>
        <p className="mt-1 text-muted">📍 {ev.venue_name}</p>
        {ev.description && <p className="mt-4 text-white/90">{ev.description}</p>}

        <div className="mt-6 rounded-2xl bg-card border border-line p-4 text-sm text-muted">
          <b className="text-white">É só pra agora.</b> Você vai ver quem está neste evento,
          curtir e dar match enquanto a noite acontece. Quando o evento terminar, os perfis,
          matches e conversas <b className="text-white">deixam de ficar disponíveis</b>.
        </div>

        <label className="mt-6 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-glow" checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)} />
          <span className="text-sm text-white/90">
            Confirmo que tenho <b>18 anos ou mais</b> e aceito as regras do evento e a
            política de privacidade (dados temporários, expiram com o evento).
          </span>
        </label>
      </div>

      <button disabled={!confirmed || busy} onClick={enter}
        className="btn w-full bg-glow py-4 text-white text-lg shadow-neon">
        {busy ? 'Entrando…' : 'Entrar na noite'}
      </button>
    </main>
  );
}

function Splash() {
  return <main className="flex min-h-[100dvh] items-center justify-center text-muted">Carregando…</main>;
}
function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <div className="text-5xl">🤔</div>
      <h1 className="mt-4 text-2xl font-black">Evento não encontrado</h1>
      <p className="mt-2 text-muted">Confira o código ou escaneie o QR Code de novo.</p>
      <a href="/" className="btn mt-6 bg-card border border-line px-6 py-3">Voltar ao início</a>
    </main>
  );
}
