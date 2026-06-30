'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { studioApi } from '@/lib/api';
import { themeOf } from '@/lib/studio';

const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function Home() {
  const [code, setCode] = useState('');
  const [live, setLive] = useState<any[] | null>(null);
  const router = useRouter();

  useEffect(() => { studioApi.publicList().then(setLive).catch(() => setLive([])); }, []);

  return (
    <main className="px-6 pb-12 pt-14 min-h-[100dvh]">
      <div className="text-5xl">🌃</div>
      <h1 className="mt-3 text-3xl font-black leading-tight">
        As conexões<br />são da <span className="text-glow">noite</span>.
      </h1>
      <p className="mt-2 text-sm text-muted">Escaneie o QR do evento ou entre num rolê que está rolando agora.</p>

      {/* rolês ao vivo */}
      {live && live.length > 0 && (
        <div className="mt-7">
          <div className="text-xs font-bold uppercase tracking-wide text-glow">● Acontecendo agora</div>
          <div className="mt-3 space-y-3">
            {live.map((e: any, i: number) => {
              const t = themeOf(e);
              return (
                <button key={i} onClick={() => router.push(`/e/${e.slug || e.public_code}`)}
                  className="block w-full overflow-hidden rounded-2xl border border-line bg-card text-left">
                  <div className="relative h-28">
                    <img src={t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(27,19,38,.95), transparent 70%)' }} />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold backdrop-blur" style={{ color: t.primary }}>● AO VIVO</span>
                    <div className="absolute bottom-2 left-3 text-2xl">{t.emoji}</div>
                  </div>
                  <div className="p-3">
                    <div className="font-black leading-tight">{t.headline || e.name}</div>
                    <div className="text-xs text-muted">📍 {e.venue_name} · {fmtTime(e.starts_at)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold" style={{ color: t.primary }}>{e.participants > 0 ? `${e.participants} aqui agora` : 'seja o primeiro'}</span>
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: t.button }}>Entrar</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* entrar por código */}
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/join/${code.trim().toLowerCase()}`); }} className="mt-8">
        <label className="label">Tem o código do evento?</label>
        <div className="flex gap-2">
          <input className="input" placeholder="ex.: laicos" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" />
          <button className="btn shrink-0 bg-glow2 px-5 text-white">Ir</button>
        </div>
      </form>

      <div className="mt-10 rounded-2xl border border-dashed border-line p-4 text-center">
        <div className="text-sm font-bold">É dono de bar?</div>
        <p className="mt-1 text-xs text-muted">Crie uma noite de Matchmaker com a cara da sua casa em minutos.</p>
        <a href="/studio" className="btn mt-3 inline-block bg-glow px-5 py-2.5 text-sm text-white shadow-neon">Criar evento no Studio →</a>
      </div>

      <p className="mt-8 text-center text-xs text-muted">+18 · experiência temporária por evento</p>
    </main>
  );
}
