'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { getUserId } from '@/lib/session';
import { INTENTIONS, PROMPTS, type EventPublic } from '@/lib/types';
import { themeOf } from '@/lib/studio';
import { EventTabs } from '@/components/EventTabs';
import { EventEnded } from '@/components/States';

export default function Perfil() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [promptIdx, setPromptIdx] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [intention, setIntention] = useState('');
  const [ig, setIg] = useState(''); const [tk, setTk] = useState(''); const [sp, setSp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.eventByCode(code).then((e) => {
      setEv(e);
      if (e?.event_id) api.myProfile(e.event_id, getUserId()).then((mp) => {
        if (!mp) return;
        if (Array.isArray(mp.photos) && mp.photos.length) setPhotos(mp.photos);
        if (mp.display_name) setName(mp.display_name);
        if (mp.birthdate) setBirth(String(mp.birthdate).slice(0, 10));
        if (mp.prompt) setPrompt(mp.prompt);
        if (mp.intention) setIntention(mp.intention);
        const s = mp.socials || {};
        if (s.instagram) setIg(String(s.instagram).replace(/^@/, ''));
        if (s.tiktok) setTk(String(s.tiktok).replace(/^@/, ''));
        if (s.spotify) setSp(s.spotify);
      }).catch(() => {});
    }).catch(() => {});
  }, [code]);
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  const t = themeOf(ev);

  async function save() {
    if (!ev) return;
    setBusy(true); setErr('');
    try {
      await api.completeProfile(ev.event_id, getUserId(), {
        display_name: name || undefined, birthdate: birth || undefined,
        photos, prompt: prompt || undefined, intention: intention || undefined,
        instagram: ig || undefined, socials: { tiktok: tk || undefined, spotify: sp || undefined } as any,
      });
      localStorage.setItem(`mn_done_${code}`, '1');
      api.track(ev.event_id, getUserId(), 'profile_completed', undefined, { photos: photos.length });
      router.push(`/event/${code}/deck`);
    } catch { setErr('Não rolou salvar. Tenta de novo.'); setBusy(false); }
  }

  return (
    <main className="pb-28">
      <EventTabs code={code} active="perfil" theme={t} />
      <div className="px-5 pt-5">
      <h1 className="text-2xl font-black">Meu perfil</h1>
      <p className="mt-1 text-sm text-muted">Tudo opcional — mas foto e nome dão muito mais match.</p>

      {/* ver como os outros me veem */}
      <div className="mt-5 rounded-2xl border border-line bg-card/40 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">👁️ Como os outros te veem</div>
        <div className="relative mt-2 h-48 overflow-hidden rounded-2xl border border-line">
          {photos[0]
            ? <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            : <div className="absolute inset-0 grid place-items-center text-6xl text-white" style={{ background: 'radial-gradient(120% 90% at 50% 0%,#3a2e8c,#1b1326)' }}>{(name || '🙂').trim().charAt(0).toUpperCase()}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold" style={{ color: t.primary }}>🟢 aqui agora</div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="text-xl font-black text-white">{name || 'Você'}{ageOf(birth) ? `, ${ageOf(birth)}` : ''}</div>
            {intention && <span className="mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: t.primary + '33', color: '#fff' }}>{intention}</span>}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">No deck mostramos só isso. Bio e redes só liberam depois do match. 🔓</p>
      </div>

      <div className="mt-6 space-y-5">
        <PhotoGallery photos={photos} onChange={setPhotos} accent={t.primary} />
        <div><label className="label">Nome / apelido</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como te chamam?" /></div>
        <div><label className="label">Data de nascimento (mostra sua idade)</label>
          <input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></div>
        <div>
          <label className="label">Apresentação</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {PROMPTS.map((p, k) => (
              <button key={k} type="button" onClick={() => setPromptIdx(k)} className={`chip ${promptIdx === k ? 'bg-glow2 border-glow2 text-white' : 'bg-card border-line text-white/80'}`}>{p.replace('...', '')}</button>
            ))}
          </div>
          <textarea className="input" rows={2} maxLength={160} placeholder={PROMPTS[promptIdx]} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <label className="label">Intenção da noite</label>
          <div className="flex flex-wrap gap-2">
            {INTENTIONS.map((it) => (
              <button key={it} type="button" onClick={() => setIntention(it)} className={`chip ${intention === it ? 'bg-glow border-glow text-white' : 'bg-card border-line text-white/80'}`}>{it}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Redes (revelam no match)</label>
          <div className="space-y-2">
            <Social icon="📸" ph="instagram" value={ig} onChange={setIg} />
            <Social icon="🎵" ph="tiktok" value={tk} onChange={setTk} />
            <Social icon="🎧" ph="spotify (perfil/playlist)" value={sp} onChange={setSp} />
          </div>
        </div>
      </div>

      {err && <p className="mt-4 rounded-2xl border border-glow/50 bg-glow/15 px-4 py-3 text-sm font-semibold text-white">{err}</p>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-[480px] border-t border-line bg-ink/90 px-5 py-4 backdrop-blur">
          <button onClick={save} disabled={busy} className="btn w-full py-4 text-lg font-bold" style={{ background: t.button, color: '#fff' }}>{busy ? 'Salvando…' : 'Salvar e voltar'}</button>
        </div>
      </div>
    </main>
  );
}

function ageOf(birth: string): number | null {
  if (!birth) return null;
  try { return Math.floor((Date.now() - new Date(birth).getTime()) / 3.15576e10); } catch { return null; }
}

function Social({ icon, ph, value, onChange }: { icon: string; ph: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card border border-line px-3">
      <span className="text-lg">{icon}</span>
      <input className="w-full bg-transparent py-3 text-white placeholder:text-muted outline-none" value={value}
        onChange={(e) => onChange(e.target.value.replace(/^@/, ''))} placeholder={ph} autoCapitalize="none" />
    </div>
  );
}

const MAX = 6;
function PhotoGallery({ photos, onChange, accent }: { photos: string[]; onChange: (a: string[]) => void; accent: string }) {
  const [up, setUp] = useState(false); const [err, setErr] = useState('');
  async function uploadOne(file: File): Promise<string | null> {
    if (file.size > 8_388_608) { setErr('Cada foto até 8MB.'); return null; }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${getUserId()}/${Date.now()}-${Math.floor(performance.now())}.${ext}`;
    const { error } = await supabase.storage.from('mn-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return null;
    return supabase.storage.from('mn-photos').getPublicUrl(path).data.publicUrl;
  }
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return; setErr(''); setUp(true);
    try {
      const room = MAX - photos.length; const urls: string[] = [];
      for (const f of files.slice(0, room)) { const u = await uploadOne(f); if (u) urls.push(u); }
      if (urls.length) onChange([...photos, ...urls]); else if (!err) setErr('Não rolou enviar.');
    } finally { setUp(false); }
  }
  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i));
  const cover = (i: number) => onChange([photos[i], ...photos.filter((_, j) => j !== i)]);
  return (
    <div>
      <label className="label">Suas fotos <span className="text-muted">(a 1ª é a capa)</span></label>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: MAX }).map((_, i) => {
          const url = photos[i];
          if (url) return (
            <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-card">
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: accent }}>CAPA</span>}
              <button type="button" onClick={() => remove(i)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white">✕</button>
              {i !== 0 && <button type="button" onClick={() => cover(i)} className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 py-0.5 text-[10px] font-bold text-white">★ capa</button>}
            </div>
          );
          const isNext = i === photos.length;
          return (
            <label key={i} className={`grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed ${isNext ? 'border-glow2 bg-glow2/10' : 'border-line bg-card/40'}`}>
              <span className={`text-2xl ${isNext ? 'text-glow2' : 'text-muted'}`}>＋</span>
              <input type="file" accept="image/*" multiple onChange={pick} className="hidden" disabled={up} />
            </label>
          );
        })}
      </div>
      {up && <p className="mt-1 text-xs text-glow2">enviando…</p>}
      {err && <p className="mt-1 text-xs text-glow">{err}</p>}
    </div>
  );
}
