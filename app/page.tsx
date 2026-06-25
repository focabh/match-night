'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <main className="px-6 pt-20 pb-10 flex flex-col min-h-[100dvh]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-5xl">🌃</div>
        <h1 className="mt-4 text-4xl font-black leading-tight">
          As conexões<br />são da <span className="text-glow">noite</span>.
        </h1>
        <p className="mt-3 text-muted">
          Escaneie o QR Code do evento pra ver quem está aqui agora. Acabou a noite,
          acabou tudo.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/join/${code.trim().toLowerCase()}`); }}
          className="mt-8"
        >
          <label className="label">Tem o código do evento?</label>
          <input className="input" placeholder="ex.: a1b2c3d4" value={code}
            onChange={(e) => setCode(e.target.value)} autoCapitalize="none" />
          <button className="btn mt-3 w-full bg-glow2 py-3 text-white">Entrar no evento</button>
        </form>
      </div>
      <p className="text-center text-xs text-muted">+18 · experiência temporária por evento</p>
    </main>
  );
}
