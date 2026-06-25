'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { adminApi } from '@/lib/api';

export default function Admin() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => { const k = localStorage.getItem('mn_admin_key'); if (k) { setKey(k); tryLogin(k); } }, []);

  async function tryLogin(k: string) {
    setErr('');
    try { setEvents(await adminApi.list(k)); setAuthed(true); localStorage.setItem('mn_admin_key', k); }
    catch { setErr('Chave inválida.'); setAuthed(false); }
  }
  async function refresh() { setEvents(await adminApi.list(key)); }

  if (!authed) return (
    <main className="px-6 pt-24">
      <h1 className="text-2xl font-black">Painel do bar</h1>
      <p className="mt-1 text-sm text-muted">Entre com a chave de administrador.</p>
      <input className="input mt-6" type="password" placeholder="Chave admin" value={key} onChange={(e) => setKey(e.target.value)} />
      {err && <p className="mt-2 text-sm text-glow">{err}</p>}
      <button onClick={() => tryLogin(key)} className="btn mt-3 w-full bg-glow2 py-3 text-white">Entrar</button>
    </main>
  );

  return (
    <main className="px-5 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Eventos</h1>
        <div className="flex items-center gap-3">
          <button onClick={async () => { const r = await adminApi.expire(key); await refresh(); alert(`Eventos vencidos expirados. Ativos agora: ${r.eventos_ativos}`); }}
            className="text-sm font-semibold text-amber">Expirar vencidos</button>
          <button onClick={() => { localStorage.removeItem('mn_admin_key'); setAuthed(false); }} className="text-sm text-muted">Sair</button>
        </div>
      </div>
      <CreateForm adminKey={key} onCreated={refresh} />
      <div className="mt-6 space-y-3">
        {events.map((e) => <EventRow key={e.id} e={e} adminKey={key} onChange={refresh} />)}
        {events.length === 0 && <p className="text-muted text-sm">Nenhum evento ainda. Crie o primeiro acima.</p>}
      </div>
    </main>
  );
}

function CreateForm({ adminKey, onCreated }: { adminKey: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', venue: '', desc: '', hours: 6 });
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!f.name || !f.venue) return;
    setBusy(true);
    const starts = new Date().toISOString();
    const ends = new Date(Date.now() + f.hours * 3600_000).toISOString();
    try { await adminApi.create(adminKey, f.name, f.venue, f.desc, starts, ends); setOpen(false); setF({ name: '', venue: '', desc: '', hours: 6 }); onCreated(); }
    finally { setBusy(false); }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="btn mt-4 w-full bg-glow py-3 text-white shadow-neon">+ Novo evento</button>;
  return (
    <div className="mt-4 rounded-2xl bg-card border border-line p-4 space-y-3">
      <input className="input" placeholder="Nome do evento (ex.: Sexta Solteira)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" placeholder="Bar / local" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
      <input className="input" placeholder="Descrição curta" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <label className="label">Duração: {f.hours}h</label>
      <input type="range" min={1} max={12} value={f.hours} onChange={(e) => setF({ ...f, hours: +e.target.value })} className="w-full accent-glow" />
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="btn flex-1 bg-glow py-3 text-white">{busy ? 'Criando…' : 'Criar e ativar'}</button>
        <button onClick={() => setOpen(false)} className="btn px-4 py-3 text-muted">Cancelar</button>
      </div>
    </div>
  );
}

function EventRow({ e, adminKey, onChange }: { e: any; adminKey: string; onChange: () => void }) {
  const [qr, setQr] = useState('');
  const [stats, setStats] = useState<any>(null);
  const link = typeof window !== 'undefined' ? `${location.origin}/join/${e.public_code}` : '';
  const live = e.status === 'active' && new Date(e.ends_at) > new Date();

  async function showQr() { setQr(await QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: '#000', light: '#fff' } })); }
  async function showStats() { setStats(await adminApi.stats(adminKey, e.id)); }
  async function end() { if (confirm('Encerrar o evento agora? Tudo expira.')) { await adminApi.end(adminKey, e.id); onChange(); } }

  return (
    <div className="rounded-2xl bg-card border border-line p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-black truncate">{e.name}</div>
          <div className="text-xs text-muted">📍 {e.venue_name} · {e.participants} pessoas · {e.matches} matches</div>
        </div>
        <span className={`text-xs font-bold ${live ? 'text-glow' : 'text-muted'}`}>{live ? '● AO VIVO' : e.status}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <code className="rounded bg-ink2 px-2 py-1">{e.public_code}</code>
        <button onClick={() => { navigator.clipboard.writeText(link); }} className="font-bold text-glow2">copiar link</button>
        <button onClick={showQr} className="font-bold text-glow2">QR</button>
        <button onClick={showStats} className="font-bold text-glow2">stats</button>
        {live && <button onClick={end} className="ml-auto font-bold text-glow">encerrar</button>}
      </div>
      {qr && <div className="mt-3 grid place-items-center"><img src={qr} alt="QR" className="rounded-xl" /><a href={qr} download={`qr-${e.public_code}.png`} className="mt-2 text-xs font-bold text-glow2">baixar QR</a></div>}
      {stats && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {[['Participantes', stats.participants], ['Ativos', stats.active], ['Likes', stats.likes], ['Passes', stats.passes], ['Matches', stats.matches], ['Denúncias', stats.reports]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-ink2 py-2"><div className="text-lg font-black">{v as number}</div><div className="text-muted">{l}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}
